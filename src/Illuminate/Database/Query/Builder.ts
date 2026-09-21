import type { Connection } from '../Connection'
import type { Grammar } from '../Query/Grammars/Grammar'
import type { Processor } from './Processors'

import { Arr, Collection } from '../../Collections'
import { isSet } from '../../Support'
import { Builder as EloquentBuilder } from '../Eloquent'
import { Relation } from '../Eloquent/Relations'
import { Expression } from './Expression'

type Prettify<T> = {
  [K in keyof T]: T[K]
} & {}

export type Bindings = {
  select: unknown[]
  from: unknown[]
  join: unknown[]
  where: unknown[]
  groupBy: unknown[]
  having: unknown[]
  order: unknown[]
  union: unknown[]
  unionOrder: unknown[]
}

export type BindingsKeys = Prettify<keyof Bindings>

export type Agregate = { function: string; columns: Array<Expression | string> }

export class Builder {
  /**
   * The database connection instance.
   *
   * @var \Illuminate\Database\ConnectionInterface
   */
  public connection: Connection

  // An aggregate function and column to be run.
  public aggregateProperty: Agregate | null = null

  /**
   * The database query grammar instance.
   *
   * @var \Illuminate\Database\Query\Grammars\Grammar
   */
  public grammar: Grammar

  /**
   * The query execution timeout in seconds.
   *
   * @var int|null
   */
  public timeout: number | undefined

  /**
   * The database query post processor instance.
   *
   * @var \Illuminate\Database\Query\Processors\Processor
   */
  public processor: Processor

  // The query union statements.
  public unions: any[] | null = null


  /**
   * The table which the query is targeting.
   *
   * @var \Illuminate\Database\Query\Expression|string
   */
  public fromProperty: Function | Builder | Expression | string = ''

  /**
   * The callbacks that should be invoked after retrieving data from the database.
   *
   * @var array
   */
  protected afterQueryCallbacks: Function[] = []

  /**
   * The maximum number of records to return.
   *
   * @var int|null
   */
  public limitProperty: number | null = null

  /**
   * The maximum number of records to return per group.
   *
   * @var Record<string, any> | null
   */
  public groupLimitProperty: Record<string, any> | null = null

  /**
   * The number of records to skip.
   *
   * @var int|null
   */
  public offsetProperty: number | null = null

  /**
   * The columns that should be returned.
   *
   * @var array<string|\Illuminate\Contracts\Database\Query\Expression>|null
   */
  public columns: Array<string | Expression> = []

  /**
 * Indicates if the query returns distinct results.
 *
 * Occasionally contains the columns that should be distinct.
 */
  public distinctProperty: boolean | Array<Expression | string> = false

  public bindings: Bindings = {
    select: [],
    from: [],
    join: [],
    where: [],
    groupBy: [],
    having: [],
    order: [],
    union: [],
    unionOrder: []
  }

  /**
   * Create a new query builder instance.
   */
  public constructor (
    connection: Connection,
    grammar: Grammar,
    processor: Processor
  ) {
    this.connection = connection
    this.grammar = grammar ?? connection.getQueryGrammar()
    this.processor = processor ?? connection.getPostProcessor()
  }

  /**
   * Force the query to only return distinct results.
   *
   * @param  {string[]}  columns
   * @return {this}
   */
  public distinct (...columns: string[]): this {
    if (columns.length > 0) {
      this.distinctProperty = Array.isArray(columns[0]) || typeof columns[0] === 'boolean' ? columns[0] : columns
    } else {
      this.distinctProperty = true
    }
    return this
  }

  /**
   * Get the database query processor instance.
   *
   * @return \Illuminate\Database\Query\Processors\Processor
   */
  public getProcessor (): Processor {
    return this.processor
  }

  /**
   * Set the columns to be selected.
   *
   * @param  mixed  $columns
   * @return $this
   */
  // public select(columns: string | string[] = ['*']) {
  public select (...columns: string[]) {
    columns = columns.length === 0 ? ['*'] : columns

    this.columns = []
    this.bindings.select = []

    const columnsArray = Array.isArray(columns) ? columns : [columns]

    for (const [as, column] of Object.entries(columnsArray)) {
      if (typeof as === 'string' && this.isQueryable(column)) {
        this.selectSub(column, as)
      } else {
        this.columns.push(column)
      }
    }

    return this
  }

  /**
 * Execute the query as a "select" statement.
 *
 * @param  string|\Illuminate\Contracts\Database\Query\Expression|array<string|\Illuminate\Contracts\Database\Query\Expression>  $columns
 * @return \Illuminate\Support\Collection<int, \stdClass>
 */
  public async get (columns: string | string[] | Expression[] = ['*']): Promise<Collection> {
    const items = new Collection(
      await this.onceWithColumns(Arr.wrap(columns), () => {
        return this.processor.processSelect(this, this.runSelect())
      })
    )

    return this.applyAfterQueryCallbacks(
      isSet(this.groupLimitProperty) ? this.withoutGroupLimitKeys(items) : items
    )
  }

  /**
 * Run the query as a "select" statement against the connection.
 *
 * @return array
 */
  protected runSelect () {
    return this.connection.select(this.toSql(), this.getBindings())
  }

  /**
   * Remove the group limit keys from the results in the collection.
   *
   * @param  \Illuminate\Support\Collection  $items
   * @return \Illuminate\Support\Collection
   */
  protected withoutGroupLimitKeys (items: Collection): Collection {
    const keysToRemove: string[] = []

    if (typeof this.groupLimitProperty!.column === 'string') {
      const column = this.groupLimitProperty!.column.split('.').pop()!

      keysToRemove.push('@laravel_group := ' + this.grammar.wrap(column))
      keysToRemove.push(
        '@laravel_group := ' + this.grammar.wrap('pivot_' + column)
      )
    }

    items.each((item: any) => {
      keysToRemove.forEach((key: string) => {
        delete item[key]
      })
    })

    return items
  }

  /**
   * Invoke the "after query" modification callbacks.
   *
   * @param  mixed  result
   * @return mixed
   */
  public applyAfterQueryCallbacks (result: unknown) {
    for (const afterQueryCallback of this.afterQueryCallbacks) {
      result = afterQueryCallback(result) ?? result
    }

    return result
  }

  /**
   * Execute the given callback while selecting the given columns.
   *
   * After running the callback, the columns are reset to the original value.
   *
   * @template TResult
   *
   * @param  array<string|\Illuminate\Contracts\Database\Query\Expression>  $columns
   * @param  callable(): TResult  $callback
   * @return TResult
   */
  protected onceWithColumns<TResult>(
    columns: Array<string | Expression>,
    callback: () => TResult
  ): TResult {
    const original = this.columns

    if (original.length === 0) {
      this.columns = columns
    }

    const result = callback()

    this.columns = original

    return result
  }

  /**
   * Add a subselect expression to the query.
   *
   * @param  \Closure|\Illuminate\Database\Query\Builder|\Illuminate\Database\Eloquent\Builder<*>|string  $query
   * @param  string  $as
   * @return $this
   *
   * @throws \InvalidArgumentException
   */
  public selectSub (query: Function | Builder | EloquentBuilder | Relation | string, as: string) {
    const [subQuery, bindings] = this.createSub(query)

    return this.selectRaw(
      '(' + subQuery + ') as ' + this.grammar.wrap(as),
      bindings
    )
  }

  /**
   * Add a new "raw" select expression to the query.
   *
   * @param  string  $expression
   * @return $this
   */
  public selectRaw (expression: string, bindings: any[] = []): this {
    this.addSelect(new Expression(expression))

    if (bindings.length > 0) {
      this.addBinding(bindings, 'select')
    }

    return this
  }

  /**
 * Set the table which the query is targeting.
 *
 * @param  \Closure|\Illuminate\Database\Query\Builder|\Illuminate\Database\Eloquent\Builder<*>|\Illuminate\Contracts\Database\Query\Expression|string  table
 * @param  string|null  as
 * @return this
 */
  public from (
    table: Function | Builder | EloquentBuilder | string,
    as: string | null = null
  ) {
    if (this.isQueryable(table)) {
      return this.fromSub(table, as!)
    }

    this.fromProperty = as ? `${table} as ${as}` : table

    return this
  }

  /**
   * Makes "from" fetch from a subquery.
   *
   * @param  \Closure|\Illuminate\Database\Query\Builder|\Illuminate\Database\Eloquent\Builder<*>|string  query
   * @param  string  as
   * @return this
   *
   * @throws \InvalidArgumentException
   */
  public fromSub (
    query: Function | Builder | EloquentBuilder | string,
    as: string
  ) {
    const [subQuery, bindings] = this.createSub(query)

    return this.fromRaw(
      '(' + subQuery + ') as ' + this.grammar.wrapTable(as!),
      bindings
    )
  }

  /**
   * Add a raw "from" clause to the query.
   *
   * @param  string  $expression
   * @param  mixed  $bindings
   * @return $this
   */
  public fromRaw (expression: string, bindings: any[] = []) {
    this.fromProperty = new Expression(expression)

    this.addBinding(bindings, 'from')

    return this
  }

  /**
   * Add a binding to the query.
   *
   * @param  mixed  $value
   * @param  "select"|"from"|"join"|"where"|"groupBy"|"having"|"order"|"union"|"unionOrder"  $type
   * @return $this
   *
   * @throws \InvalidArgumentException
   */
  public addBinding (value: any, type: keyof Bindings = 'where') {
    if (!(type in this.bindings)) {
      throw new Error(`Invalid binding type: ${type}.`)
    }

    if (Array.isArray(value)) {
      this.bindings[type] = value.map((v) => this.castBinding(v))
    } else {
      this.bindings[type].push(this.castBinding(value))
    }

    return this
  }

  /**
 * Cast the given binding value.
 *
 * @param  mixed  $value
 * @return mixed
 */
  public castBinding (value: any) {
    return value
  }

  /**
   * Add a new select column to the query.
   *
   * @param  mixed  $column
   * @return $this
   */
  public addSelect (column: any | string[]): this {
    const columns = Array.isArray(column) ? column : [column]

    for (const [as, column] of Object.entries(columns)) {
      if (typeof as === 'string' && this.isQueryable(column)) {
        if (this.columns === null) {
          this.select(this.fromProperty + '.*')
        }

        this.selectSub(column, as)
      } else {
        if (Array.isArray(this.columns) && this.columns.includes(column)) {
          continue
        }

        this.columns!.push(column)
      }
    }

    return this
  }

  /**
   * Creates a subquery and parse it.
   *
   * @param  \Closure|\Illuminate\Database\Query\Builder|\Illuminate\Database\Eloquent\Builder<*>|string  $query
   * @return array
   */
  protected createSub (
    query: Function | Builder | EloquentBuilder | Relation | string
  ): [string, unknown[]] {
    // If the given query is a Closure, we will execute it while passing in a new
    // query instance to the Closure. This will give the developer a chance to
    // format and work with the query before we cast it to a raw SQL string.
    if (query instanceof Function) {
      const callback = query

      callback((query = this.forSubQuery()))
    }

    return this.parseSub(query)
  }

  /**
   * Create a new query instance for a sub-query.
   *
   * @return \Illuminate\Database\Query\Builder
   */
  protected forSubQuery () {
    return this.newQuery()
  }

  /**
   * Get a new instance of the query builder.
   *
   * @return \Illuminate\Database\Query\Builder
   */
  public newQuery () {
    return new Builder(this.connection, this.grammar, this.processor)
  }

  /**
   * Parse the subquery into SQL and bindings.
   *
   * @param  mixed  query
   * @return array
   *
   * @throws \InvalidArgumentException
   */
  protected parseSub (
    query: Builder | EloquentBuilder | Relation | string
  ): [string, unknown[]] {
    if (
      query instanceof Builder ||
      query instanceof EloquentBuilder ||
      query instanceof Relation
    ) {
      query = this.prependDatabaseNameIfCrossDatabaseQuery(query)
      const builder = this.toBaseQuery(query)

      return [builder.toSql(), builder.getBindings()]
    } else if (typeof query === 'string') {
      return [query, []]
    } else {
      throw new Error(
        'InvalidArgumentException: A subquery must be a query builder instance, a Closure, or a string.'
      )
    }
  }

  /**
   * Get the SQL representation of the query.
   *
   * @return string
   */
  public toSql (): string {
    return this.grammar.compileSelect(this)
  }

  /**
   * Get the current query value bindings in a flattened array.
   *
   * @return list<mixed>
   */
  public getBindings (): unknown[] {
    return Object.values(this.bindings).flat()
  }

  /**
   * Get the base query builder instance from a subquery.
   *
   * @param  \Illuminate\Database\Query\Builder|\Illuminate\Database\Eloquent\Builder<*>|\Illuminate\Database\Eloquent\Relations\Relation  query
   * @return \Illuminate\Database\Query\Builder
   */
  protected toBaseQuery (query: Builder | EloquentBuilder | Relation): Builder {
    return query instanceof Builder ? query : query.toBase()
  }

  /**
   * Prepend the database name if the given query is on another database.
   *
   * @param  mixed  query
   * @return mixed
   */
  protected prependDatabaseNameIfCrossDatabaseQuery<
    T extends Builder | EloquentBuilder | Relation
  >(query: T): T {
    const builder = this.toBaseQuery(query)

    if (
      builder.getConnection().getDatabaseName() !==
      this.getConnection().getDatabaseName()
    ) {
      const databaseName = builder.getConnection().getDatabaseName()

      if (
        typeof builder.fromProperty === 'string' &&
        !builder.fromProperty.startsWith(databaseName) &&
        !builder.fromProperty.includes('.')
      ) {
        builder.fromProperty = databaseName + '.' + builder.fromProperty
      }
    }

    return query
  }

  /**
   * Get the database connection instance.
   *
   * @return \Illuminate\Database\ConnectionInterface
   */
  public getConnection () {
    return this.connection
  }

  /**
   * Determine if the value is a query builder instance or a Closure.
   *
   * @param  {any}  value
   * @return {boolean}
   */
  protected isQueryable (value: unknown): boolean {
    return (
      value instanceof Builder ||
      value instanceof EloquentBuilder ||
      value instanceof Relation ||
      value instanceof Function
    )
  }
}

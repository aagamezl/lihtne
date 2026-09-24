import { dateFormat } from '@devnetic/utils'
import { isNil } from 'es-toolkit'

import type { Scalar } from '../../Support/types'
import type { Connection } from '../Connection'
import type { Grammar } from '../Query/Grammars/Grammar'
import type { JoinClause } from './JoinClause'
import type { Processor } from './Processors'

import { Arr, Collection } from '../../Collections'
import { head } from '../../Collections/helpers'
import { isSet, mixing, type Prettify, value } from '../../Support'
// import { registry } from './internal'
import { resolveClass } from '../../Support/class-registry'
import { BuildsQueries } from '../Concerns'
import { BuildsWhereDateClauses } from '../Concerns/BuildsWhereDateClauses'
import { Builder as EloquentBuilder } from '../Eloquent'
import { Relation } from '../Eloquent/Relations'
import { Expression } from './Expression'

export type BindingValue =
  string |
  number |
  // | bigint
  boolean |
  // | Date
  // | Buffer
  // | Uint8Array
  null

export type BindingValues = BindingValue[]

export type WhereOptions = {
  expanded: boolean
  language: string
  mode: string
}

export type WhereClause = {
  caseSensitive?: boolean
  column?: string | Expression
  first?: string | Expression | Array<Expression | string>
  second?: string | Expression | undefined
  type: string
  not?: boolean
  operator?: string | undefined
  value?: unknown
  boolean: string
  sql?: string | Expression
  options?: WhereOptions
  query?: Builder
  values?: unknown[] | Record<string, unknown>
  columns?: (string | Expression)[]
}

export type Bindings = {
  select: BindingValues
  from: BindingValues
  join: BindingValues
  where: BindingValues
  groupBy: BindingValues
  having: BindingValues
  order: BindingValues
  union: BindingValues
  unionOrder: BindingValues
}

export type Having = {
  type: string
  column?: string | Expression
  operator?: string
  value?: string
  boolean: string
  sql?: string
  values?: string[]
  not?: boolean
  query: Builder
}

export type Order = {
  column?: string | Expression
  direction?: string
  type?: string
  sql: string | Expression
  values?: BindingValues
}

export type Union = {
  all: boolean
  query: Builder
}

export type BindingsKeys = Prettify<keyof Bindings>

export type Agregate = { function: string; columns: Array<Expression | string> }

export type GroupLimit = {
  value: number
  column: string
}

export interface Builder extends BuildsQueries, BuildsWhereDateClauses { }

export class Builder extends mixing(BuildsQueries).useTrait([BuildsWhereDateClauses, BuildsQueries]) {
  /**
   * The database connection instance.
   *
   * @var \Illuminate\Database\ConnectionInterface
   */
  public connection: Connection

  // An aggregate function and column to be run.
  public aggregateProperty: Agregate | undefined = undefined

  /**
   * The database query post processor instance.
   *
   * @var \Illuminate\Database\Query\Processors\Processor
   */
  public processor: Processor

  // The query union statements.
  public unions: any[] | null = null

  /**
   * The table joins for the query.
   *
   * @var JoinClause[]
   */
  public joins: JoinClause[] = []

  /**
   * The table which the query is targeting.
   *
   * @var \Closure|\Illuminate\Database\Query\Builder|\Illuminate\Database\Eloquent\Builder<*>|\Illuminate\Contracts\Database\Query\Expression|string
   */
  public fromProperty: Function | Builder | EloquentBuilder | Expression | string = ''

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
  public limitProperty: number | undefined = undefined

  /**
   * The where constraints for the query.
   *
   * @var array
   */
  public wheres: WhereClause[] = []

  /**
   * The maximum number of records to return per group.
   *
   * @var {value: number, column: string} | null
   */
  public groupLimitProperty: GroupLimit | undefined = undefined

  /**
   * The number of records to skip.
   *
   * @var int|null
   */
  public offsetProperty: number | undefined = undefined

  // The having constraints for the query.
  public havings: Having[] = []

  /**
   * The maximum number of union records to return.
   *
   * @var int|null
   */
  public unionLimit: number | null = null

  /**
   * The number of union records to skip.
   *
   * @var int|null
   */
  public unionOffset: number | null = null

  /**
   * All of the available clause operators.
   *
   * @var string[]
   */
  public operators = [
    '=', '<', '>', '<=', '>=', '<>', '!=', '<=>',
    'like', 'like binary', 'not like', 'ilike',
    '&', '|', '^', '<<', '>>', '&~', 'is', 'is not',
    'rlike', 'not rlike', 'regexp', 'not regexp',
    '~', '~*', '!~', '!~*', 'similar to',
    'not similar to', 'not ilike', '~~*', '!~~*'
  ]

  /**
   * All of the available bitwise operators.
   *
   * @var string[]
   */
  public bitwiseOperators = [
    '&', '|', '^', '<<', '>>', '&~'
  ]

  /**
   * The orderings for the union query.
   *
   * @var array|null
   */
  public unionOrders: Order[] | null = null

  /**
     * Indicates whether row locking is being used.
     *
     * @var string|bool|null
     */
  public lockProperty: string | boolean | undefined = undefined

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
   * The database query grammar instance.
   *
   * @var \Illuminate\Database\Query\Grammars\Grammar
   */
  public grammar: Grammar

  /**
   * Create a new query builder instance.
   */
  public constructor(
    connection: Connection,
    grammar: Grammar,
    processor: Processor
  ) {
    super()

    this.connection = connection
    this.grammar = grammar ?? connection.getQueryGrammar()
    this.processor = processor ?? connection.getPostProcessor()
  }

  /**
   * Add a "join" clause to the query.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression|string  $table
   * @param  \Closure|\Illuminate\Contracts\Database\Query\Expression|string  $first
   * @param  string|null  $operator
   * @param  \Illuminate\Contracts\Database\Query\Expression|string|null  $second
   * @param  string  $type
   * @param  bool  $where
   * @return $this
   */
  public join(
    table: string | Expression,
    first: Function | Expression | string,
    operator: string | undefined = undefined,
    second: string | Expression | undefined = undefined,
    type: string = 'inner',
    where: boolean = false
  ): this {
    const join = this.newJoinClause(this, type, table)

    // If the first "column" of the join is really a Closure instance the developer
    // is trying to build a join with a complex "on" clause containing more than
    // one condition, so we'll add the join and call a Closure with the query.
    if (first instanceof Function) {
      first(join)

      this.joins.push(join)

      this.addBinding(join.getBindings(), 'join')
    }

    // If the column is simply a string, we can assume the join simply has a basic
    // "on" clause with a single condition. So we will just build the join with
    // this simple join clauses attached to it. There is not a join callback.
    else {
      const method: string = where ? 'where' : 'on'

      this.joins.push(join[method](first, operator, second))

      this.addBinding(join.getBindings(), 'join')
    }

    return this
  }

  /**
   * Add a "where" clause comparing two columns to the query.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression|string|array  $first
   * @param  string|null  $operator
   * @param  string|null  $second
   * @param  string|null  $boolean
   * @return $this
   */
  public whereColumn(first: Expression | string | Array<Expression | string>, operator: string | undefined = undefined, second: string | Expression | undefined = undefined, boolean: string = 'and'): this {
    // If the column is an array, we will assume it is an array of key-value pairs
    // and can add them each as a where clause. We will maintain the boolean we
    // received when the method was called and pass it into the nested where.
    if (Array.isArray(first)) {
      return this.addArrayOfWheres(first, boolean, 'whereColumn')
    }

    // If the given operator is not found in the list of valid operators we will
    // assume that the developer is just short-cutting the '=' operators and
    // we will set the operators to '=' and set the values appropriately.
    if (this.invalidOperator(operator)) {
      [second, operator] = [operator, '=']
    }

    // Finally, we will add this where clause into this array of clauses that we
    // are building for the query. All of them will be compiled via a grammar
    // once the query is about to be executed and run against the database.
    const type = 'Column'

    this.wheres.push({
      type,
      first,
      operator,
      second,
      boolean
    })

    return this
  }

  /**
   * Determine if the given operator is supported.
   *
   * @param  string  $operator
   * @return bool
   */
  protected invalidOperator(operator: string | undefined): boolean {
    return typeof operator !== 'string' ||
      (!this.operators.includes(operator!.toLowerCase()) &&
        !this.grammar.getOperators().includes(operator.toLowerCase()))
  }

  /**
   * Add an array of "where" clauses to the query.
   *
   * @param  array  $column
   * @param  string  $boolean
   * @param  string  $method
   * @return $this
   */
  protected addArrayOfWheres(column: Array<Expression | string>, boolean: string, method: string = 'where'): this {
    return this.whereNested((query: Builder) => {
      for (const [key, value] of Object.entries(column)) {
        if (typeof key === 'number' && Array.isArray(value)) {
          query[method](...value, boolean)
        } else {
          query[method](key, '=', value, boolean)
        }
      }
    }, boolean)
  }

  /**
   * Add a nested "where" statement to the query.
   *
   * @param  string  $boolean
   * @return $this
   */
  public whereNested(callback: Function, boolean: string = 'and'): this {
    const query = this.forNestedWhere()
    callback(query)

    return this.addNestedWhereQuery(query, boolean)
  }

  /**
   * Create a new query instance for nested where condition.
   *
   * @return \Illuminate\Database\Query\Builder
   */
  public forNestedWhere(): Builder {
    return this.newQuery().from(this.fromProperty)
  }

  /**
   * Add another query builder as a nested where to the query builder.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  string  $boolean
   * @return $this
   */
  public addNestedWhereQuery(query: Builder, boolean: string = 'and'): this {
    if (query.wheres.length > 0) {
      const type = 'Nested'

      this.wheres.push({ type, query, boolean })

      this.addBinding(query.getRawBindings().where, 'where')
    }

    return this
  }

  /**
   * Get a new "join" clause.
   *
   * @param  string  $type
   * @param  \Illuminate\Contracts\Database\Query\Expression|string  $table
   * @return \Illuminate\Database\Query\JoinClause
   */
  protected newJoinClause(
    parentQuery: Builder,
    type: string,
    table: Expression | string
  ): JoinClause {
    // return new (registry.get('JoinClause'))(parentQuery, type, table)
    // return new JoinClause(parentQuery, type, table)

    const JoinClauseCtor = resolveClass<JoinClause>('JoinClause')

    return new JoinClauseCtor(parentQuery, type, table)
  }

  /**
   * Add a "where like" clause to the query.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression|string  $column
   * @param  string  $value
   * @param  bool  $caseSensitive
   * @param  string  $boolean
   * @param  bool  $not
   * @return $this
   */
  public whereLike(
    column: Expression | string,
    value: string,
    caseSensitive: boolean = false,
    boolean: string = 'and', not: boolean = false
  ): this {
    const type: string = 'Like';

    this.wheres.push({ type, column, value, caseSensitive, boolean, not })

    if (this.grammar.prepareWhereLikeBinding) {
      value = this.grammar.prepareWhereLikeBinding(value, caseSensitive);
    }

    this.addBinding(value);

    return this;
  }

  /**
   * Add a "where null safe equals" clause to the query.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression|string  $column
   * @param  mixed  $value
   * @param  string  $boolean
   * @return $this
   */
  public whereNullSafeEquals(
    column: Expression | string,
    value: unknown,
    boolean: string = 'and'
  ): this {
    const type: string = 'NullSafeEquals';

    this.wheres.push({ type, column, value, boolean });

    if (!(value instanceof Expression)) {
      this.addBinding(this.flattenValue(value), 'where');
    }

    return this;
  }

  /**
   * Add an "or where null safe equals" clause to the query.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression|string  $column
   * @param  mixed  $value
   * @return $this
   */
  public orWhereNullSafeEquals(
    column: Expression | string,
    value: unknown
  ): this {
    return this.whereNullSafeEquals(column, value, 'or');
  }

  /**
   * Get the default key name of the table.
   *
   * @return string
   */
  protected defaultKeyName(): string {
    return 'id';
  }


  /**
   * Add an "or where like" clause to the query.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression|string  $column
   * @param  string  $value
   * @param  bool  $caseSensitive
   * @return $this
   */
  public orWhereLike(
    column: Expression | string,
    value: string,
    caseSensitive: boolean = false
  ): this {
    return this.whereLike(column, value, caseSensitive, 'or', false);
  }

  /**
   * Add a "where not like" clause to the query.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression|string  $column
   * @param  string  $value
   * @param  bool  $caseSensitive
   * @param  string  $boolean
   * @return $this
   */
  public whereNotLike(
    column: Expression | string,
    value: string,
    caseSensitive: boolean = false,
    boolean: string = 'and'
  ): this {
    return this.whereLike(column, value, caseSensitive, boolean, true);
  }

  /**
   * Add an "or where not like" clause to the query.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression|string  $column
   * @param  string  $value
   * @param  bool  $caseSensitive
   * @return $this
   */
  public orWhereNotLike(
    column: Expression | string,
    value: string,
    caseSensitive: boolean = false
  ): this {
    return this.whereNotLike(column, value, caseSensitive, 'or');
  }

  /**
   * Force the query to only return distinct results.
   *
   * @param  {string[]}  columns
   * @return {this}
   */
  public distinct(...columns: string[]): this {
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
  public getProcessor(): Processor {
    return this.processor
  }

  /**
   * Set the columns to be selected.
   *
   * @param  mixed  $columns
   * @return $this
   */
  // public select(columns: string | string[] = ['*']) {
  public select(...columns: string[]) {
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
   * Get the raw array of bindings.
   *
   * @return array{
   *      select: list<mixed>,
   *      from: list<mixed>,
   *      join: list<mixed>,
   *      where: list<mixed>,
   *      groupBy: list<mixed>,
   *      having: list<mixed>,
   *      order: list<mixed>,
   *      union: list<mixed>,
   *      unionOrder: list<mixed>,
   * }
   */
  public getRawBindings(): Bindings {
    return this.bindings
  }

  /**
   * Set the bindings on the query builder.
   *
   * @param  list<mixed>  $bindings
   * @param  "select"|"from"|"join"|"where"|"groupBy"|"having"|"order"|"union"|"unionOrder"  $type
   * @return $this
   *
   * @throws \InvalidArgumentException
   */
  public setBindings(bindings: BindingValues, type: keyof Bindings = 'where'): this {
    if (!Object.keys(this.bindings).includes(type)) {
      throw new Error(`InvalidArgumentException: Invalid binding type: ${type}.`)
    }

    this.bindings[type] = bindings

    return this
  }

  /**
 * Execute the query as a "select" statement.
 *
 * @param  string|\Illuminate\Contracts\Database\Query\Expression|array<string|\Illuminate\Contracts\Database\Query\Expression>  $columns
 * @return \Illuminate\Support\Collection<int, \stdClass>
 */
  public async get(columns: string | Expression | Array<string | Expression> = ['*']): Promise<Collection> {
    const items = new Collection(
      await this.onceWithColumns(Arr.wrap(columns), async () => {
        return this.processor.processSelect(this, await this.runSelect())
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
  protected runSelect(): Promise<Record<string, unknown>[]> {
    return this.connection.select(this.toSql(), this.getBindings())
  }

  /**
   * Remove the group limit keys from the results in the collection.
   *
   * @param  \Illuminate\Support\Collection  $items
   * @return \Illuminate\Support\Collection
   */
  protected withoutGroupLimitKeys(items: Collection): Collection {
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
   * Get the query grammar instance.
   *
   * @return \Illuminate\Database\Query\Grammars\Grammar
   */
  public getGrammar(): Grammar {
    return this.grammar
  }

  /**
   * Invoke the "after query" modification callbacks.
   *
   * @param  mixed  result
   * @return mixed
   */
  public applyAfterQueryCallbacks<TResult>(result: TResult): TResult {
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
  public selectSub(query: Function | Builder | EloquentBuilder | Relation | string, as: string) {
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
  public selectRaw(expression: string, bindings: any[] = []): this {
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
  public from(
    table: Function | Builder | EloquentBuilder | Expression | string,
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
  public fromSub(
    query: Function | Builder | EloquentBuilder | Expression | string,
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
  public fromRaw(expression: string, bindings: any[] = []) {
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
  public addBinding(value: BindingValue | BindingValues, type: keyof Bindings = 'where') {
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
   * Add a "where binary" clause to the query.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression|string  $column
   * @param  string  $value
   * @param  string  $boolean
   * @param  bool  $not
   * @return $this
   */
  public whereBinary(
    column: string | Expression,
    value: string,
    boolean: string = 'and',
    not: boolean = false
  ) {
    const type = 'Binary'

    this.wheres.push({ type, column, value, boolean, not })

    this.addBinding(value)

    return this
  }

  /**
   * Add an "or where binary" clause to the query.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression|string  $column
   * @param  string  $value
   * @return $this
   */
  public orWhereBinary(column: string | Expression, value: string) {
    return this.whereBinary(column, value, 'or')
  }

  /**
   * Add a "where not binary" clause to the query.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression|string  $column
   * @param  string  $value
   * @param  string  $boolean
   * @return $this
   */
  public whereNotBinary(
    column: string | Expression,
    value: string,
    boolean: string = 'and'
  ) {
    return this.whereBinary(column, value, boolean, true)
  }

  /**
   * Add an "or where not binary" clause to the query.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression|string  $column
   * @param  string  $value
   * @return $this
   */
  public orWhereNotBinary(column: string | Expression, value: string) {
    return this.whereNotBinary(column, value, 'or')
  }

  /**
   * Cast the given binding value.
   *
   * @param  mixed  $value
   * @return mixed
   */
  public castBinding(value: BindingValue): BindingValue {
    return value
  }

  /**
   * Add a new select column to the query.
   *
   * @param  mixed  $column
   * @return $this
   */
  public addSelect(column: any | string[]): this {
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
  protected createSub(
    query: Function | Builder | EloquentBuilder | Relation | Expression | string
  ): [string, BindingValues] {
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
  protected forSubQuery() {
    return this.newQuery()
  }

  /**
   * Get a new instance of the query builder.
   *
   * @return \Illuminate\Database\Query\Builder
   */
  public newQuery() {
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
  protected parseSub(
    query: Builder | EloquentBuilder | Relation | Expression | string
  ): [string, BindingValues] {
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
  public toSql(): string {
    return this.grammar.compileSelect(this)
  }

  /**
   * Get the current query value bindings in a flattened array.
   *
   * @return list<mixed>
   */
  public getBindings(): BindingValues {
    return Object.values(this.bindings).flat()
  }

  /**
   * Get the base query builder instance from a subquery.
   *
   * @param  \Illuminate\Database\Query\Builder|\Illuminate\Database\Eloquent\Builder<*>|\Illuminate\Database\Eloquent\Relations\Relation  query
   * @return \Illuminate\Database\Query\Builder
   */
  protected toBaseQuery(query: Builder | EloquentBuilder | Relation): Builder {
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
  public getConnection() {
    return this.connection
  }

  /**
   * Determine if the value is a query builder instance or a Closure.
   *
   * @param  {any}  value
   * @return {boolean}
   */
  protected isQueryable(value: unknown): boolean {
    return (
      value instanceof Builder ||
      value instanceof EloquentBuilder ||
      value instanceof Relation ||
      value instanceof Function
    )
  }

  /**
 * Add a basic "where" clause to the query.
 *
 * @param  \Closure|string|array|\Illuminate\Contracts\Database\Query\Expression  $column
 * @param  mixed  $operator
 * @param  mixed  $value
 * @param  string  $boolean
 * @return $this
 */
  public where(
    column: Expression | Scalar | Array<Expression | Scalar> | Function,
    operator: Scalar | Scalar[] | undefined = undefined,
    value: Scalar | Array<Scalar | Scalar[]> | undefined = undefined,
    boolean: 'and' | 'or' = 'and'
  ): this {
    if (column instanceof Expression) {
      const type = 'Expression'

      this.wheres.push({ type, column, boolean })

      return this
    }

    // If the column is an array, we will assume it is an array of key-value pairs
    // and can add them each as a where clause. We will maintain the boolean we
    // received when the method was called and pass it into the nested where.
    if (Array.isArray(column)) {
      return this.addArrayOfWheres(column, boolean)
    }

    // Here we will make some assumptions about the operator. If only 2 values are
    // passed to the method, we will assume that the operator is an equals sign
    // and keep going. Otherwise, we'll require the operator to be passed in.
    [value, operator] = this.prepareValueAndOperator(value, operator, arguments.length === 2)

    // If the column is actually a Closure instance, we will assume the developer
    // wants to begin a nested where statement which is wrapped in parentheses.
    // We will add that Closure to the query and return back out immediately.
    if (column instanceof Function && operator === undefined) {
      return this.whereNested(column, boolean)
    }

    // If the column is a Closure instance and there is an operator value, we will
    // assume the developer wants to run a subquery and then compare the result
    // of that subquery with the given value that was provided to the method.
    if (this.isQueryable(column) && operator !== undefined) {
      const [sub, bindings] = this.createSub(column)

      return this.addBinding(bindings, 'where')
        .where(new Expression('(' + sub + ')'), operator, value, boolean)
    }

    // If the given operator is not found in the list of valid operators we will
    // assume that the developer is just short-cutting the '=' operators and
    // we will set the operators to '=' and set the values appropriately.
    if (this.invalidOperator(operator)) {
      [value, operator] = [operator, '=']
    }

    // If the value is a Closure, it means the developer is performing an entire
    // sub-select within the query and we will need to compile the sub-select
    // within the where clause to get the appropriate query record results.
    if (this.isQueryable(value)) {
      return this.whereSub(column, operator, value, boolean)
    }

    // If the value is "null", we will just assume the developer wants to add a
    // where null clause to the query. So, we will allow a short-cut here to
    // that method for convenience so the developer doesn't have to check.
    if (isNil(value)) {
      return this.whereNull(column, boolean, !['=', '<=>'].includes(operator!))
    }

    let type = 'Basic'

    const columnString = (column instanceof Expression)
      ? this.grammar.getValue(column)
      : column

    // If the column is making a JSON reference we'll check to see if the value
    // is a boolean. If it is, we'll add the raw boolean string as an actual
    // value to the query to ensure this is properly handled by the query.
    if (String(columnString).includes('->') && typeof value === 'boolean') {
      value = new Expression(value ? 'true' : 'false')

      if (typeof column === 'string') {
        type = 'JsonBoolean'
      }
    }

    if (this.isBitwiseOperator(operator)) {
      type = 'Bitwise'
    }

    if (operator === '<=>') {
      type = 'NullSafeEquals'
    }

    // Now that we are working with just a simple query we can put the elements
    // in our array and add the query binding to our array of bindings that
    // will be bound to each SQL statements when it is finally executed.
    this.wheres.push({ type, column, operator, value, boolean })

    if (!(value instanceof Expression)) {
      this.addBinding(this.flattenValue(value), 'where')
    }

    return this
  }

  /**
   * Prepare the value and operator for a where clause.
   *
   * @param  string  $value
   * @param  string  $operator
   * @param  bool  $useDefault
   * @return array
   *
   * @throws \InvalidArgumentException
   */
  public prepareValueAndOperator(value: unknown, operator: string, useDefault: boolean = false): [unknown, string] {
    if (useDefault) {
      return [operator, '=']
    }

    if (this.invalidOperatorAndValue(operator, value)) {
      throw new Error('Illegal operator and value combination.')
    }

    return [value, operator]
  }

  /**
   * Add a basic "where not" clause to the query.
   *
   * @param  \Closure|string|array|\Illuminate\Contracts\Database\Query\Expression  $column
   * @param  mixed  $operator
   * @param  mixed  $value
   * @param  string  $boolean
   * @return $this
   */
  public whereNot(
    column: Expression | string | Array<Expression | string> | Function,
    operator?: string,
    value?: unknown,
    boolean: string = 'and'
  ): this {
    if (Array.isArray(column)) {
      return this.whereNested((query: Builder) => {
        query.where(column, operator, value, boolean)
      }, boolean + ' not')
    }

    return this.where(column, operator, value, boolean + ' not')
  }

  /**
   * Determine if the given operator and value combination is legal.
   *
   * Prevents using Null values with invalid operators.
   *
   * @param  string  $operator
   * @param  mixed  $value
   * @return bool
   */
  protected invalidOperatorAndValue(operator: string, value: unknown): boolean {
    return isNil(value) && this.operators.includes(operator) &&
      !['=', '<=>', '<>', '!='].includes(operator)
  }

  /**
   * Add a date based (year, month, day, time) statement to the query.
   *
   * @param  string  $type
   * @param  \Illuminate\Contracts\Database\Query\Expression|string  $column
   * @param  string  $operator
   * @param  mixed  $value
   * @param  string  $boolean
   * @return $this
   */
  protected addDateBasedWhere(
    type: string,
    column: Expression | string,
    operator: string,
    value: unknown,
    boolean: 'and' | 'or' = 'and'
  ): this {
    this.wheres.push({ column, type, boolean, operator, value })

    if (!(value instanceof Expression)) {
      this.addBinding(value, 'where')
    }

    return this
  }

  /**
 * Add a "where month" statement to the query.
 *
 * @param  \Illuminate\Contracts\Database\Query\Expression|string  $column
 * @param  \DateTimeInterface|string|int|null  $operator
 * @param  \DateTimeInterface|string|int|null  $value
 * @param  string  $boolean
 * @return $this
 */
  public whereMonth(
    column: Expression | string,
    operator: Scalar | Scalar[] | Expression | undefined = undefined,
    value: Scalar | Array<Scalar | Scalar[]> | undefined = undefined,
    boolean: 'and' | 'or' = 'and'
  ): this {
    [value, operator] = this.prepareValueAndOperator(value, operator, arguments.length === 2)

    // If the given operator is not found in the list of valid operators we will
    // assume that the developer is just short-cutting the '=' operators and
    // we will set the operators to '=' and set the values appropriately.
    if (this.invalidOperator(operator)) {
      [value, operator] = [operator, '=']
    }

    value = this.flattenValue(value)

    if (value instanceof Date) {
      // value = dateFormat(value, 'm');
      parseInt(String(value.getMonth() + 1).padStart(2, '0'), 10)
    }

    if (!(value instanceof Expression)) {
      value = parseInt(String(value).padStart(2, '0'), 10)
    }

    return this.addDateBasedWhere('Month', column, operator, value, boolean)
  }

  /**
 * Add a "where year" statement to the query.
 *
 * @param  \Illuminate\Contracts\Database\Query\Expression|string  $column
 * @param  \DateTimeInterface|string|int|null  $operator
 * @param  \DateTimeInterface|string|int|null  $value
 * @param  string  $boolean
 * @return $this
 */
  public whereYear(
    column: Expression | string,
    operator: Scalar | Scalar[] | Expression | undefined = undefined,
    value: Scalar | Array<Scalar | Scalar[]> | undefined = undefined,
    boolean: 'and' | 'or' = 'and'
  ): this {
    [value, operator] = this.prepareValueAndOperator(value, operator, arguments.length === 2)

    // If the given operator is not found in the list of valid operators we will
    // assume that the developer is just short-cutting the '=' operators and
    // we will set the operators to '=' and set the values appropriately.
    if (this.invalidOperator(operator)) {
      [value, operator] = [operator, '=']
    }

    value = this.flattenValue(value)

    if (value instanceof Date) {
      // value = dateFormat(value, 'Y');
      String(value.getFullYear())
    }

    return this.addDateBasedWhere('Year', column, operator, value, boolean)
  }

  /**
   * Add an "or where date" statement to the query.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression|string  $column
   * @param  \DateTimeInterface|string|null  $operator
   * @param  \DateTimeInterface|string|null  $value
   * @return $this
   */
  public orWhereDate(
    column: Expression | string,
    operator: Scalar | Scalar[] | undefined = undefined,
    value: Scalar | Array<Scalar | Scalar[]> | undefined = undefined
  ): this {
    [value, operator] = this.prepareValueAndOperator(value, operator, arguments.length === 2)

    return this.whereDate(column, operator, value, 'or')
  }

  /**
   * Add a "where time" statement to the query.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression|string  $column
   * @param  \DateTimeInterface|string|null  $operator
   * @param  \DateTimeInterface|string|null  $value
   * @param  string  $boolean
   * @return $this
   */
  public whereTime(
    column: Expression | string,
    operator: Scalar | Scalar[] | Expression | undefined = undefined,
    value: Scalar | Array<Scalar | Scalar[]> | undefined = undefined,
    boolean: 'and' | 'or' = 'and'
  ): this {
    [value, operator] = this.prepareValueAndOperator(value, operator, arguments.length === 2)

    // If the given operator is not found in the list of valid operators we will
    // assume that the developer is just short-cutting the '=' operators and
    // we will set the operators to '=' and set the values appropriately.
    if (this.invalidOperator(operator)) {
      [value, operator] = [operator, '=']
    }

    value = this.flattenValue(value)

    if (value instanceof Date) {
      value = dateFormat(value, 'H:i:s')
    }

    return this.addDateBasedWhere('Time', column, operator, value, boolean)
  }

  /**
   * Add an "or where time" statement to the query.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression|string  $column
   * @param  \DateTimeInterface|string|null  $operator
   * @param  \DateTimeInterface|string|null  $value
   * @return $this
   */
  public orWhereTime(
    column: Expression | string,
    operator: Scalar | Scalar[] | Expression | undefined = undefined,
    value: Scalar | Array<Scalar | Scalar[]> | undefined = undefined
  ): this {
    [value, operator] = this.prepareValueAndOperator(value, operator, arguments.length === 2)

    return this.whereTime(column, operator, value, 'or')
  }

  /**
   * Add an "or where day" statement to the query.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression|string  $column
   * @param  \DateTimeInterface|string|int|null  $operator
   * @param  \DateTimeInterface|string|int|null  $value
   * @return $this
   */
  public orWhereDay(
    column: Expression | string,
    operator: Scalar | Scalar[] | undefined = undefined,
    value: Scalar | Array<Scalar | Scalar[]> | undefined = undefined
  ): this {
    [value, operator] = this.prepareValueAndOperator(value, operator, arguments.length === 2)

    return this.whereDay(column, operator, value, 'or')
  }

  /**
   * Add an "or where month" statement to the query.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression|string  $column
   * @param  \DateTimeInterface|string|int|null  $operator
   * @param  \DateTimeInterface|string|int|null  $value
   * @return $this
   */
  public orWhereMonth(
    column: Expression | string,
    operator: Scalar | Scalar[] | undefined = undefined,
    value: Scalar | Array<Scalar | Scalar[]> | undefined = undefined
  ): this {
    [value, operator] = this.prepareValueAndOperator(value, operator, arguments.length === 2)

    return this.whereMonth(column, operator, value, 'or')
  }

  /**
   * Add an "or where year" statement to the query.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression|string  $column
   * @param  \DateTimeInterface|string|int|null  $operator
   * @param  \DateTimeInterface|string|int|null  $value
   * @return $this
   */
  public orWhereYear(
    column: Expression | string,
    operator: Scalar | Scalar[] | undefined = undefined,
    value: Scalar | Array<Scalar | Scalar[]> | undefined = undefined
  ): this {
    [value, operator] = this.prepareValueAndOperator(value, operator, arguments.length === 2)

    return this.whereYear(column, operator, value, 'or')
  }

  /**
   * Add a "where day" statement to the query.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression|string  $column
   * @param  \DateTimeInterface|string|int|null  $operator
   * @param  \DateTimeInterface|string|int|null  $value
   * @param  string  $boolean
   * @return $this
   */
  public whereDay(
    column: Expression | string,
    operator: Scalar | Scalar[] | Expression | undefined = undefined,
    value: Scalar | Array<Scalar | Scalar[]> | undefined = undefined,
    boolean: 'and' | 'or' = 'and'
  ): this {
    [value, operator] = this.prepareValueAndOperator(value, operator, arguments.length === 2)

    // If the given operator is not found in the list of valid operators we will
    // assume that the developer is just short-cutting the '=' operators and
    // we will set the operators to '=' and set the values appropriately.
    if (this.invalidOperator(operator)) {
      [value, operator] = [operator, '=']
    }

    value = this.flattenValue(value)

    if (value instanceof Date) {
      // value = dateFormat(value, 'd');
      value = parseInt(String(value.getDate()).padStart(2, '0'), 10)
    }

    if (!(value instanceof Expression)) {
      value = parseInt(String(value).padStart(2, '0'), 10)
    }

    return this.addDateBasedWhere('Day', column, operator, value, boolean)
  }

  /**
   * Add a "where date" statement to the query.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression|string  $column
   * @param  \DateTimeInterface|string|null  $operator
   * @param  \DateTimeInterface|string|null  $value
   * @param  string  $boolean
   * @return $this
   */
  public whereDate(
    column: Expression | string,
    operator: Scalar | Scalar[] | Expression | undefined = undefined,
    value: Scalar | Array<Scalar | Scalar[]> | undefined = undefined,
    boolean: 'and' | 'or' = 'and'
  ): this {
    [value, operator] = this.prepareValueAndOperator(value, operator, arguments.length === 2)

    // If the given operator is not found in the list of valid operators we will
    // assume that the developer is just short-cutting the '=' operators and
    // we will set the operators to '=' and set the values appropriately.
    if (this.invalidOperator(operator)) {
      [value, operator] = [operator, '=']
    }

    value = this.flattenValue(value)

    if (value instanceof Date) {
      value = dateFormat(value, 'Y-m-d')
    }

    return this.addDateBasedWhere('Date', column, operator, value, boolean)
  }

  /**
   * Get a scalar type value from an unknown type of input.
   *
   * @param  mixed  $value
   * @return mixed
   */
  protected flattenValue(value: unknown): unknown {
    return Array.isArray(value) ? head(Arr.flatten(value)) : value
  }

  /**
   * Add a full sub-select to the query.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression|string  $column
   * @param  string  $operator
   * @param  \Closure|\Illuminate\Database\Query\Builder|\Illuminate\Database\Eloquent\Builder<*>  $callback
   * @param  string  $boolean
   * @return $this
   */
  protected whereSub(column: Expression | string, operator: string, callback: Function | Builder | EloquentBuilder, boolean: string): this {
    const type = 'Sub'

    let query: Builder | EloquentBuilder

    if (callback instanceof Function) {
      // Once we have the query instance we can simply execute it so it can add all
      // of the sub-select's conditions to itself, and then we can cache it off
      // in the array of where clauses for the "main" parent query instance.
      query = this.forSubQuery()
      callback(query)
    } else {
      query = callback instanceof EloquentBuilder ? callback.toBase() : callback
    }

    this.wheres.push({ type, column, operator, query, boolean })

    this.addBinding(query.getBindings(), 'where')

    return this
  }

  /**
   * Determine if the operator is a bitwise operator.
   *
   * @param  string  $operator
   * @return bool
   */
  protected isBitwiseOperator(operator: string): boolean {
    return this.bitwiseOperators.includes(operator.toLowerCase()) ||
      this.grammar.getBitwiseOperators().includes(operator.toLowerCase())
  }

  /**
 * Add a "where null" clause to the query.
 *
 * @param  string|array|\Illuminate\Contracts\Database\Query\Expression  $columns
 * @param  string  $boolean
 * @param  bool  $not
 * @return $this
 */
  public whereNull(columns: Expression | string | Array<Expression | string>, boolean: string = 'and', not: boolean = false): this {
    const type = not ? 'NotNull' : 'Null'

    for (const column of Arr.wrap(columns)) {
      this.wheres.push({ type, column, boolean })
    }

    return this
  }
}

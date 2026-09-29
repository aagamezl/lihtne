import { dateFormat } from '@devnetic/utils'
import { cloneDeep, isNil } from 'es-toolkit'

import type { Scalar } from '../../Support/types'
import type { Connection } from '../Connection'
import type { Grammar } from '../Query/Grammars/Grammar'
import type { IndexHint } from './IndexHint'
import type { JoinClause } from './JoinClause'
import type { Processor } from './Processors'

import { Arr, Collection } from '../../Collections'
import { enumValue } from '../../Collections/functions'
import { head } from '../../Collections/helpers'
import { DatePeriod, isSet, mixing, type Prettify } from '../../Support'
// import { registry } from './internal'
import { resolveClass } from '../../Support/class-registry'
import { changeKeyCase, isNumeric, tap } from '../../Support/helpers'
import { BuildsQueries } from '../Concerns'
import { BuildsWhereDateClauses } from '../Concerns/BuildsWhereDateClauses'
import { Builder as EloquentBuilder } from '../Eloquent'
import { Relation } from '../Eloquent/Relations'
import { SortDirection } from './Enums/SortDirection'
import { Expression } from './Expression'

export type BindingValue =

    | string |
    number |
    // | bigint
    boolean |
    Date |
    // | Buffer
    // | Uint8Array
    null |
    Expression

export type BindingValues = BindingValue[]

type WhereLikeBindingGrammar = Grammar & {
  prepareWhereLikeBinding: (value: string, caseSensitive: boolean) => string
}

function isWhereLikeBindingGrammar (
  grammar: Grammar
): grammar is WhereLikeBindingGrammar {
  return typeof Reflect.get(grammar, 'prepareWhereLikeBinding') === 'function'
}

export type WhereOptions = {
  expanded?: boolean
  language?: string
  mode?: string
  vector?: boolean
}

export type WhereClauseType =

    | 'Basic' |
    'Bitwise' |
    'Binary' |
    'Column' |
    'Date' |
    'Day' |
    'Expression' |
    'Fulltext' |
    'In' |
    'InRaw' |
    'JsonBoolean' |
    'Like' |
    'Month' |
    'Nested' |
    'NotIn' |
    'NotInRaw' |
    'NotNull' |
    'Null' |
    'NullSafeEquals' |
    'Sub' |
    'Time' |
    'Year' |
    'between' |
    'betweenColumns' |
    'raw' |
    'valueBetween'

export type WhereClause = {
  caseSensitive?: boolean
  column?: string | Expression
  first?: string | Expression | Array<Expression | string>
  second?: string | Expression | undefined
  type: WhereClauseType
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
  sql?: string | Expression
  values?: BindingValues
}

export type Union = {
  all: boolean
  query: Builder
}

export type BindingsKeys = Prettify<keyof Bindings>

export type Agregate = { function: string; columns: Array<string | Expression> }

export type GroupLimit = {
  value: number
  column: string
}

type QueryCallback = (query: Builder) => unknown
type JoinCallback = (join: JoinClause) => unknown
type AfterQueryCallback = <TResult>(
  result: TResult
) => TResult | null | undefined
type SelectColumn =
  string | Expression | QueryCallback | Builder | EloquentBuilder | Relation

export type BooleanOperator = 'and' | 'or'

export type WhereBoolean = BooleanOperator | `${BooleanOperator} not`

export const BOOLEAN_OPERATORS: Record<BooleanOperator, BooleanOperator> = {
  and: 'and',
  or: 'or'
} as const

// Trait methods are merged onto the class. `mixing().useTrait()` copies them onto the prototype at runtime.
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface Builder extends BuildsQueries, BuildsWhereDateClauses {}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class Builder extends mixing(BuildsQueries).useTrait([
  BuildsWhereDateClauses,
  BuildsQueries
]) {
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

  /**
   * The groupings for the query.
   *
   * @var array|null
   */
  public groups = []

  // The query union statements.
  public unions: Union[] = []

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
  public fromProperty: string | Expression = ''

  /**
   * The callbacks that should be invoked after retrieving data from the database.
   *
   * @var array
   */
  protected afterQueryCallbacks: AfterQueryCallback[] = []

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

  /**
   * The maximum number of seconds to allow the query to run.
   */
  public timeout: number | undefined = undefined

  /**
   * The index hint for the query.
   *
   * @var \Illuminate\Database\Query\IndexHint|null
   */
  public indexHint: IndexHint | undefined = undefined

  // The having constraints for the query.
  public havings: Having[] = []

  /**
   * The maximum number of union records to return.
   *
   * @var int|undefined
   */
  public unionLimit: number | undefined = undefined

  /**
   * The number of union records to skip.
   *
   * @var int|undefined
   */
  public unionOffset: number | undefined = undefined

  /**
   * All of the available clause operators.
   *
   * @var string[]
   */
  public operators = [
    '=',
    '<',
    '>',
    '<=',
    '>=',
    '<>',
    '!=',
    '<=>',
    'like',
    'like binary',
    'not like',
    'ilike',
    '&',
    '|',
    '^',
    '<<',
    '>>',
    '&~',
    'is',
    'is not',
    'rlike',
    'not rlike',
    'regexp',
    'not regexp',
    '~',
    '~*',
    '!~',
    '!~*',
    'similar to',
    'not similar to',
    'not ilike',
    '~~*',
    '!~~*'
  ]

  /**
   * All of the available bitwise operators.
   *
   * @var string[]
   */
  public bitwiseOperators = ['&', '|', '^', '<<', '>>', '&~']

  /**
   * The orderings for the union query.
   *
   * @var array|null
   */
  public orders: Order[] = []

  public unionOrders: Order[] = []

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
  public constructor (
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
  public join (
    table: string | Expression,
    first: JoinCallback | Expression | string,
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
    } else {
      // If the column is simply a string, we can assume the join simply has a basic
      // "on" clause with a single condition. So we will just build the join with
      // this simple join clauses attached to it. There is not a join callback.
      const joined = where
        ? join.where(first, operator, second)
        : join.on(first, operator, second)

      this.joins.push(joined)

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
  public whereColumn (
    first: Expression | string | Array<Expression | string>,
    operator: string | undefined = undefined,
    second: string | Expression | undefined = undefined,
    boolean: string = 'and'
  ): this {
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
      ;[second, operator] = [operator, '=']
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
  protected invalidOperator (operator: unknown): boolean {
    if (typeof operator !== 'string') {
      return true
    }

    const normalized = operator.toLowerCase()

    return (
      !this.operators.includes(normalized) &&
      !this.grammar.getOperators().includes(normalized)
    )
  }

  /**
   * Add an array of "where" clauses to the query.
   *
   * @param  array  $column
   * @param  string  $boolean
   * @param  string  $method
   * @return $this
   */
  protected addArrayOfWheres (
    column: Array<unknown>,
    boolean: string,
    method: 'where' | 'whereColumn' = 'where'
  ): this {
    const whereBoolean: WhereBoolean =
      boolean === 'or' || boolean === 'and not' || boolean === 'or not'
        ? boolean
        : BOOLEAN_OPERATORS.and

    return this.whereNested((query: Builder) => {
      for (const [key, entry] of Object.entries(column)) {
        if (isNumeric(key) && Array.isArray(entry)) {
          if (method === 'whereColumn') {
            query.whereColumn(
              String(entry[0] ?? ''),
              typeof entry[1] === 'string' ? entry[1] : undefined,
              typeof entry[2] === 'string' ? entry[2] : undefined,
              boolean
            )
          } else {
            query.where(entry[0], entry[1], entry[2], whereBoolean)
          }
        } else if (method === 'whereColumn') {
          query.whereColumn(
            key,
            '=',
            typeof entry === 'string' || entry instanceof Expression
              ? entry
              : String(entry),
            boolean
          )
        } else {
          query.where(key, '=', entry, whereBoolean)
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
  public whereNested (callback: QueryCallback, boolean: string = 'and'): this {
    const query = this.forNestedWhere()
    callback(query)

    return this.addNestedWhereQuery(query, boolean)
  }

  /**
   * Create a new query instance for nested where condition.
   *
   * @return \Illuminate\Database\Query\Builder
   */
  public forNestedWhere (): Builder {
    return this.newQuery().from(this.fromProperty)
  }

  /**
   * Add another query builder as a nested where to the query builder.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  string  $boolean
   * @return $this
   */
  public addNestedWhereQuery (query: Builder, boolean: string = 'and'): this {
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
  protected newJoinClause (
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
  public whereLike (
    column: Expression | string,
    value: string,
    caseSensitive: boolean = false,
    boolean: string = 'and',
    not: boolean = false
  ): this {
    const type: WhereClauseType = 'Like'

    this.wheres.push({ type, column, value, caseSensitive, boolean, not })

    if (isWhereLikeBindingGrammar(this.grammar)) {
      value = this.grammar.prepareWhereLikeBinding(value, caseSensitive)
    }

    this.addBinding(value)

    return this
  }

  /**
   * Add a "where null safe equals" clause to the query.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression|string  $column
   * @param  mixed  $value
   * @param  string  $boolean
   * @return $this
   */
  public whereNullSafeEquals (
    column: Expression | string,
    value: unknown,
    boolean: string = 'and'
  ): this {
    const type: WhereClauseType = 'NullSafeEquals'

    this.wheres.push({ type, column, value, boolean })

    if (!(value instanceof Expression)) {
      this.addBinding(this.flattenValue(value), 'where')
    }

    return this
  }

  /**
   * Add an "or where null safe equals" clause to the query.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression|string  $column
   * @param  mixed  $value
   * @return $this
   */
  public orWhereNullSafeEquals (
    column: Expression | string,
    value: unknown
  ): this {
    return this.whereNullSafeEquals(column, value, 'or')
  }

  /**
   * Get the default key name of the table.
   *
   * @return string
   */
  protected defaultKeyName (): string {
    return 'id'
  }

  /**
   * Add an "or where like" clause to the query.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression|string  $column
   * @param  string  $value
   * @param  bool  $caseSensitive
   * @return $this
   */
  public orWhereLike (
    column: Expression | string,
    value: string,
    caseSensitive: boolean = false
  ): this {
    return this.whereLike(column, value, caseSensitive, 'or', false)
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
  public whereNotLike (
    column: Expression | string,
    value: string,
    caseSensitive: boolean = false,
    boolean: string = 'and'
  ): this {
    return this.whereLike(column, value, caseSensitive, boolean, true)
  }

  /**
   * Add an "or where not like" clause to the query.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression|string  $column
   * @param  string  $value
   * @param  bool  $caseSensitive
   * @return $this
   */
  public orWhereNotLike (
    column: Expression | string,
    value: string,
    caseSensitive: boolean = false
  ): this {
    return this.whereNotLike(column, value, caseSensitive, 'or')
  }

  /**
   * Force the query to only return distinct results.
   *
   * @param  {string[]}  columns
   * @return {this}
   */
  public distinct (...columns: string[]): this {
    if (columns.length > 0) {
      this.distinctProperty =
        Array.isArray(columns[0]) || typeof columns[0] === 'boolean'
          ? columns[0]
          : columns
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
  public getRawBindings (): Bindings {
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
  public setBindings (
    bindings: BindingValues,
    type: keyof Bindings = 'where'
  ): this {
    if (!Object.keys(this.bindings).includes(type)) {
      throw new Error(
        `InvalidArgumentException: Invalid binding type: ${type}.`
      )
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
  public async get (
    columns: string | Expression | Array<string | Expression> = ['*']
  ): Promise<Collection<PropertyKey, Record<string, unknown>>> {
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
  protected runSelect (): Promise<Record<string, unknown>[]> {
    return this.connection.select(this.toSql(), this.getBindings())
  }

  /**
   * Remove the group limit keys from the results in the collection.
   *
   * @param  \Illuminate\Support\Collection  $items
   * @return \Illuminate\Support\Collection
   */
  protected withoutGroupLimitKeys (
    items: Collection<PropertyKey, Record<string, unknown>>
  ): Collection<PropertyKey, Record<string, unknown>> {
    const keysToRemove: string[] = []
    const groupLimit = this.groupLimitProperty

    if (groupLimit !== undefined) {
      const column = groupLimit.column.split('.').at(-1) ?? groupLimit.column

      keysToRemove.push('@lihtne_group := ' + this.grammar.wrap(column))
      keysToRemove.push(
        '@lihtne_group := ' + this.grammar.wrap('pivot_' + column)
      )
    }

    items.each((item) => {
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
  public getGrammar (): Grammar {
    return this.grammar
  }

  /**
   * Add an "or where between" statement to the query.
   *
   * @param  \Illuminate\Database\Query\Builder|\Illuminate\Database\Eloquent\Builder<*>|\Illuminate\Contracts\Database\Query\Expression|string  $column
   * @return $this
   */
  public orWhereBetween (
    column: Expression | string,
    values: Iterable<unknown>
  ): this {
    return this.whereBetween(column, values, 'or')
  }

  /**
   * Add an "or where between" statement using columns to the query.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression|string  $column
   * @return $this
   */
  public orWhereBetweenColumns (
    column: Expression | string,
    values: Array<unknown>
  ): this {
    return this.whereBetweenColumns(column, values, 'or')
  }

  /**
   * Add a "where between" statement using columns to the query.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression|string  $column
   * @param  string  $boolean
   * @param  bool  $not
   * @return $this
   */
  public whereBetweenColumns (
    column: Expression | string,
    values: Array<unknown>,
    boolean: string = 'and',
    not: boolean = false
  ): this {
    const type = 'betweenColumns'

    if (this.isQueryable(column)) {
      const [sub, bindings] = this.createSub(column)

      return this.addBinding(bindings, 'where').whereBetweenColumns(
        new Expression('(' + sub + ')'),
        values,
        boolean,
        not
      )
    }

    this.wheres.push({ type, column, values, boolean, not })
    return this
  }

  /**
   * Invoke the "after query" modification callbacks.
   *
   * @param  mixed  result
   * @return mixed
   */
  public applyAfterQueryCallbacks<TResult> (result: TResult): TResult {
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
  protected onceWithColumns<TResult> (
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
   * Add a "where not between" statement to the query.
   *
   * @param  \Illuminate\Database\Query\Builder|\Illuminate\Database\Eloquent\Builder<*>|\Illuminate\Contracts\Database\Query\Expression|string  $column
   * @param  string  $boolean
   * @return $this
   */
  public whereNotBetween (
    column: Expression | string,
    values: Iterable<unknown>,
    boolean: BooleanOperator = BOOLEAN_OPERATORS.and
  ): this {
    return this.whereBetween(column, values, boolean, true)
  }

  /**
   * Add a "where not between" statement using columns to the query.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression|string  $column
   * @param  string  $boolean
   * @return $this
   */
  public whereNotBetweenColumns (
    column: Expression | string,
    values: Array<unknown>,
    boolean: BooleanOperator = BOOLEAN_OPERATORS.and
  ): this {
    return this.whereBetweenColumns(column, values, boolean, true)
  }

  /**
   * Add an "or where not between" statement to the query.
   *
   * @param  \Illuminate\Database\Query\Builder|\Illuminate\Database\Eloquent\Builder<*>|\Illuminate\Contracts\Database\Query\Expression|string  $column
   * @return $this
   */
  public orWhereNotBetween (
    column: Expression | string,
    values: Iterable<unknown>
  ): this {
    return this.whereNotBetween(column, values, 'or')
  }

  /**
   * Add an "or where not between" statement using columns to the query.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression|string  $column
   * @return $this
   */
  public orWhereNotBetweenColumns (
    column: Expression | string,
    values: Array<unknown>
  ): this {
    return this.whereNotBetweenColumns(column, values, 'or')
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
  public selectSub (
    query: QueryCallback | Builder | EloquentBuilder | Relation | string,
    as: string
  ): this {
    const [subQuery, bindings] = this.createSub(query)

    return this.selectRaw(
      '(' + subQuery + ') as ' + this.grammar.wrap(as),
      bindings
    )
  }

  /**
   * Add an "order by" clause to the query.
   *
   * @param  \Closure|\Illuminate\Database\Query\Builder|\Illuminate\Database\Eloquent\Builder<*>|\Illuminate\Contracts\Database\Query\Expression|string  $column
   * @param  SortDirection|'asc'|'desc'  $direction
   * @return $this
   *
   * @throws \InvalidArgumentException
   */
  public orderBy (
    column: Expression | string,
    direction: SortDirection = SortDirection.Ascending
  ): this {
    if (this.isQueryable(column)) {
      const [query, bindings] = this.createSub(column)

      column = new Expression('(' + query + ')')

      this.addBinding(bindings, this.unions.length > 0 ? 'unionOrder' : 'order')
    }

    // switch (direction) {
    //   case SortDirection.Ascending:
    //     direction = 'asc';
    //     break;
    //   case SortDirection.Descending:
    //     direction = 'desc';
    //     break;
    //   default:
    //     throw new Error('Order direction must be a SortDirection, "asc" or "desc".');
    // }

    const order = { column, direction }

    if (this.unions.length > 0) {
      this.unionOrders.push(order)
    } else {
      this.orders.push(order)
    }

    return this
  }

  /**
   * Add a descending "order by" clause to the query.
   *
   * @param  \Closure|\Illuminate\Database\Query\Builder|\Illuminate\Database\Eloquent\Builder<*>|\Illuminate\Contracts\Database\Query\Expression|string  $column
   * @return $this
   */
  public orderByDesc (column: Expression | string): this {
    return this.orderBy(column, SortDirection.Descending)
  }

  /**
   * Alias to set the "offset" value of the query.
   *
   * @param  int  $value
   * @return $this
   */
  public skip (value: number): this {
    return this.offset(value)
  }

  /**
   * Set the "offset" value of the query.
   *
   * @param  int  $value
   * @return $this
   */
  public offset (value: number): this {
    const offset = Math.max(0, parseInt(value.toString(), 10))

    if (this.unions.length > 0) {
      this.unionOffset = offset
    } else {
      this.offsetProperty = offset
    }

    return this
  }

  /**
   * Alias to set the "limit" value of the query.
   *
   * @param  int  $value
   * @return $this
   */
  public take (value: number): this {
    return this.limit(value)
  }

  /**
   * Set the "limit" value of the query.
   *
   * @param  int  $value
   * @return $this
   */
  public limit (value: number): this {
    const property = this.unions.length > 0 ? 'unionLimit' : 'limitProperty'

    if (value >= 0) {
      this[property] =
        value !== undefined ? parseInt(value.toString()) : undefined
    }

    return this
  }

  /**
   * Add a new "raw" select expression to the query.
   *
   * @param  string  $expression
   * @return $this
   */
  public selectRaw (expression: string, bindings: BindingValues = []): this {
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
    table: QueryCallback | Builder | EloquentBuilder | Expression | string,
    as: string | undefined = undefined
  ) {
    if (this.isQueryable(table)) {
      if (as === undefined) {
        throw new Error(
          'InvalidArgumentException: A subquery must have an alias.'
        )
      }

      return this.fromSub(table, as)
    }

    if (typeof table === 'string' || table instanceof Expression) {
      this.fromProperty =
        as !== undefined && typeof table === 'string'
          ? `${table} as ${as}`
          : table
    }

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
    query: QueryCallback | Builder | EloquentBuilder | Expression | string,
    as: string
  ) {
    const [subQuery, bindings] = this.createSub(query)

    return this.fromRaw(
      '(' + subQuery + ') as ' + this.grammar.wrapTable(as),
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
  public fromRaw (expression: string, bindings: BindingValues = []) {
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
  public addBinding (value: unknown, type: keyof Bindings = 'where') {
    if (!(type in this.bindings)) {
      throw new Error(`Invalid binding type: ${type}.`)
    }

    const list = Array.isArray(value) ? value : [value]

    this.bindings[type] = [
      ...this.bindings[type],
      ...list.map((entry) => this.castBinding(this.toBinding(entry)))
    ]

    return this
  }

  protected toBinding (value: unknown): BindingValue {
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value === null ||
      value instanceof Expression ||
      value instanceof Date
    ) {
      return value
    }

    return String(value)
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
  public whereBinary (
    column: string | Expression,
    value: string,
    boolean: BooleanOperator = BOOLEAN_OPERATORS.and,
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
  public orWhereBinary (column: string | Expression, value: string) {
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
  public whereNotBinary (
    column: string | Expression,
    value: string,
    boolean: BooleanOperator = BOOLEAN_OPERATORS.and
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
  public orWhereNotBinary (column: string | Expression, value: string) {
    return this.whereNotBinary(column, value, 'or')
  }

  /**
   * Cast the given binding value.
   *
   * @param  mixed  $value
   * @return mixed
   */
  public castBinding (value: BindingValue): BindingValue {
    return value
  }

  /**
   * Add a new select column to the query.
   *
   * @param  mixed  $column
   * @return $this
   */
  public addSelect (column: SelectColumn | SelectColumn[]): this {
    const columns = Array.isArray(column) ? column : [column]

    for (const [as, selected] of Object.entries(columns)) {
      if (
        typeof selected === 'function' ||
        selected instanceof Builder ||
        selected instanceof EloquentBuilder ||
        selected instanceof Relation
      ) {
        if (this.columns.length === 0) {
          this.select(this.fromProperty + '.*')
        }

        this.selectSub(selected, as)
      } else if (
        typeof selected === 'string' ||
        selected instanceof Expression
      ) {
        if (this.columns.includes(selected)) {
          continue
        }

        this.columns.push(selected)
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
    query:
      QueryCallback | Builder | EloquentBuilder | Relation | Expression | string
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
   * Resolve the start and end dates from a DatePeriod.
   *
   * @param  \DatePeriod  $period
   * @return array{\DateTimeInterface, \DateTimeInterface}
   */
  protected resolveDatePeriodBounds (period: DatePeriod): [Date, Date] {
    const start = period.getStartDate()
    let end = period.getEndDate()

    if (end === null) {
      end = new Date(start.getTime())

      const recurrences = period.getRecurrences() ?? 0
      const interval = period.getDateInterval()

      for (let i = 0; i < recurrences; i++) {
        end = interval.addTo(end)
      }
    }

    return [start, end]
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
  public getBindings (): BindingValues {
    return Arr.flatten(Object.values(this.bindings)) as BindingValues
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
  > (query: T): T {
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
  protected isQueryable (
    value: unknown
  ): value is QueryCallback | Builder | EloquentBuilder | Relation {
    return (
      value instanceof Builder ||
      value instanceof EloquentBuilder ||
      value instanceof Relation ||
      value instanceof Function
    )
  }

  protected whereColumnName (column: unknown): string | Expression {
    if (typeof column === 'string' || column instanceof Expression) {
      return column
    }

    return String(column)
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
  public where (
    column: Expression | Scalar | Array<Expression | Scalar> | QueryCallback,
    operator: unknown = undefined,
    value: unknown = undefined,
    boolean: WhereBoolean = BOOLEAN_OPERATORS.and
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
    ;[value, operator] = this.prepareValueAndOperator(
      value,
      operator,
      arguments.length === 2
    )

    // If the column is actually a Closure instance, we will assume the developer
    // wants to begin a nested where statement which is wrapped in parentheses.
    // We will add that Closure to the query and return back out immediately.
    if (typeof column === 'function' && operator === undefined) {
      return this.whereNested(column, boolean)
    }

    // If the column is a Closure instance and there is an operator value, we will
    // assume the developer wants to run a subquery and then compare the result
    // of that subquery with the given value that was provided to the method.
    if (this.isQueryable(column) && operator !== undefined) {
      const [sub, bindings] = this.createSub(column)

      return this.addBinding(bindings, 'where').where(
        new Expression('(' + sub + ')'),
        operator,
        value,
        boolean
      )
    }

    // If the given operator is not found in the list of valid operators we will
    // assume that the developer is just short-cutting the '=' operators and
    // we will set the operators to '=' and set the values appropriately.
    if (this.invalidOperator(operator)) {
      ;[value, operator] = [operator, '=']
    }

    // If the value is a Closure, it means the developer is performing an entire
    // sub-select within the query and we will need to compile the sub-select
    // within the where clause to get the appropriate query record results.
    if (this.isQueryable(value)) {
      return this.whereSub(
        this.whereColumnName(column),
        operator,
        value,
        boolean
      )
    }

    // If the value is "null", we will just assume the developer wants to add a
    // where null clause to the query. So, we will allow a short-cut here to
    // that method for convenience so the developer doesn't have to check.
    if (isNil(value)) {
      const comparison = typeof operator === 'string' ? operator : ''

      return this.whereNull(
        this.whereColumnName(column),
        boolean,
        !['=', '<=>'].includes(comparison)
      )
    }

    let type: WhereClauseType = 'Basic'

    const namedColumn = this.whereColumnName(column)

    const columnString =
      namedColumn instanceof Expression
        ? this.grammar.getValue(namedColumn)
        : namedColumn

    // If the column is making a JSON reference we'll check to see if the value
    // is a boolean. If it is, we'll add the raw boolean string as an actual
    // value to the query to ensure this is properly handled by the query.
    if (String(columnString).includes('->') && typeof value === 'boolean') {
      value = new Expression(value ? 'true' : 'false')

      if (typeof namedColumn === 'string') {
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
    this.wheres.push({
      type,
      column: namedColumn,
      operator: typeof operator === 'string' ? operator : '=',
      value,
      boolean
    })

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
  public prepareValueAndOperator (
    value: unknown,
    operator: unknown,
    useDefault: boolean = false
  ): [unknown, unknown] {
    if (useDefault) {
      return [operator, '=']
    }

    if (
      typeof operator === 'string' &&
      this.invalidOperatorAndValue(operator, value)
    ) {
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
  public whereNot (
    column: Expression | string | Array<Expression | string> | QueryCallback,
    operator?: unknown,
    value?: unknown,
    boolean: BooleanOperator = BOOLEAN_OPERATORS.and
  ): this {
    if (Array.isArray(column)) {
      return this.whereNested((query: Builder) => {
        query.where(column, operator, value, boolean)
      }, `${boolean} not`)
    }

    return this.where(column, operator, value, `${boolean} not`)
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
  protected invalidOperatorAndValue (
    operator: string,
    value: unknown
  ): boolean {
    return (
      isNil(value) &&
      this.operators.includes(operator) &&
      !['=', '<=>', '<>', '!='].includes(operator)
    )
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
  protected addDateBasedWhere (
    type: WhereClauseType,
    column: Expression | string,
    operator: unknown,
    value: unknown,
    boolean: string = 'and'
  ): this {
    const operatorText = typeof operator === 'string' ? operator : '='

    this.wheres.push({ column, type, boolean, operator: operatorText, value })

    if (!(value instanceof Expression)) {
      this.addBinding(value, 'where')
    }

    return this
  }

  /**
   * Add a "where between" statement to the query.
   *
   * @param  \Illuminate\Database\Query\Builder|\Illuminate\Database\Eloquent\Builder<*>|\Illuminate\Contracts\Database\Query\Expression|string  $column
   * @param  string  $boolean
   * @param  bool  $not
   * @return $this
   */
  public whereBetween (
    column: Expression | string | QueryCallback | Builder | EloquentBuilder,
    values: Iterable<unknown>,
    boolean: BooleanOperator = BOOLEAN_OPERATORS.and,
    not: boolean = false
  ): this {
    const type = 'between'

    if (this.isQueryable(column)) {
      const [sub, bindings] = this.createSub(column)

      return this.addBinding(bindings, 'where').whereBetween(
        new Expression('(' + sub + ')'),
        values,
        boolean,
        not
      )
    }

    const normalizedValues =
      values instanceof DatePeriod
        ? this.resolveDatePeriodBounds(values)
        : [...values]

    if (typeof column !== 'string' && !(column instanceof Expression)) {
      return this
    }

    this.wheres.push({ type, column, values: normalizedValues, boolean, not })

    this.addBinding(
      this.cleanBindings(Arr.flatten(normalizedValues)).slice(0, 2),
      'where'
    )

    return this
  }

  /**
   * Remove all of the expressions from a list of bindings.
   *
   * @param  array<mixed>  $bindings
   * @return list<mixed>
   */
  public cleanBindings (
    bindings: unknown[],
    includeExpressions = false
  ): BindingValues {
    const cleaned = new Collection(bindings)
      .reject(
        (binding: unknown) =>
          binding instanceof Expression && !includeExpressions
      )
      .map((binding: unknown) => {
        if (binding instanceof Expression) {
          return this.castBinding(
            this.toBinding(binding.getValue(this.grammar))
          )
        }

        return this.castBinding(this.toBinding(binding))
      })
      .values()
      .all()

    return Array.isArray(cleaned) ? cleaned : Object.values(cleaned)
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
  public whereMonth (
    column: Expression | string,
    operator: unknown = undefined,
    value: unknown = undefined,
    boolean: BooleanOperator = BOOLEAN_OPERATORS.and
  ): this {
    ;[value, operator] = this.prepareValueAndOperator(
      value,
      operator,
      arguments.length === 2
    )

    // If the given operator is not found in the list of valid operators we will
    // assume that the developer is just short-cutting the '=' operators and
    // we will set the operators to '=' and set the values appropriately.
    if (this.invalidOperator(operator)) {
      ;[value, operator] = [operator, '=']
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
  public whereYear (
    column: Expression | string,
    operator: unknown = undefined,
    value: unknown = undefined,
    boolean: BooleanOperator = BOOLEAN_OPERATORS.and
  ): this {
    ;[value, operator] = this.prepareValueAndOperator(
      value,
      operator,
      arguments.length === 2
    )

    // If the given operator is not found in the list of valid operators we will
    // assume that the developer is just short-cutting the '=' operators and
    // we will set the operators to '=' and set the values appropriately.
    if (this.invalidOperator(operator)) {
      ;[value, operator] = [operator, '=']
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
  public orWhereDate (
    column: Expression | string,
    operator: unknown = undefined,
    value: unknown = undefined
  ): this {
    ;[value, operator] = this.prepareValueAndOperator(
      value,
      operator,
      arguments.length === 2
    )

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
  public whereTime (
    column: Expression | string,
    operator: unknown = undefined,
    value: unknown = undefined,
    boolean: BooleanOperator = BOOLEAN_OPERATORS.and
  ): this {
    ;[value, operator] = this.prepareValueAndOperator(
      value,
      operator,
      arguments.length === 2
    )

    // If the given operator is not found in the list of valid operators we will
    // assume that the developer is just short-cutting the '=' operators and
    // we will set the operators to '=' and set the values appropriately.
    if (this.invalidOperator(operator)) {
      ;[value, operator] = [operator, '=']
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
  public orWhereTime (
    column: Expression | string,
    operator: unknown = undefined,
    value: unknown = undefined
  ): this {
    ;[value, operator] = this.prepareValueAndOperator(
      value,
      operator,
      arguments.length === 2
    )

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
  public orWhereDay (
    column: Expression | string,
    operator: unknown = undefined,
    value: unknown = undefined
  ): this {
    ;[value, operator] = this.prepareValueAndOperator(
      value,
      operator,
      arguments.length === 2
    )

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
  public orWhereMonth (
    column: Expression | string,
    operator: unknown = undefined,
    value: unknown = undefined
  ): this {
    ;[value, operator] = this.prepareValueAndOperator(
      value,
      operator,
      arguments.length === 2
    )

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
  public orWhereYear (
    column: Expression | string,
    operator: unknown = undefined,
    value: unknown = undefined
  ): this {
    ;[value, operator] = this.prepareValueAndOperator(
      value,
      operator,
      arguments.length === 2
    )

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
  public whereDay (
    column: Expression | string,
    operator: unknown = undefined,
    value: unknown = undefined,
    boolean: BooleanOperator = BOOLEAN_OPERATORS.and
  ): this {
    ;[value, operator] = this.prepareValueAndOperator(
      value,
      operator,
      arguments.length === 2
    )

    // If the given operator is not found in the list of valid operators we will
    // assume that the developer is just short-cutting the '=' operators and
    // we will set the operators to '=' and set the values appropriately.
    if (this.invalidOperator(operator)) {
      ;[value, operator] = [operator, '=']
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
  public whereDate (
    column: Expression | string,
    operator: unknown = undefined,
    value: unknown = undefined,
    boolean: BooleanOperator = BOOLEAN_OPERATORS.and
  ): this {
    ;[value, operator] = this.prepareValueAndOperator(
      value,
      operator,
      arguments.length === 2
    )

    // If the given operator is not found in the list of valid operators we will
    // assume that the developer is just short-cutting the '=' operators and
    // we will set the operators to '=' and set the values appropriately.
    if (this.invalidOperator(operator)) {
      ;[value, operator] = [operator, '=']
    }

    value = this.flattenValue(value)

    if (value instanceof Date) {
      value = dateFormat(value, 'Y-m-d')
    }

    return this.addDateBasedWhere('Date', column, operator, value, boolean)
  }

  /**
   * Add a "where between columns" statement using a value to the query.
   *
   * @param  mixed  $value
   * @param  array{\Illuminate\Contracts\Database\Query\Expression|string, \Illuminate\Contracts\Database\Query\Expression|string}  $columns
   * @param  string  $boolean
   * @param  bool  $not
   * @return $this
   */
  public whereValueBetween (
    value: unknown,
    columns: Array<Expression | string>,
    boolean: BooleanOperator = BOOLEAN_OPERATORS.and,
    not: boolean = false
  ): this {
    const type = 'valueBetween'

    this.wheres.push({ type, value, columns, boolean, not })

    if (!(value instanceof Expression)) {
      this.addBinding(value, 'where')
    }

    return this
  }

  /**
   * Add a "where not between columns" statement using a value to the query.
   *
   * @param  mixed  $value
   * @param  array{\Illuminate\Contracts\Database\Query\Expression|string, \Illuminate\Contracts\Database\Query\Expression|string}  $columns
   * @param  string  $boolean
   * @return $this
   */
  public whereValueNotBetween (
    value: unknown,
    columns: Array<Expression | string>,
    boolean: BooleanOperator = BOOLEAN_OPERATORS.and
  ): this {
    return this.whereValueBetween(value, columns, boolean, true)
  }

  /**
   * Add an "or where not between columns" statement using a value to the query.
   *
   * @param  mixed  $value
   * @param  array{\Illuminate\Contracts\Database\Query\Expression|string, \Illuminate\Contracts\Database\Query\Expression|string}  $columns
   * @return $this
   */
  public orWhereValueNotBetween (
    value: unknown,
    columns: Array<Expression | string>
  ): this {
    return this.whereValueNotBetween(value, columns, 'or')
  }

  /**
   * Add an "or where not null" clause to the query.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression|string  $column
   * @return $this
   */
  public orWhereNotNull (column: Expression | string): this {
    return this.whereNotNull(column, 'or')
  }

  /**
   * Add a "where not null" clause to the query.
   *
   * @param  string|array|\Illuminate\Contracts\Database\Query\Expression  $columns
   * @param  string  $boolean
   * @return $this
   */
  public whereNotNull (
    columns: Expression | string | Array<Expression | string>,
    boolean: BooleanOperator = BOOLEAN_OPERATORS.and
  ): this {
    return this.whereNull(columns, boolean, true)
  }

  /**
   * Add a raw "or where" clause to the query.
   *
   * @param  literal-string  $sql
   * @param  mixed  $bindings
   * @return $this
   */
  public orWhereRaw (sql: string, bindings: unknown[] = []): this {
    return this.whereRaw(sql, bindings, 'or')
  }

  /**
   * Add a raw "where" clause to the query.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression|literal-string  $sql
   * @param  mixed  $bindings
   * @param  string  $boolean
   * @return $this
   */
  public whereRaw (
    sql: string,
    bindings: unknown[] = [],
    boolean: BooleanOperator = BOOLEAN_OPERATORS.and
  ): this {
    this.wheres.push({ type: 'raw', sql, boolean })

    this.addBinding(bindings, 'where')

    return this
  }

  /**
   * Add a "where in" clause to the query.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression|string  $column
   * @param  mixed  $values
   * @param  string  $boolean
   * @param  bool  $not
   * @return $this
   *
   * @throws \InvalidArgumentException
   */
  public whereIn (
    column: Expression | string,
    values: unknown[] | QueryCallback | Builder | EloquentBuilder | Relation,
    boolean: BooleanOperator = BOOLEAN_OPERATORS.and,
    not: boolean = false
  ): this {
    const type = not ? 'NotIn' : 'In'
    let subquery = false
    let list = Array.isArray(values) ? values : []

    // If the value is a query builder instance we will assume the developer wants to
    // look for any values that exist within this given query. So, we will add the
    // query accordingly so that this query is properly executed when it is run.
    if (this.isQueryable(values)) {
      const [query, bindings] = this.createSub(values)

      list = [new Expression(query)]
      subquery = true

      this.addBinding(bindings, 'where')
    }

    // Next, if the value is Arrayable we need to cast it to its raw array form so we
    // have the underlying array value instead of an Arrayable object which is not
    // able to be added as a binding, etc. We will then add to the wheres array.
    // if (values instanceof Arrayable) {
    //   values = values.toArray();
    // }

    this.wheres.push({ type, column, values: list, boolean })

    if (list.length !== Arr.flatten(list, 1).length) {
      throw new Error(
        'InvalidArgumentException: Nested arrays may not be passed to whereIn method.'
      )
    }

    // Finally, we'll add a binding for each value unless that value is an expression
    // in which case we will just skip over it since it will be the query as a raw
    // string and not as a parameterized place-holder to be replaced by the PDO.
    this.addBinding(
      this.cleanBindings(
        Arr.flatten(list, 1),
        !subquery && this.wheres.length === 1
      ),
      'where'
    )

    return this
  }

  /**
   * Add a "where not in" clause to the query.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression|string  $column
   * @param  mixed  $values
   * @param  string  $boolean
   * @return $this
   */
  public whereNotIn (
    column: Expression | string,
    values: unknown[],
    boolean: BooleanOperator = BOOLEAN_OPERATORS.and
  ): this {
    return this.whereIn(column, values, boolean, true)
  }

  /**
   * Add a "where in raw" clause for integer values to the query.
   *
   * @param  string  $column
   * @param  \Illuminate\Contracts\Support\Arrayable|array  $values
   * @param  string  $boolean
   * @param  bool  $not
   * @return $this
   */
  public whereIntegerInRaw (
    column: Expression | string,
    values: unknown[],
    boolean: BooleanOperator = BOOLEAN_OPERATORS.and,
    not: boolean = false
  ): this {
    const type = not ? 'NotInRaw' : 'InRaw'

    values = Arr.flatten(values)

    values = values.map((value) =>
      Number.parseInt(String(enumValue(value)), 10))

    this.wheres.push({ type, column, values, boolean })

    return this
  }

  /**
   * Add an "or where not in raw" clause for integer values to the query.
   *
   * @param  string  $column
   * @param  \Illuminate\Contracts\Support\Arrayable|array  $values
   * @return $this
   */
  public orWhereIntegerNotInRaw (
    column: Expression | string,
    values: unknown[]
  ): this {
    return this.whereIntegerNotInRaw(column, values, 'or')
  }

  /**
   * Add an "or where" clause comparing two columns to the query.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression|string|array  $first
   * @param  string|null  $operator
   * @param  string|null  $second
   * @return $this
   */
  public orWhereColumn (
    first: Expression | string | Array<Expression | string>,
    operator: string | undefined = undefined,
    second: string | Expression | undefined = undefined
  ): this {
    return this.whereColumn(first, operator, second, 'or')
  }

  /**
   * Add a "where fulltext" clause to the query.
   *
   * @param  string|string[]  $columns
   * @param  string  $value
   * @param  string  $boolean
   * @return $this
   */
  public whereFullText (
    columns: string | Array<string>,
    value: string,
    options: WhereOptions = {},
    boolean: BooleanOperator = BOOLEAN_OPERATORS.and
  ): this {
    const type = 'Fulltext'

    columns = Array.isArray(columns) ? columns : [columns]

    this.wheres.push({ type, columns, value, options, boolean })

    this.addBinding(value)

    return this
  }

  /**
   * Add an "or where fulltext" clause to the query.
   *
   * @param  string|string[]  $columns
   * @param  string  $value
   * @return $this
   */
  public orWhereFullText (
    columns: string | Array<string>,
    value: string,
    options: WhereOptions = {}
  ): this {
    return this.whereFullText(columns, value, options, 'or')
  }

  /**
   * Add a "where" clause to the query for multiple columns with "and" conditions between them.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression[]|\Closure[]|string[]  $columns
   * @param  mixed  $operator
   * @param  mixed  $value
   * @param  string  $boolean
   * @return $this
   */
  public whereAll (
    columns: Expression | string | Array<Expression | string>,
    operator: unknown = undefined,
    value: unknown = undefined,
    boolean: BooleanOperator = BOOLEAN_OPERATORS.and
  ): this {
    ;[value, operator] = this.prepareValueAndOperator(
      value,
      operator,
      arguments.length === 2
    )

    const columnList = Array.isArray(columns) ? columns : [columns]

    this.whereNested((query: Builder) => {
      for (const column of columnList) {
        query.where(column, operator, value, 'and')
      }
    }, boolean)

    return this
  }

  /**
   * Add an "or where" clause to the query for multiple columns with "and" conditions between them.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression[]|\Closure[]|string[]  $columns
   * @param  mixed  $operator
   * @param  mixed  $value
   * @return $this
   */
  public orWhereAll (
    columns: Expression | string | Array<Expression | string>,
    operator: unknown = undefined,
    value: unknown = undefined
  ): this {
    return this.whereAll(columns, operator, value, 'or')
  }

  /**
   * Add a "where" clause to the query for multiple columns with "or" conditions between them.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression[]|\Closure[]|string[]  $columns
   * @param  mixed  $operator
   * @param  mixed  $value
   * @param  string  $boolean
   * @return $this
   */
  public whereAny (
    columns: Expression | string | Array<Expression | string>,
    operator: unknown = undefined,
    value: unknown = undefined,
    boolean: WhereBoolean = BOOLEAN_OPERATORS.and
  ): this {
    ;[value, operator] = this.prepareValueAndOperator(
      value,
      operator,
      arguments.length === 2
    )

    const columnList = Array.isArray(columns) ? columns : [columns]

    this.whereNested((query: Builder) => {
      for (const column of columnList) {
        query.where(column, operator, value, 'or')
      }
    }, boolean)

    return this
  }

  /**
   * Add an "or where" clause to the query for multiple columns with "or" conditions between them.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression[]|\Closure[]|string[]  $columns
   * @param  mixed  $operator
   * @param  mixed  $value
   * @return $this
   */
  public orWhereAny (
    columns: Expression | string | Array<Expression | string>,
    operator: unknown = undefined,
    value: unknown = undefined
  ): this {
    return this.whereAny(columns, operator, value, 'or')
  }

  /**
   * Add a "where not" clause to the query for multiple columns where none of the conditions should be true.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression[]|\Closure[]|string[]  $columns
   * @param  mixed  $operator
   * @param  mixed  $value
   * @param  string  $boolean
   * @return $this
   */
  public whereNone (
    columns: Expression | string | Array<Expression | string>,
    operator: unknown = undefined,
    value: unknown = undefined,
    boolean: BooleanOperator = BOOLEAN_OPERATORS.and
  ): this {
    return this.whereAny(columns, operator, value, `${boolean} not`)
  }

  /**
   * Add an "or where not" clause to the query for multiple columns where none of the conditions should be true.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression[]|\Closure[]|string[]  $columns
   * @param  mixed  $operator
   * @param  mixed  $value
   * @return $this
   */
  public orWhereNone (
    columns: Expression | string | Array<Expression | string>,
    operator: unknown = undefined,
    value: unknown = undefined
  ): this {
    return this.whereNone(columns, operator, value, 'or')
  }

  /**
   * Add an "or where in raw" clause for integer values to the query.
   *
   * @param  string  $column
   * @param  \Illuminate\Contracts\Support\Arrayable|array  $values
   * @return $this
   */
  public orWhereIntegerInRaw (
    column: Expression | string,
    values: unknown[]
  ): this {
    return this.whereIntegerInRaw(column, values, 'or')
  }

  /**
   * Add a "where not in raw" clause for integer values to the query.
   *
   * @param  string  $column
   * @param  \Illuminate\Contracts\Support\Arrayable|array  $values
   * @param  string  $boolean
   * @return $this
   */
  public whereIntegerNotInRaw (
    column: Expression | string,
    values: unknown[],
    boolean: BooleanOperator = BOOLEAN_OPERATORS.and
  ): this {
    return this.whereIntegerInRaw(column, values, boolean, true)
  }

  /**
   * Add an "or where not in" clause to the query.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression|string  $column
   * @param  mixed  $values
   * @return $this
   */
  public orWhereNotIn (column: Expression | string, values: unknown[]): this {
    return this.whereNotIn(column, values, 'or')
  }

  /**
   * Add an "or where in" clause to the query.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression|string  $column
   * @param  mixed  $values
   * @return $this
   */
  public orWhereIn (column: Expression | string, values: unknown[]): this {
    return this.whereIn(column, values, 'or')
  }

  /**
   * Add an "or where not" clause to the query.
   *
   * @param  \Closure|string|array|\Illuminate\Contracts\Database\Query\Expression  $column
   * @param  mixed  $operator
   * @param  mixed  $value
   * @return $this
   */
  public orWhereNot (
    column: Expression | string | Array<Expression | string> | QueryCallback,
    operator?: Scalar | Scalar[] | Expression | undefined,
    value?: Scalar | Array<Scalar | Scalar[]> | Expression | undefined
  ): this {
    return this.whereNot(column, operator, value, 'or')
  }

  /**
   * Add an "or where" clause to the query.
   *
   * @param  \Closure|string|array|\Illuminate\Contracts\Database\Query\Expression  $column
   * @param  mixed  $operator
   * @param  mixed  $value
   * @return $this
   */
  public orWhere (
    column: Expression | string | Array<Expression | string> | QueryCallback,
    operator?: unknown,
    value?: unknown
  ): this {
    ;[value, operator] = this.prepareValueAndOperator(
      value,
      operator,
      arguments.length === 2
    )

    return this.where(column, operator, value, 'or')
  }

  /**
   * Add an "or where between columns" statement using a value to the query.
   *
   * @param  mixed  $value
   * @param  array{\Illuminate\Contracts\Database\Query\Expression|string, \Illuminate\Contracts\Database\Query\Expression|string}  $columns
   * @return $this
   */
  public orWhereValueBetween (
    value: unknown,
    columns: Array<Expression | string>
  ): this {
    return this.whereValueBetween(value, columns, 'or')
  }

  /**
   * Get a scalar type value from an unknown type of input.
   *
   * @param  mixed  $value
   * @return mixed
   */
  protected flattenValue (value: unknown): unknown {
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
  protected whereSub (
    column: Expression | string,
    operator: unknown,
    callback: QueryCallback | Builder | EloquentBuilder | Relation,
    boolean: WhereBoolean | string = BOOLEAN_OPERATORS.and
  ): this {
    const type = 'Sub'

    let query: Builder | EloquentBuilder

    if (callback instanceof Function) {
      // Once we have the query instance we can simply execute it so it can add all
      // of the sub-select's conditions to itself, and then we can cache it off
      // in the array of where clauses for the "main" parent query instance.
      query = this.forSubQuery()
      callback(query)
    } else if (
      callback instanceof EloquentBuilder ||
      callback instanceof Relation
    ) {
      query = callback.toBase()
    } else {
      query = callback
    }

    this.wheres.push({
      type,
      column,
      operator: typeof operator === 'string' ? operator : '=',
      query,
      boolean
    })

    this.addBinding(query.getBindings(), 'where')

    return this
  }

  /**
   * Retrieve the "count" result of the query.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression|string  $columns
   * @return int<0, max>
   */
  public count (columns: string = '*') {
    return this.aggregate('count', Arr.wrap(columns))
  }

  /**
   * Clone the query.
   *
   * @return static
   */
  public clone () {
    return cloneDeep(this)
  }

  /**
   * Clone the query without the given properties.
   *
   * @return static
   */
  public cloneWithout (properties: string[]) {
    return tap(this.clone(), (clone: Builder) => {
      for (const property of properties) {
        Reflect.set(clone, property, undefined)
      }
    })
  }

  /**
   * Clone the query without the given bindings.
   *
   * @return static
   */
  public cloneWithoutBindings (except: string[]) {
    return tap(this.clone(), (clone: Builder) => {
      for (const type of except) {
        if (type in clone.bindings) {
          clone.bindings[this.bindingKey(type)] = []
        }
      }
    })
  }

  protected bindingKey (type: string): keyof Bindings {
    if (
      type === 'select' ||
      type === 'from' ||
      type === 'join' ||
      type === 'where' ||
      type === 'groupBy' ||
      type === 'having' ||
      type === 'order' ||
      type === 'union' ||
      type === 'unionOrder'
    ) {
      return type
    }

    return 'select'
  }

  /**
   * Execute an aggregate function on the database.
   *
   * @param  string  $function
   * @param  array  $columns
   * @return mixed
   */
  public async aggregate (
    fn: string,
    columns: string[] = ['*']
  ): Promise<unknown> {
    const NO_CLAUSES_TO_PRESERVE: string[] = []
    const COLUMNS_CLAUSE_TO_PRESERVE = ['columns']
    const SELECT_BINDING_TO_PRESERVE: string[] = []
    const SELECT_BINDING_KEY = ['select']
    const AGGREGATE_RESULT_KEY = 'aggregate'

    const hasUnionsOrHavings = this.unions.length > 0 || this.havings.length > 0

    const results = await this.cloneWithout(
      hasUnionsOrHavings ? NO_CLAUSES_TO_PRESERVE : COLUMNS_CLAUSE_TO_PRESERVE
    )
      .cloneWithoutBindings(
        hasUnionsOrHavings ? SELECT_BINDING_TO_PRESERVE : SELECT_BINDING_KEY
      )
      .setAggregate(fn, columns)
      .get(columns)

    const row = results.first()

    if (this.isRecord(row)) {
      const normalizedRow = changeKeyCase(row)

      return normalizedRow[AGGREGATE_RESULT_KEY]
    }

    return undefined
  }

  protected isRecord (value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
  }

  /**
   * Set the aggregate property without running the query.
   *
   * @param  string  $function
   * @param  array<\Illuminate\Contracts\Database\Query\Expression|string>  $columns
   * @return $this
   */
  protected setAggregate (
    functionName: string,
    columns: Array<Expression | string>
  ) {
    this.aggregateProperty = { function: functionName, columns }

    if (this.groups.length === 0) {
      this.orders = []

      this.bindings.order = []
    }

    return this
  }

  /**
   * Add a "union" statement to the query.
   *
   * @param  \Closure|\Illuminate\Database\Query\Builder|\Illuminate\Database\Eloquent\Builder<*>  $query
   * @param  bool  $all
   * @return $this
   */
  public union (
    query: QueryCallback | Builder | EloquentBuilder,
    all: boolean = false
  ): this {
    if (query instanceof Function) {
      query((query = this.newQuery()))
    }

    query = query instanceof EloquentBuilder ? query.toBase() : query

    this.unions.push({ query, all })

    this.addBinding(query.getBindings(), 'union')

    return this
  }

  /**
   * Add a "union all" statement to the query.
   *
   * @param  \Closure|\Illuminate\Database\Query\Builder|\Illuminate\Database\Eloquent\Builder<*>  $query
   * @return $this
   */
  public unionAll (query: QueryCallback | Builder | EloquentBuilder): this {
    return this.union(query, true)
  }

  /**
   * Determine if the operator is a bitwise operator.
   *
   * @param  string  $operator
   * @return bool
   */
  protected isBitwiseOperator (operator: unknown): boolean {
    if (typeof operator !== 'string') {
      return false
    }

    return (
      this.bitwiseOperators.includes(operator.toLowerCase()) ||
      this.grammar.getBitwiseOperators().includes(operator.toLowerCase())
    )
  }

  /**
   * Add a "where null" clause to the query.
   *
   * @param  string|array|\Illuminate\Contracts\Database\Query\Expression  $columns
   * @param  string  $boolean
   * @param  bool  $not
   * @return $this
   */
  public whereNull (
    columns: Expression | string | Array<Expression | string>,
    boolean: WhereBoolean | string = BOOLEAN_OPERATORS.and,
    not: boolean = false
  ): this {
    const type = not ? 'NotNull' : 'Null'

    for (const column of Arr.wrap(columns)) {
      this.wheres.push({ type, column, boolean })
    }

    return this
  }
}

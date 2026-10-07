import { dateFormat } from '@devnetic/utils'
import { cloneDeep, isNil, isPlainObject, snakeCase } from 'es-toolkit'

import type { ConditionExpression } from '../../Contracts/Database/Query/ConditionExpression'
import type { Scalar } from '../../Support/types'
import type { Connection } from '../Connection'
import type { Grammar } from '../Query/Grammars/Grammar'
import type { IndexHint } from './IndexHint'
import type { JoinClause } from './JoinClause'
import type { JoinLateralClause } from './JoinLateralClause'
import type { Processor } from './Processors'

import { Arr, Collection } from '../../Collections'
import { enumValue } from '../../Collections/functions'
import { head, last } from '../../Collections/helpers'
import { Conditionable } from '../../Conditionable/Traits/Conditionable'
import { Macroable } from '../../Macroable/Traits/Macroable'
import { DatePeriod, isSet, mixing, type Prettify } from '../../Support'
// import { registry } from './internal'
import { resolveClass } from '../../Support/class-registry'
import { changeKeyCase, isNumeric, tap, typedEntries } from '../../Support/helpers'
import { ForwardsCalls } from '../../Support/Traits'
import { BuildsQueries } from '../Concerns'
import { BuildsWhereDateClauses } from '../Concerns/BuildsWhereDateClauses'
import { Builder as EloquentBuilder } from '../Eloquent'
import { Relation } from '../Eloquent/Relations'
import { SortDirection, type SortDirectionType } from './Enums/SortDirection'
import { Expression } from './Expression'

export type BindingValue = string | number | boolean | Date | Expression | Record<string, unknown>

export type OrderClauseType = 'Basic' | 'Raw'

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
  'Exists' |
  'NotExists' |
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

export type HavingClauseType =

  | 'Basic' |
  'Bitwise' |
  'Expression' |
  'Nested' |
  'NotNull' |
  'Null' |
  'Raw' |
  'between' |
  'bit'

export type Having = {
  type: HavingClauseType
  column?: string | Expression | ConditionExpression | QueryCallback
  operator?: string
  value?: unknown
  boolean: string
  sql?: string
  values?: string[]
  not?: boolean
  query?: Builder
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

export type JoinType = 'inner' | 'left' | 'right' | 'cross'

export type QueryCallback = (query: Builder) => unknown
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
export interface Builder
  extends
  BuildsQueries,
  BuildsWhereDateClauses,
  Macroable,
  ForwardsCalls,
  Conditionable { }

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class Builder extends mixing().useTrait([
  BuildsWhereDateClauses,
  BuildsQueries,
  Macroable,
  ForwardsCalls,
  Conditionable
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
  public groups: Array<Expression | string> = []

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
   * The callbacks that should be invoked before the query is executed.
   *
   * @var array
   */
  public beforeQueryCallbacks: QueryCallback[] = []

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

    // return instanceProxy(this)
  }

  /**
   * Insert a new record and get the value of the primary key.
   *
   * @param  string|null  $sequence
   * @return int
   */
  public insertGetId (
    values: BindingValues,
    sequence: string | undefined = undefined
  ): number {
    this.applyBeforeQueryCallbacks()

    const sql = this.grammar.compileInsertGetId(this, values, sequence)

    const cleanedValues = this.cleanBindings(values)

    return this.processor.processInsertGetId(this, sql, cleanedValues, sequence)
  }

  // /**
  //  * Handle dynamic method calls into the method.
  //  *
  //  * @param  string  $method
  //  * @param  array  $parameters
  //  * @return mixed
  //  *
  //  * @throws \BadMethodCallException
  //  */
  // public __call(method: string, parameters: unknown[]): unknown {
  //   if (this.hasMacro(method)) {
  //     return this.macroCall(method, parameters);
  //   }

  //   if (method.startsWith('where')) {
  //     return this.dynamicWhere(method, Array.isArray(parameters) ? parameters : [parameters]);
  //   }

  //   this.throwBadMethodCallException(method);
  // }

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
   * Put the query's results in random order.
   *
   * @param  string|int  $seed
   * @return $this
   */
  public inRandomOrder (seed: string | number = ''): this {
    return this.orderByRaw(this.grammar.compileRandom(seed))
  }

  /**
   * Add an "order by" clause to order results by a given sequence of values.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression|string  column
   * @param  Arrayable<unknown> | Array<unknown>  values
   * @return $this
   */
  public inOrderOf (column: Expression | string, values: BindingValues): this {
    values = values.map((value) => value)

    if (values.length === 0) {
      return this
    }

    // Support for union orders vs. regular orders
    const orderType = this.unions.length > 0 ? 'unionOrders' : 'orders'

    this[orderType].push({
      type: 'InOrderOf',
      column,
      values
    })

    this.addBinding(
      this.cleanBindings(values),
      this.unions.length > 0 ? 'unionOrder' : 'order'
    )

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
    boolean: WhereBoolean = 'and'
  ): this {
    if (Object.keys(BOOLEAN_OPERATORS).includes(operator as string)) {
      boolean = operator as WhereBoolean
    }

    // If the column is an array, we will assume it is an array of key-value pairs
    // and can add them each as a where clause. We will maintain the boolean we
    // received when the method was called and pass it into the nested where.
    if (Array.isArray(first) || isPlainObject(first)) {
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
    column: Record<string, unknown>,
    boolean: WhereBoolean,
    method: 'where' | 'whereColumn' = 'where'
  ): this {
    // const whereBoolean: WhereBoolean =
    //   boolean === 'or' || boolean === 'and not' || boolean === 'or not'
    //     ? boolean
    //     : BOOLEAN_OPERATORS.and

    // return this.whereNested((query: Builder) => {
    //   for (const [key, entry] of Object.entries(column)) {
    //     if (isNumeric(key) && Array.isArray(entry)) {
    //       if (method === 'whereColumn') {
    //         query.whereColumn(
    //           String(entry[0] ?? ''),
    //           typeof entry[1] === 'string' ? entry[1] : undefined,
    //           typeof entry[2] === 'string' ? entry[2] : undefined,
    //           boolean
    //         )
    //       } else {
    //         query.where(entry[0], entry[1], entry[2], whereBoolean)
    //       }
    //     } else if (method === 'whereColumn') {
    //       query.whereColumn(
    //         key,
    //         '=',
    //         typeof entry === 'string' || entry instanceof Expression
    //           ? entry
    //           : String(entry),
    //         boolean
    //       )
    //     } else {
    //       query.where(key, '=', entry, whereBoolean)
    //     }
    //   }
    // }, boolean)
    return this.whereNested((query: Builder) => {
      for (const [key, value] of Object.entries(column)) {
        if (isNumeric(key) && Array.isArray(value)) {
          if (value.length < 3) {
            query[method](value[0], value[1], undefined, boolean)
          } else {
            query[method](value[0], value[1], value[2], boolean)
          }
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
  public whereNested (
    callback: QueryCallback,
    boolean: WhereBoolean = 'and'
  ): this {
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
  public addNestedWhereQuery (
    query: Builder,
    boolean: WhereBoolean = 'and'
  ): this {
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
   * Add a "having" clause to the query.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression|\Closure|string  $column
   * @param  \DateTimeInterface|string|int|float|null  $operator
   * @param  \Illuminate\Contracts\Database\Query\Expression|\DateTimeInterface|string|int|float|null  $value
   * @param  string  $boolean
   * @return $this
   */
  public having (
    column: Expression | QueryCallback | string,
    operator: unknown = undefined,
    value: unknown = undefined,
    boolean: BooleanOperator = 'and'
  ): this {
    let type: HavingClauseType = 'Basic'

    if (column instanceof Expression) {
      type = 'Expression'

      this.havings.push({ type, column, boolean })

      return this
    }

    // Here we will make some assumptions about the operator. If only 2 values are
    // passed to the method, we will assume that the operator is an equals sign
    // and keep going. Otherwise, we'll require the operator to be passed in.
    ;[value, operator] = this.prepareValueAndOperator(
      value,
      operator,
      arguments.length === 2
    )

    if (typeof column === 'function' && operator === undefined) {
      return this.havingNested(column, boolean)
    }

    // If the given operator is not found in the list of valid operators we will
    // assume that the developer is just short-cutting the '=' operators and
    // we will set the operators to '=' and set the values appropriately.
    if (this.invalidOperator(operator)) {
      ;[value, operator] = [operator, '=']
    }

    if (this.isBitwiseOperator(operator)) {
      type = 'Bitwise'
    }

    const having: Having = {
      type,
      column,
      value,
      boolean
    }

    if (typeof operator === 'string') {
      having.operator = operator
    }

    this.havings.push(having)

    if (!(value instanceof Expression)) {
      this.addBinding(this.flattenValue(value), 'having')
    }

    return this
  }

  /**
   * Add an "or having" clause to the query.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression|\Closure|string  $column
   * @param  \DateTimeInterface|string|int|float|null  $operator
   * @param  \Illuminate\Contracts\Database\Query\Expression|\DateTimeInterface|string|int|float|null  $value
   * @return $this
   */
  public orHaving (
    column: Expression | string,
    operator: unknown = undefined,
    value: unknown = undefined
  ): this {
    ;[value, operator] = this.prepareValueAndOperator(
      value,
      operator,
      arguments.length === 2
    )

    return this.having(column, operator, value, 'or')
  }

  /**
   * Increment the given column's values by the given amounts.
   *
   * @param  array<string, float|int|numeric-string>  $columns
   * @param  array<string, mixed>  $extra
   * @return int<0, max>
   *
   * @throws \InvalidArgumentException
   */
  public incrementEach (
    columns: Record<string, number | string>,
    extra: Record<string, unknown> = {}
  ): number {
    for (const [column, amount] of Object.entries(columns)) {
      if (!isNumeric(amount)) {
        throw new Error(
          `InvalidArgumentException: Non-numeric value passed as increment amount for column: '${column}'.`
        )
        // } else if (typeof column !== 'string') {
      } else if (isNumeric(column)) {
        throw new Error(
          'InvalidArgumentException: Non-associative array passed to incrementEach method.'
        )
      }

      columns[column] = this.raw(`${this.grammar.wrap(column)} + ${amount}`)
    }

    return this.update(Object.assign(columns, extra))
  }

  /**
   * Add an "exists" clause to the query.
   *
   * @param  \Closure|\Illuminate\Database\Query\Builder|\Illuminate\Database\Eloquent\Builder<*>  $callback
   * @param  string  $boolean
   * @param  bool  $not
   * @return $this
   */
  public whereExists (
    callback: QueryCallback | Builder | EloquentBuilder,
    boolean: BooleanOperator = BOOLEAN_OPERATORS.and,
    not: boolean = false
  ): this {
    let query: Builder

    if (callback instanceof Function) {
      query = this.forSubQuery()

      // Similar to the sub-select clause, we will create a new query instance so
      // the developer may cleanly specify the entire exists query and we will
      // compile the whole thing in the grammar and insert it into the SQL.
      callback(query)
    } else {
      query = callback instanceof EloquentBuilder ? callback.toBase() : callback
    }

    return this.addWhereExistsQuery(query, boolean, not)
  }

  /**
   * Add a "where not exists" clause to the query.
   *
   * @param  \Closure|\Illuminate\Database\Query\Builder|\Illuminate\Database\Eloquent\Builder<*>  $callback
   * @param  string  $boolean
   * @return $this
   */
  public whereNotExists (
    callback: QueryCallback | Builder | EloquentBuilder,
    boolean: BooleanOperator = BOOLEAN_OPERATORS.and
  ): this {
    return this.whereExists(callback, boolean, true)
  }

  /**
   * Add an "or where not exists" clause to the query.
   *
   * @param  \Closure|\Illuminate\Database\Query\Builder|\Illuminate\Database\Eloquent\Builder<*>  $callback
   * @return $this
   */
  public orWhereNotExists (
    callback: QueryCallback | Builder | EloquentBuilder
  ): this {
    return this.orWhereExists(callback, true)
  }

  /**
   * Add an "or where exists" clause to the query.
   *
   * @param  \Closure|\Illuminate\Database\Query\Builder|\Illuminate\Database\Eloquent\Builder<*>  $callback
   * @param  bool  $not
   * @return $this
   */
  public orWhereExists (
    callback: QueryCallback | Builder | EloquentBuilder,
    not: boolean = false
  ): this {
    return this.whereExists(callback, BOOLEAN_OPERATORS.or, not)
  }

  /**
   * Add a "lateral join" clause to the query.
   *
   * @param  \Closure|\Illuminate\Database\Query\Builder|\Illuminate\Database\Eloquent\Builder<*>|string  $query
   * @return $this
   */
  public joinLateral (
    query: QueryCallback | Builder | EloquentBuilder | string,
    as: string,
    type: JoinType = 'inner'
  ): this {
    const [subQuery, bindings] = this.createSub(query)

    const expression = '(' + subQuery + ') as ' + this.grammar.wrapTable(as)

    this.addBinding(bindings, 'join')

    this.joins.push(
      this.newJoinLateralClause(this, type, new Expression(expression))
    )

    return this
  }

  /**
   * Add a "cross join" clause to the query.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression|string  $table
   * @param  \Closure|\Illuminate\Contracts\Database\Query\Expression|string|null  $first
   * @param  string|null  $operator
   * @param  \Illuminate\Contracts\Database\Query\Expression|string|null  $second
   * @return $this
   */
  public crossJoin (
    table: string,
    first: string | Expression | undefined = undefined,
    operator: string | undefined = undefined,
    second: string | Expression | undefined = undefined
  ): this {
    if (first) {
      return this.join(table, first, operator, second, 'cross')
    }

    this.joins.push(this.newJoinClause(this, 'cross', table))

    return this
  }

  /**
   * Get a new "join lateral" clause.
   *
   * @param  string  $type
   * @param  \Illuminate\Contracts\Database\Query\Expression|string  $table
   * @return \Illuminate\Database\Query\JoinLateralClause
   */
  protected newJoinLateralClause (
    parentQuery: Builder,
    type: string,
    table: Expression | string
  ): JoinLateralClause {
    // return new JoinLateralClause(parentQuery, type, table);
    const JoinLateralClauseCtor =
      resolveClass<JoinLateralClause>('JoinLateralClause')
    return new JoinLateralClauseCtor(parentQuery, type, table)
  }

  /**
   * Handles dynamic "where" clauses to the query.
   *
   * @param  string  $method
   * @param  array  $parameters
   * @return $this
   */
  public dynamicWhere (method: string, parameters: unknown[]): this {
    const finder = method.substring(5)

    const segments = finder.split(/(And|Or)(?=[A-Z])/)

    // The connector variable will determine which connector will be used for the
    // query condition. We will change it as we come across new boolean values
    // in the dynamic method strings, which could contain a number of these.
    let connector = 'and'

    let index = 0

    for (const segment of segments) {
      // If the segment is not a boolean connector, we can assume it is a column's name
      // and we will add it to the query as a new constraint as a where clause, then
      // we can keep iterating through the dynamic method string's segments again.
      if (segment !== 'And' && segment !== 'Or') {
        this.addDynamic(segment, connector, parameters, index)

        index++
      } else {
        // Otherwise, we will store the connector so we know how the next where clause we
        // find in the query should be connected to the previous ones, meaning we will
        // have the proper boolean connector to connect the next where clause found.
        connector = segment
      }
    }

    return this
  }

  /**
   * Add a single dynamic "where" clause statement to the query.
   *
   * @param  string  $segment
   * @param  string  $connector
   * @param  array  $parameters
   * @param  int  $index
   * @return void
   */
  protected addDynamic (
    segment: string,
    connector: string,
    parameters: unknown[],
    index: number
  ): void {
    // Once we have parsed out the columns and formatted the boolean operators we
    // are ready to add it to this query as a where clause just like any other
    // clause on the query. Then we'll increment the parameter index values.
    const bool = connector.toLowerCase()

    this.where(snakeCase(segment), '=', parameters[index], bool)
  }

  /**
   * Add a subquery cross join to the query.
   *
   * @param  \Closure|\Illuminate\Database\Query\Builder|\Illuminate\Database\Eloquent\Builder<*>|string  $query
   * @param  string  $as
   * @return $this
   */
  public crossJoinSub (
    query: QueryCallback | Builder | EloquentBuilder | string,
    as: string
  ): this {
    const [subQuery, bindings] = this.createSub(query)

    const expression = '(' + subQuery + ') as ' + this.grammar.wrapTable(as)

    this.addBinding(bindings, 'join')

    this.joins.push(
      this.newJoinClause(this, 'cross', new Expression(expression))
    )

    return this
  }

  /**
   * Add a "subquery join" clause to the query.
   *
   * @param  \Closure|\Illuminate\Database\Query\Builder|\Illuminate\Database\Eloquent\Builder<*>|string  $query
   * @param  string  $as
   * @param  \Closure|\Illuminate\Contracts\Database\Query\Expression|string  $first
   * @param  string|null  $operator
   * @param  \Illuminate\Contracts\Database\Query\Expression|string|null  $second
   * @param  string  $type
   * @param  bool  $where
   * @return $this
   *
   * @throws \InvalidArgumentException
   */
  public joinSub (
    query: QueryCallback | Builder | EloquentBuilder | string,
    as: string,
    first: string | Expression,
    operator: string | undefined = undefined,
    second: string | Expression | undefined = undefined,
    type: 'inner' | 'left' | 'right' = 'inner',
    where: boolean = false
  ): this {
    const [subQuery, bindings] = this.createSub(query)

    const expression = '(' + subQuery + ') as ' + this.grammar.wrapTable(as)

    this.addBinding(bindings, 'join')

    return this.join(
      new Expression(expression),
      first,
      operator,
      second,
      type,
      where
    )
  }

  /**
   * Add a subquery left join to the query.
   *
   * @param  \Closure|\Illuminate\Database\Query\Builder|\Illuminate\Database\Eloquent\Builder<*>|string  $query
   * @param  string  $as
   * @param  \Closure|\Illuminate\Contracts\Database\Query\Expression|string  $first
   * @param  string|null  $operator
   * @param  \Illuminate\Contracts\Database\Query\Expression|string|null  $second
   * @return $this
   */
  public leftJoinSub (
    query: QueryCallback | Builder | EloquentBuilder | string,
    as: string,
    first: string | Expression,
    operator: string | undefined = undefined,
    second: string | Expression | undefined = undefined
  ): this {
    return this.joinSub(query, as, first, operator, second, 'left')
  }

  /**
   * Add a straight join to the query.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression|string  $table
   * @param  \Closure|string  $first
   * @param  string|null  $operator
   * @param  \Illuminate\Contracts\Database\Query\Expression|string|null  $second
   * @return $this
   */
  public straightJoin (
    table: string,
    first: string | Expression,
    operator: string | undefined = undefined,
    second: string | Expression | undefined = undefined
  ): this {
    return this.join(table, first, operator, second, 'straight_join')
  }

  /**
   * Execute the query and get the first result.
   *
   * @param  array|string  $columns
   * @return TValue|null
   */
  public async first (
    columns: string | Expression | string[] = ['*']
  ): Promise<Record<string, unknown> | undefined> {
    const result = await this.limit(1).get(columns)

    return result.first()
  }

  /**
   * Get a collection instance containing the values of a given column.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression|string  $column
   * @param  string|null  $key
   * @return \Illuminate\Support\Collection<array-key, mixed>
   */
  public async pluck (
    column: string | Expression,
    key: string | undefined = undefined
  ): Collection<unknown> {
    // First, we will need to select the results of the query accounting for the
    // given columns / key. Once we have the results, we will be able to take
    // the results and get the exact data that was requested for the query.
    const queryResult = await this.onceWithColumns(
      isNil(key) || key === column ? [column] : [column, key],
      async () => {
        return this.processor.processSelect(this, await this.runSelect())
      }
    )

    if (queryResult.length === 0) {
      return new Collection()
    }

    // If the columns are qualified with a table or have an alias, we cannot use
    // those directly in the "pluck" operations since the results from the DB
    // are only keyed by the column itself. We'll strip the table out here.
    const strippedColumn = this.stripTableForPluck(column)

    const strippedKey = this.stripTableForPluck(key)

    return this.applyAfterQueryCallbacks(
      Array.isArray(queryResult[0])
        ? this.pluckFromArrayColumn(queryResult, strippedColumn, strippedKey)
        : this.pluckFromObjectColumn(queryResult, strippedColumn, strippedKey)
    )
  }

  /**
   * Strip off the table name or alias from a column identifier.
   *
   * @param  string  $column
   * @return string|null
   */
  protected stripTableForPluck (
    column: string | Expression
  ): string | undefined {
    if (isNil(column)) {
      return column
    }

    const columnString =
      column instanceof Expression ? this.grammar.getValue(column) : column

    const separator = columnString.toLowerCase().includes(' as ')
      ? ' as '
      : '\\.'

    return last(columnString.split(new RegExp(`~${separator}~i`)))
  }

  /**
   * Retrieve column values from rows represented as objects.
   *
   * @param  array  $queryResult
   * @param  string  $column
   * @param  string  $key
   * @return \Illuminate\Support\Collection
   */
  protected pluckFromObjectColumn (
    queryResult: Record<string, unknown>[],
    column: string | Expression,
    key: string | undefined = undefined
  ): Collection<string | number, unknown> {
    const columnName = String(column)

    if (isNil(key)) {
      return new Collection(queryResult.map((row) => row[columnName]))
    }

    const results: Record<string | number, unknown> = {}

    for (const row of queryResult) {
      results[String(row[key])] = row[columnName]
    }

    return new Collection(results)
  }

  /**
   * Get a single expression value from the first result of a query.
   *
   * @param  literal-string  $expression
   * @return mixed
   */
  public async rawValue (
    expression: string,
    bindings: BindingValues = []
  ): Promise<unknown | undefined> {
    const result = await this.selectRaw(expression, bindings).first()

    return !Array.isArray(result) ? Object.values(result)[0] : undefined
  }

  /**
   * Get a single column's value from the first result of a query.
   *
   * @param  string  $column
   * @return mixed
   */
  public async value (
    column: string | Expression
  ): Promise<unknown | undefined> {
    const result = await this.first([column])

    return !Array.isArray(result) ? Object.values(result)[0] : undefined
  }

  /**
   * Concatenate values of a given column as a string.
   *
   * @param  string  $column
   * @param  string  $glue
   * @return string
   */
  public async implode (
    column: string | Expression,
    glue: string = ''
  ): Promise<string> {
    const results = await this.pluck(column)

    return results.implode(glue)
  }

  /**
   * Retrieve column values from rows represented as arrays.
   *
   * @param  array  $queryResult
   * @param  string  $column
   * @param  string  $key
   * @return \Illuminate\Support\Collection
   */
  protected pluckFromArrayColumn (
    queryResult: unknown[][],
    column: string | Expression,
    key: string | null = null
  ): Collection<string | number, unknown> {
    const results: unknown[] = []

    if (isNil(key)) {
      for (const row of queryResult) {
        results.push(row[column])
      }
    } else {
      for (const row of queryResult) {
        results[row[key]] = row[column]
      }
    }

    return new Collection(results)
  }

  /**
   * Execute a query for a single record by ID.
   *
   * @param  int|string  $id
   * @param  string|\Illuminate\Contracts\Database\Query\Expression|array<string|\Illuminate\Contracts\Database\Query\Expression>  $columns
   * @return \stdClass|null
   */
  public find (
    id: number | string,
    columns: string | Expression | string[] = ['*']
  ): Record<string, unknown> | null {
    return this.where('id', '=', id).first(columns)
  }

  /**
   * Execute a query for a single record by ID or call a callback.
   *
   * @template TValue
   *
   * @param  mixed  $id
   * @param  (\Closure(): TValue)|string|\Illuminate\Contracts\Database\Query\Expression|array<string|\Illuminate\Contracts\Database\Query\Expression>  $columns
   * @param  (\Closure(): TValue)|null  $callback
   * @return \stdClass|TValue
   */
  public async findOr (
    id: number | string,
    columns: string | Expression | string[] = ['*'],
    callback?: CallableFunction
  ): Promise<PropertyKey | unknown | undefined> {
    if (typeof columns === 'function') {
      callback = columns

      columns = ['*']
    }

    const data = await this.find(id, columns)

    if (!isNil(data)) {
      return data
    }

    return callback()
  }

  /**
   * Add a "straight join where" clause to the query.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression|string  $table
   * @param  \Closure|\Illuminate\Contracts\Database\Query\Expression|string  $first
   * @param  string  $operator
   * @param  \Illuminate\Contracts\Database\Query\Expression|string  $second
   * @return $this
   */
  public straightJoinWhere (
    table: string,
    first: string | Expression,
    operator: string,
    second: string | Expression
  ): this {
    return this.joinWhere(table, first, operator, second, 'straight_join')
  }

  /**
   * Add a subquery straight join to the query.
   *
   * @param  \Closure|\Illuminate\Database\Query\Builder|\Illuminate\Database\Eloquent\Builder<*>|string  $query
   * @param  string  $as
   * @param  \Closure|\Illuminate\Contracts\Database\Query\Expression|string  $first
   * @param  string|null  $operator
   * @param  \Illuminate\Contracts\Database\Query\Expression|string|null  $second
   * @return $this
   */
  public straightJoinSub (
    query: QueryCallback | Builder | EloquentBuilder | string,
    as: string,
    first: string | Expression,
    operator: string | undefined = undefined,
    second: string | Expression | undefined = undefined
  ): this {
    return this.joinSub(query, as, first, operator, second, 'straight_join')
  }

  /**
   * Add a subquery right join to the query.
   *
   * @param  \Closure|\Illuminate\Database\Query\Builder|\Illuminate\Database\Eloquent\Builder<*>|string  $query
   * @param  string  $as
   * @param  \Closure|\Illuminate\Contracts\Database\Query\Expression|string  $first
   * @param  string|null  $operator
   * @param  \Illuminate\Contracts\Database\Query\Expression|string|null  $second
   * @return $this
   */
  public rightJoinSub (
    query: QueryCallback | Builder | EloquentBuilder | string,
    as: string,
    first: string | Expression,
    operator: string | undefined = undefined,
    second: string | Expression | undefined = undefined
  ): this {
    return this.joinSub(query, as, first, operator, second, 'right')
  }

  /**
   * Add a right join to the query.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression|string  $table
   * @param  \Closure|string  $first
   * @param  string|null  $operator
   * @param  \Illuminate\Contracts\Database\Query\Expression|string|null  $second
   * @return $this
   */
  public rightJoin (
    table: string,
    first: string | Expression,
    operator: string | undefined = undefined,
    second: string | Expression | undefined = undefined
  ): this {
    return this.join(table, first, operator, second, 'right')
  }

  /**
   * Add a "right join where" clause to the query.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression|string  $table
   * @param  \Closure|\Illuminate\Contracts\Database\Query\Expression|string  $first
   * @param  string  $operator
   * @param  \Illuminate\Contracts\Database\Query\Expression|string  $second
   * @return $this
   */
  public rightJoinWhere (
    table: string,
    first: string | Expression,
    operator: string,
    second: string | Expression
  ): this {
    return this.joinWhere(table, first, operator, second, 'right')
  }

  /**
   * Add a lateral left join to the query.
   *
   * @param  \Closure|\Illuminate\Database\Query\Builder|\Illuminate\Database\Eloquent\Builder<*>|string  $query
   * @return $this
   */
  public leftJoinLateral (
    query: QueryCallback | Builder | EloquentBuilder | string,
    as: string
  ): this {
    return this.joinLateral(query, as, 'left')
  }

  /**
   * Add a "join where" clause to the query.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression|string  $table
   * @param  \Closure|\Illuminate\Contracts\Database\Query\Expression|string  $first
   * @param  string  $operator
   * @param  \Illuminate\Contracts\Database\Query\Expression|string|null  $second
   * @return $this
   */
  public leftJoinWhere (
    table: string,
    first: string | Expression,
    operator: string,
    second: string | Expression | undefined = undefined
  ): this {
    return this.joinWhere(table, first, operator, second, 'left')
  }

  /**
   * Add a "join where" clause to the query.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression|string  $table
   * @param  \Closure|\Illuminate\Contracts\Database\Query\Expression|string  $first
   * @param  string  $operator
   * @param  \Illuminate\Contracts\Database\Query\Expression|string  $second
   * @param  string  $type
   * @return $this
   */
  public joinWhere (
    table: string,
    first: string | Expression,
    operator: string,
    second: string | Expression,
    type: 'inner' | 'left' = 'inner'
  ): this {
    return this.join(table, first, operator, second, type, true)
  }

  /**
   * Add a left join to the query.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression|string  $table
   * @param  \Closure|\Illuminate\Contracts\Database\Query\Expression|string  $first
   * @param  string|null  $operator
   * @param  \Illuminate\Contracts\Database\Query\Expression|string|null  $second
   * @return $this
   */
  public leftJoin (
    table: string,
    first: string | Expression,
    operator: string | undefined = undefined,
    second: string | Expression | undefined = undefined
  ): this {
    return this.join(table, first, operator, second, 'left')
  }

  /**
   * Add an "exists" clause to the query.
   *
   * @param  string  $boolean
   * @param  bool  $not
   * @return $this
   */
  public addWhereExistsQuery (
    query: Builder,
    boolean: BooleanOperator = BOOLEAN_OPERATORS.and,
    not: boolean = false
  ): this {
    const type = not ? 'NotExists' : 'Exists'

    this.wheres.push({ type, query, boolean })

    this.addBinding(query.getBindings(), 'where')

    return this
  }

  /**
   * Insert new records or update the existing ones.
   *
   * @param  non-empty-string|non-empty-array<int, non-empty-string>  $uniqueBy
   * @return int
   */
  public upsert (
    values: unknown[],
    uniqueBy: string | string[],
    update?: unknown[]
  ): Promise<number> {
    if (uniqueBy.length === 0 || uniqueBy === '') {
      throw new Error('InvalidArgumentException: The unique columns must not be empty.')
    }

    if (values.length === 0) {
      return 0
    } else if (update?.length === 0) {
      return this.insert(values)
    }

    // if (!Array.isArray(values[0])) {
    if (!Array.isArray(head(values)) && !isPlainObject(head(values))) {
      values = [values]
    } else {
      // for (const [key, value] of values.entries()) {
      //   ksort($value)

      //   values[key] = value
      // }
      for (const [key, value] of typedEntries(values)) {
        const sortedKeys = Object.keys(value).sort()
        const sortedValue = {}

        for (const key of sortedKeys) {
          sortedValue[key] = value[key]
        }

        values[key] = sortedValue
      }
    }

    if (update === undefined) {
      update = Object.keys(head(values))
    }

    this.applyBeforeQueryCallbacks()

    const bindings = this.cleanBindings([
      ...Arr.flatten(values, 1),
      ...(new Collection(update))
        .reject((value: unknown, key: number) => typeof key === 'number')
        .all()
    ])

    return this.connection.affectingStatement(
      this.grammar.compileUpsert(this, values, Array.isArray(uniqueBy) ? uniqueBy : [uniqueBy], update),
      bindings
    )
  }

  /**
   * Invoke the "before query" modification callbacks.
   *
   * @return void
   */
  public applyBeforeQueryCallbacks (): void {
    for (const callback of this.beforeQueryCallbacks) {
      callback(this)
    }

    this.beforeQueryCallbacks = []
  }

  /**
   * Create a raw database expression.
   *
   * @param  literal-string|int|float  $value
   * @return \Illuminate\Contracts\Database\Query\Expression
   */
  public raw (value: string | number | Expression): Expression {
    return this.connection.raw(value)
  }

  /**
   * Add a nested "having" statement to the query.
   *
   * @param  string  $boolean
   * @return $this
   */
  public havingNested (
    callback: QueryCallback,
    boolean: BooleanOperator = 'and'
  ): this {
    const query = this.forNestedWhere()
    callback(query)

    return this.addNestedHavingQuery(query, boolean)
  }

  /**
   * Add another query builder as a nested having to the query builder.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  string  $boolean
   * @return $this
   */
  public addNestedHavingQuery (
    query: Builder,
    boolean: BooleanOperator = 'and'
  ): this {
    if (query.havings.length > 0) {
      const type: HavingClauseType = 'Nested'

      this.havings.push({ type, query, boolean })

      this.addBinding(query.getRawBindings().having, 'having')
    }

    return this
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
    boolean: BooleanOperator = 'and',
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
    boolean: BooleanOperator = 'and'
  ): this {
    const type: WhereClauseType = 'NullSafeEquals'

    this.wheres.push({ type, column, value, boolean })

    if (!(value instanceof Expression)) {
      this.addBinding(this.flattenValue(value), 'where')
    }

    return this
  }

  /**
   * Add a "group by" clause to the query.
   *
   * @param  array|\Illuminate\Contracts\Database\Query\Expression|string  ...$groups
   * @return $this
   */
  public groupBy (
    ...groups: Array<Expression | string | Array<Expression | string>>
  ): this {
    for (const group of groups) {
      this.groups = [...this.groups, ...Arr.wrap(group)]
    }

    return this
  }

  /**
   * Add a raw "having" clause to the query.
   *
   * @param  literal-string  $sql
   * @param  string  $boolean
   * @return $this
   */
  public havingRaw (
    sql: string,
    bindings: unknown[] = [],
    boolean: BooleanOperator = 'and'
  ): this {
    const type: HavingClauseType = 'Raw'

    this.havings.push({ type, sql, boolean })

    this.addBinding(bindings, 'having')

    return this
  }

  /**
   * Add an "order by" clause for a timestamp to the query.
   *
   * @param  \Closure|\Illuminate\Database\Query\Builder|\Illuminate\Contracts\Database\Query\Expression|string  $column
   * @return $this
   */
  public latest (column: Expression | string = 'created_at'): this {
    return this.orderBy(column, SortDirection.Descending)
  }

  /**
   * Add an "order by" clause for a timestamp to the query.
   *
   * @param  \Closure|\Illuminate\Database\Query\Builder|\Illuminate\Contracts\Database\Query\Expression|string  $column
   * @return $this
   */
  public oldest (column: Expression | string = 'created_at'): this {
    return this.orderBy(column, SortDirection.Ascending)
  }

  /**
   * Add a raw "or having" clause to the query.
   *
   * @param  literal-string  $sql
   * @return $this
   */
  public orHavingRaw (sql: string, bindings: unknown[] = []): this {
    return this.havingRaw(sql, bindings, 'or')
  }

  /**
   * Add a raw "groupBy" clause to the query.
   *
   * @param  literal-string  $sql
   * @return $this
   */
  public groupByRaw (sql: string, bindings: unknown[] = []): this {
    this.groups.push(new Expression(sql))

    this.addBinding(bindings, 'groupBy')

    return this
  }

  /**
   * Add an "or where null" clause to the query.
   *
   * @param  string|array|\Illuminate\Contracts\Database\Query\Expression  $column
   * @return $this
   */
  public orWhereNull (
    column: Expression | string | Array<Expression | string>
  ): this {
    return this.whereNull(column, BOOLEAN_OPERATORS.or)
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
    boolean: BooleanOperator = 'and'
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
  public select (
    column: string | Expression | Array<string | Expression> = '*',
    ...columns: Array<string | Expression>
  ): this {
    const selected = Array.isArray(column) ? column : [column, ...columns]

    this.columns = []
    this.bindings.select = []

    for (const [as, value] of Object.entries(selected)) {
      if (typeof as === 'string' && this.isQueryable(value)) {
        this.selectSub(value, as)
      } else {
        this.columns.push(value)
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
    boolean: BooleanOperator = 'and',
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

    // `cloneWithout()` clears selected columns by setting the property to
    // undefined. An empty list is the unset state for a fresh builder.
    if (original === undefined || original.length === 0) {
      this.columns = columns
    }

    const result = callback()

    this.columns = original

    return result
  }

  /**
   * Determine if any rows exist for the current query.
   *
   * @return bool
   */
  public async exists (): Promise<boolean> {
    this.applyBeforeQueryCallbacks()

    const results = await this.connection.select(
      this.grammar.compileExists(this),
      this.getBindings()
    )

    // If the results have rows, we will get the row and see if the exists column is a
    // boolean true. If there are no results for this query we will return false as
    // there are no rows for this query at all, and we can return that info here.
    if (results.length > 0) {
      const result = results[0]

      return Boolean(result.exists)
    }

    return false
  }

  /**
   * Retrieve the minimum value of a given column.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression|string  $column
   * @return mixed
   */
  public async min (column: Expression | string): Promise<number> {
    return this.aggregate('min', [column])
  }

  /**
   * Retrieve the maximum value of a given column.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression|string  $column
   * @return mixed
   */
  public async max (column: Expression | string): Promise<number> {
    return this.aggregate('max', [column])
  }

  /**
   * Retrieve the sum of the values of a given column.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression|string  $column
   * @return mixed
   */
  public async sum (column: Expression | string): Promise<number> {
    const result = await this.aggregate('sum', [column])

    return result ? Number(result) : 0
  }

  /**
   * Retrieve the average of the values of a given column.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression|string  $column
   * @return mixed
   */
  public async avg (column: Expression | string): Promise<number> {
    return this.aggregate('avg', [column])
  }

  /**
   * Alias for the "avg" method.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression|string  $column
   * @return mixed
   */
  public async average (column: Expression | string): Promise<number> {
    return this.avg(column)
  }

  /**
   * Determine if no rows exist for the current query.
   *
   * @return bool
   */
  public async doesntExist (): Promise<boolean> {
    const exists = await this.exists()

    return !exists
  }

  /**
   * Execute the given callback if no rows exist for the current query.
   *
   * @return mixed
   */
  public async existsOr (callback: () => Promise<unknown>): Promise<boolean> {
    const exists = await this.exists()

    if (exists) {
      return true
    }

    return callback()
  }

  /**
   * Execute the given callback if rows exist for the current query.
   *
   * @return mixed
   */
  public async doesntExistOr (
    callback: () => Promise<unknown>
  ): Promise<boolean> {
    const doesntExist = await this.doesntExist()

    if (doesntExist) {
      return true
    }

    return callback()
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
    column: QueryCallback | Builder | EloquentBuilder | Expression | string,
    direction: SortDirectionType = SortDirection.Ascending
  ): this {
    if (this.isQueryable(column)) {
      const [query, bindings] = this.createSub(column)

      column = new Expression('(' + query + ')')

      this.addBinding(bindings, this.unions.length > 0 ? 'unionOrder' : 'order')
    }

    switch (direction) {
      case SortDirection.Ascending.toLowerCase():
        direction = SortDirection.Ascending
        break

      case SortDirection.Descending.toLowerCase():
        direction = SortDirection.Descending
        break

      default:
        throw new Error(
          'InvalidArgumentException: Order direction must be a SortDirection, "asc" or "desc".'
        )
    }

    const order = { column, direction }

    if (this.unions.length > 0) {
      this.unionOrders.push(order)
    } else {
      this.orders.push(order)
    }

    return this
  }

  /**
   * Add a "having null" clause to the query.
   *
   * @param  string|array|\Illuminate\Contracts\Database\Query\Expression  $columns
   * @param  string  $boolean
   * @param  bool  $not
   * @return $this
   */
  public havingNull (
    columns: Expression | string | Array<Expression | string>,
    boolean: BooleanOperator = 'and',
    not: boolean = false
  ): this {
    const type: HavingClauseType = not ? 'NotNull' : 'Null'

    for (const column of Arr.wrap(columns)) {
      this.havings.push({ type, column, boolean })
    }

    return this
  }

  /**
   * Add an "or having null" clause to the query.
   *
   * @param  string  $column
   * @return $this
   */
  public orHavingNull (
    column: Expression | string | Array<Expression | string>
  ): this {
    return this.havingNull(column, 'or')
  }

  /**
   * Add a "having not null" clause to the query.
   *
   * @param  string|array  $columns
   * @param  string  $boolean
   * @return $this
   */
  public havingNotNull (
    columns: Expression | string | Array<Expression | string>,
    boolean: BooleanOperator = 'and'
  ): this {
    return this.havingNull(columns, boolean, true)
  }

  /**
   * Add an "or having not null" clause to the query.
   *
   * @param  string  $column
   * @return $this
   */
  public orHavingNotNull (
    column: Expression | string | Array<Expression | string>
  ): this {
    return this.havingNotNull(column, 'or')
  }

  /**
   * Add a "having between" clause to the query.
   *
   * @param  string  $column
   * @param  string  $boolean
   * @param  bool  $not
   * @return $this
   */
  /**
   * Add a "having between" clause to the query.
   *
   * @param  string  column
   * @param  Iterable<any>  values
   * @param  string  boolean
   * @param  boolean  not
   * @return this
   */
  public havingBetween (
    column: string,
    values: unknown[] | Iterable<unknown>,
    boolean: BooleanOperator = 'and',
    not: boolean = false
  ): this {
    const type = 'between'

    // Handle possible DatePeriod objects for values, if supported in your environment.
    if (values instanceof DatePeriod) {
      values = this.resolveDatePeriodBounds(values)
    }

    // Normalize to array
    const valueArray = Array.isArray(values) ? values : Array.from(values)

    this.havings.push({ type, column, values: valueArray, boolean, not })

    // Only keep first two bindings, as 'between' only takes two bounds.
    const cleaned = this.cleanBindings(valueArray.flat())
    this.addBinding(cleaned.slice(0, 2), 'having')

    return this
  }

  /**
   * Add a descending "order by" clause to the query.
   *
   * @param  \Closure|\Illuminate\Database\Query\Builder|\Illuminate\Database\Eloquent\Builder<*>|\Illuminate\Contracts\Database\Query\Expression|string  $column
   * @return $this
   */
  public orderByDesc (column: QueryCallback | Expression | string): this {
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
    const offset = Math.max(
      0,
      value !== undefined ? parseInt(String(value), 10) : 0
    )

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
   * Add a raw "order by" clause to the query.
   *
   * @param  literal-string  $sql
   * @param  array  $bindings
   * @return $this
   */
  public orderByRaw (sql: string, bindings: unknown[] = []): this {
    const type: OrderClauseType = 'Raw'

    const orderProperty = this.unions.length > 0 ? 'unionOrders' : 'orders'

    this[orderProperty].push({ type, sql })

    this.addBinding(bindings, this.unions.length > 0 ? 'unionOrder' : 'order')

    return this
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
    operator: string | undefined = undefined,
    value: string | number | Expression | undefined = undefined,
    boolean: WhereBoolean = BOOLEAN_OPERATORS.and
  ): this {
    if (column instanceof Expression) {
      const type = 'Expression'

      this.wheres.push({ type, column, boolean })

      return this
    }

    if (Object.keys(BOOLEAN_OPERATORS).includes(operator as string)) {
      boolean = operator as WhereBoolean
    }

    // If the column is an array, we will assume it is an array of key-value pairs
    // and can add them each as a where clause. We will maintain the boolean we
    // received when the method was called and pass it into the nested where.
    if (Array.isArray(column) || isPlainObject(column)) {
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
    value: string | number | Expression | undefined,
    operator: string | undefined,
    useDefault: boolean = false
  ): [string | number | Expression | undefined, string | undefined] {
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
    column: Expression | Scalar | Array<Expression | Scalar> | QueryCallback,
    operator?: string | undefined,
    value?: string | number | Expression | undefined,
    boolean: BooleanOperator = BOOLEAN_OPERATORS.and
  ): this {
    if (Array.isArray(column) || isPlainObject(column)) {
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
    value: string | number | Expression | undefined
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
    operator: string | undefined,
    value: string | number | Expression | undefined,
    boolean: BooleanOperator = 'and'
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
   * Merge an array of bindings into our bindings.
   *
   * @param  self  $query
   * @return $this
   */
  public mergeBindings (query: Builder): this {
    this.bindings = { ...this.bindings, ...query.bindings }

    return this
  }

  /**
   * Set the limit and offset for a given page.
   *
   * @param  int  $page
   * @param  int  $perPage
   * @return $this
   */
  public forPage (page: number, perPage: number = 15): this {
    return this.offset((page - 1) * perPage).limit(perPage)
  }

  /**
   * Constrain the query to the previous "page" of results before a given ID.
   *
   * @param  int  $perPage
   * @param  int|null  $lastId
   * @param  string  $column
   * @return $this
   */
  public forPageBeforeId (
    perPage: number = 15,
    lastId: number | undefined,
    column: string = 'id'
  ): this {
    this.orders = this.removeExistingOrdersFor(column)

    if (lastId === undefined) {
      this.whereNotNull(column)
    } else {
      this.where(column, '<', lastId)
    }

    return this.orderBy(column, SortDirection.Descending).limit(perPage)
  }

  /**
   * Constrain the query to the next "page" of results after a given ID.
   *
   * @param  int  $perPage
   * @param  int|null  $lastId
   * @param  string  $column
   * @return $this
   */
  public forPageAfterId (
    perPage: number = 15,
    lastId: number | undefined,
    column: string = 'id'
  ): this {
    this.orders = this.removeExistingOrdersFor(column)

    if (lastId === undefined) {
      this.whereNotNull(column)
    } else {
      this.where(column, '>', lastId)
    }

    return this.orderBy(column, SortDirection.Ascending).limit(perPage)
  }

  /**
   * Get an array with all orders with a given column removed.
   *
   * @param  string  $column
   * @return array
   */
  protected removeExistingOrdersFor (column: string): Order[] {
    const orders = new Collection(this.orders)
      .reject((order: Order) => order.column === column)
      .values()
      .all()

    return Array.isArray(orders) ? orders : Object.values(orders)
  }

  /**
   * Get the count of the total records for the paginator.
   *
   * @param  array<string|\Illuminate\Contracts\Database\Query\Expression>  $columns
   * @return int<0, max>
   */
  public async getCountForPagination (
    columns: string[] = ['*']
  ): Promise<number> {
    const results = await this.runPaginationCountQuery(columns)

    // Once we have run the pagination count query, we will get the resulting count and
    // take into account what type of query it was. When there is a group by we will
    // just return the count of the entire results set since that will be correct.
    if (results.length === 0) {
      return 0
    } else if (results[0] instanceof Object) {
      return parseInt(String(results[0].aggregate), 10)
    }

    return parseInt(String(changeKeyCase(results[0].aggregate)), 10)
  }

  /**
   * Run a pagination count query.
   *
   * @param  array<string|\Illuminate\Contracts\Database\Query\Expression>  $columns
   * @return array<string | number | Expression>
   */
  protected async runPaginationCountQuery (
    columns: string[] = ['*']
  ): Promise<Array<string | number | Expression>> {
    if (this.groups.length > 0 || this.havings.length > 0) {
      const clone = this.cloneForPaginationCount()

      if (clone.columns === undefined && this.joins.length > 0) {
        clone.select(`${this.from}.*`)
      }

      const result = await this.newQuery()
        .from(
          new Expression(
            `(${clone.toSql()}) as ${this.grammar.wrap('aggregate_table')}`
          )
        )
        .mergeBindings(clone)
        .setAggregate('count', this.withoutSelectAliases(columns))
        .get()

      return result.all() as Array<string | number | Expression>
    }

    const without = this.unions
      ? ['unionOrders', 'unionLimit', 'unionOffset']
      : ['columns', 'orders', 'limit', 'offset']

    const result = await this.cloneWithout(without)
      .cloneWithoutBindings(this.unions ? ['unionOrder'] : ['select', 'order'])
      .setAggregate('count', this.withoutSelectAliases(columns))
      .get()

    return result.all() as Array<string | number | Expression>
  }

  /**
   * Clone the existing query instance for usage in a pagination subquery.
   *
   * @return self
   */
  protected cloneForPaginationCount (): this {
    return this.cloneWithout([
      'orders',
      'limit',
      'offset'
    ]).cloneWithoutBindings(['order'])
  }

  /**
   * Remove the column aliases since they will break count queries.
   *
   * @param  array<string|\Illuminate\Contracts\Database\Query\Expression>  $columns
   * @return array<string|\Illuminate\Contracts\Database\Query\Expression>
   */
  protected withoutSelectAliases (
    columns: Array<string | Expression>
  ): Array<string | Expression> {
    return columns.map((column: string | Expression) => {
      if (typeof column === 'string') {
        const aliasPosition = column.indexOf(' as ')
        if (aliasPosition !== -1) {
          return column.substring(0, aliasPosition)
        }
      }

      return column
    })
  }

  /**
   * Update records in the database.
   *
   * @return int<0, max>
   */
  public update (values: Record<string, unknown>): Promise<number> {
    this.applyBeforeQueryCallbacks()

    const compiledValues = (new Collection(values)).map((value: unknown) => {
      if (
        !(value instanceof Builder) &&
        !(value instanceof EloquentBuilder) &&
        !(value instanceof Relation)
      ) {
        const bindings = value instanceof Collection ? value.all() : value

        return { value, bindings }
      }

      const [query, bindings] = this.parseSub(value)

      return { value: new Expression(`(${query})`), bindings: () => bindings }
    })

    const sql = this.grammar.compileUpdate(
      this,
      compiledValues.map((value: { value: Expression }) => value.value).all()
    )

    return this.connection.update(
      sql,
      this.cleanBindings(
        this.grammar.prepareBindingsForUpdate(
          this.bindings,
          compiledValues.map((value) => value.bindings).all()
        )
      )
    )
  }

  /**
   * Remove all of the expressions from a list of bindings.
   *
   * @param  array<mixed>  $bindings
   * @return list<mixed>
   */
  public cleanBindings (
    bindings: BindingValues,
    includeExpressions = false
  ): BindingValues {
    const cleaned = new Collection(bindings)
      .reject(
        (binding: BindingValue) =>
          binding instanceof Expression && !includeExpressions
      )
      .map((binding: BindingValue) => {
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
    operator: string | undefined = undefined,
    value: string | number | Expression | undefined = undefined,
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
    operator: string | undefined = undefined,
    value: string | number | Expression | undefined = undefined,
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
    operator: string | undefined = undefined,
    value: string | number | Expression | undefined = undefined
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
    operator: string | undefined = undefined,
    value: string | number | Expression | undefined = undefined,
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
    operator: string | undefined = undefined,
    value: string | number | Expression | undefined = undefined
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
    operator: string | undefined = undefined,
    value: string | number | Expression | undefined = undefined
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
    operator: string | undefined = undefined,
    value: string | number | Expression | undefined = undefined
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
    operator: string | undefined = undefined,
    value: string | number | Expression | undefined = undefined
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
    operator: string | undefined = undefined,
    value: string | number | Expression | undefined = undefined,
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
    operator: string | undefined = undefined,
    value: string | number | Expression | undefined = undefined,
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
    operator: string | undefined = undefined,
    value: string | number | Expression | undefined = undefined,
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
    operator: string | undefined = undefined,
    value: string | number | Expression | undefined = undefined
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
    operator: string | undefined = undefined,
    value: string | number | Expression | undefined = undefined,
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
    operator: string | undefined = undefined,
    value: string | number | Expression | undefined = undefined
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
    operator: string | undefined = undefined,
    value: string | number | Expression | undefined = undefined,
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
    operator: string | undefined = undefined,
    value: string | number | Expression | undefined = undefined
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
    operator?: string | undefined,
    value?: string | number | Expression | undefined
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
    operator?: string | undefined,
    value?: string | number | Expression | undefined
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
  protected flattenValue (
    value: string | number | Expression | undefined
  ): string | number | Expression | undefined {
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
    operator: string | undefined,
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
    // const NO_CLAUSES_TO_PRESERVE: string[] = []
    // const COLUMNS_CLAUSE_TO_PRESERVE = ['columns']
    // const SELECT_BINDING_TO_PRESERVE: string[] = []
    // const SELECT_BINDING_KEY = ['select']
    // const AGGREGATE_RESULT_KEY = 'aggregate'

    // const hasUnionsOrHavings = this.unions.length > 0 || this.havings.length > 0

    // const results = await this.cloneWithout(
    //   hasUnionsOrHavings ? NO_CLAUSES_TO_PRESERVE : COLUMNS_CLAUSE_TO_PRESERVE
    // )
    //   .cloneWithoutBindings(
    //     hasUnionsOrHavings ? SELECT_BINDING_TO_PRESERVE : SELECT_BINDING_KEY
    //   )
    //   .setAggregate(fn, columns)
    //   .get(columns)

    // const row = results.first()

    // if (this.isRecord(row)) {
    //   const normalizedRow = changeKeyCase(row)

    //   return normalizedRow[AGGREGATE_RESULT_KEY]
    // }

    // return undefined

    const results = await this.cloneWithout(
      this.unions.length > 0 || this.havings.length > 0 ? [] : ['columns']
    )
      .cloneWithoutBindings(
        this.unions.length > 0 || this.havings.length > 0 ? [] : ['select']
      )
      .setAggregate(fn, columns)
      .get(columns)

    if (!results.isEmpty()) {
      return changeKeyCase(results.first()).aggregate
    }
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
   * Insert new records into the database.
   *
   * @return bool
   */
  public insert (values: Array<Record<string, unknown>> | Record<string, unknown>): boolean {
    // Since every insert gets treated like a batch insert, we will make sure the
    // bindings are structured in a way that is convenient when building these
    // inserts statements by verifying these elements are actually an array.
    if (Object.keys(values).length === 0 || values.length === 0) {
      return true
    }

    // if (!Array.isArray(firstValue) && !isPlainObject(firstValue) && !isPlainObject(values)) {
    if (!Array.isArray(head(values)) && !isPlainObject(head(values))) {
      values = [values]
    } else {
      // Here, we will sort the insert keys for every record so that each insert is
      // in the same order for the record. We need to make sure this is the case
      // so there are not any errors or problems when inserting these records.
      for (const [key, value] of typedEntries(values)) {
        const sortedKeys = Object.keys(value).sort()
        const sortedValue = {}

        for (const key of sortedKeys) {
          sortedValue[key] = value[key]
        }

        values[key] = sortedValue
      }
    }

    this.applyBeforeQueryCallbacks()

    // Finally, we will run this query against the database connection and return
    // the results. We will need to also flatten these bindings before running
    // the query so they are all in one huge, flattened array for execution.
    return this.connection.insert(
      this.grammar.compileInsert(this, values),
      this.cleanBindings(Arr.flatten(values, 1))
    )
  }

  /**
   * Insert new records into the database while ignoring errors.
   *
   * @return int<0, max>
   */
  public insertOrIgnore (values: unknown[]): number {
    if (values.length === 0) {
      return 0
    }

    if (!Array.isArray(values[0])) {
      values = [values]
    } else {
      for (const [key, value] of values.entries()) {
        const sortedKeys = Object.keys(value).sort()
        const sortedValue = {}

        for (const key of sortedKeys) {
          sortedValue[key] = value[key]
        }

        values[key] = sortedValue
      }
    }

    this.applyBeforeQueryCallbacks()

    return this.connection.affectingStatement(
      this.grammar.compileInsertOrIgnore(this, values),
      this.cleanBindings(Arr.flatten(values, 1))
    )
  }

  /**
   * Insert new records into the database and returning specified columns with optional ignoring specific conflicts.
   *
   * @param  non-empty-array<non-empty-string>  $returning
   * @param  non-empty-string|non-empty-array<non-empty-string>|null  $uniqueBy
   * @return \Illuminate\Support\Collection
   */
  public async insertOrIgnoreReturning (
    values: unknown[],
    returning: string[] = ['*'],
    uniqueBy?: string | string[] | undefined
  ): Promise<Collection> {
    if (Array.isArray(values) && values.length === 0) {
      return new Collection()
    }

    if ((Array.isArray(uniqueBy) && uniqueBy.length === 0) || uniqueBy === '') {
      throw new Error(
        'InvalidArgumentException: The unique columns must not be empty.'
      )
    }

    if (Array.isArray(returning) && returning.length === 0) {
      throw new Error(
        'InvalidArgumentException: The returning columns must not be empty.'
      )
    }

    if (!Array.isArray(values[0]) && !isPlainObject(values[0])) {
      values = [values]
    } else {
      for (const [key, value] of values.entries()) {
        const sortedKeys = Object.keys(value).sort()
        const sortedValue = {}

        for (const key of sortedKeys) {
          sortedValue[key] = value[key]
        }

        values[key] = sortedValue
      }
    }

    this.applyBeforeQueryCallbacks()

    const sql = this.grammar.compileInsertOrIgnoreReturning(
      this,
      values,
      returning,
      uniqueBy === undefined ? undefined : Arr.wrap(uniqueBy)
    )

    const rows = await this.connection.selectFromWriteConnection(
      sql,
      this.cleanBindings(Arr.flatten(values, 1))
    )

    const result = new Collection<unknown, unknown>(rows)

    this.connection.recordsHaveBeenModified(result.isNotEmpty())

    return result
  }

  /**
   * Insert new records into the table using a subquery.
   *
   * @param  \Closure|\Illuminate\Database\Query\Builder|\Illuminate\Database\Eloquent\Builder<*>|string  $query
   * @return int
   */
  public insertUsing (
    columns: string[],
    query: QueryCallback | Builder | EloquentBuilder
  ): boolean {
    this.applyBeforeQueryCallbacks()

    const [sql, bindings] = this.createSub(query)

    return this.connection.affectingStatement(
      this.grammar.compileInsertUsing(this, columns, sql),
      this.cleanBindings(bindings)
    )
  }

  /**
   * Insert new records into the table using a subquery while ignoring errors.
   *
   * @param  \Closure|\Illuminate\Database\Query\Builder|\Illuminate\Database\Eloquent\Builder<*>|string  $query
   * @return int
   */
  public insertOrIgnoreUsing (
    columns: string[] | Record<string, unknown>,
    query: QueryCallback | Builder | EloquentBuilder | string
  ): number {
    this.applyBeforeQueryCallbacks()

    const [sql, bindings] = this.createSub(query)

    return this.connection.affectingStatement(
      this.grammar.compileInsertOrIgnoreUsing(this, columns, sql),
      this.cleanBindings(bindings)
    )
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
   * Remove all existing orders and optionally add a new order.
   *
   * @param  ((query: Builder) => void) | Builder | EloquentBuilder | Expression | string | null  column
   * @param  SortDirection | 'asc' | 'desc'  direction
   * @return $this
   */
  public reorder (
    column?: QueryCallback | Builder | Expression | string,
    direction: SortDirectionType = SortDirection.Ascending
  ): this {
    this.orders = []
    this.unionOrders = []
    this.bindings.order = []
    this.bindings.unionOrder = []

    if (column) {
      return this.orderBy(column, direction)
    }

    return this
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

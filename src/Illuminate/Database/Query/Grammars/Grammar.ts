import { isTruthy } from '@devnetic/utils'

import type {
  Agregate,
  BindingValues,
  Builder,
  Having,
  Order,
  Union,
  WhereClause,
  WhereClauseType
} from '../Builder'
import type { IndexHint } from '../IndexHint'

import { Arr, Collection } from '../../../Collections'
import { head, last } from '../../../Collections/helpers'
import { isValueSet, type Prettify } from '../../../Support'
import { mixing } from '../../../Support/Traits'
import { CompilesJsonPaths } from '../../Concerns/CompilesJsonPaths'
import { Grammar as BaseGrammar } from '../../Grammar'
import { Expression } from '../Expression'
import { JoinClause } from '../JoinClause'
import { JoinLateralClause } from '../JoinLateralClause'

/**
 * Array representing the select components for a query.
 */

export type SelectComponentName =

    | 'aggregate' |
    'columns' |
    'from' |
    'indexHint' |
    'joins' |
    'wheres' |
    'groups' |
    'havings' |
    'orders' |
    'limit' |
    'offset' |
    'lock'

export type SelectComponent = {
  name: SelectComponentName
  property: string
}

export type SelectComponents = Array<Prettify<SelectComponent>>

export type ComponentCompilers = Record<
  SelectComponentName,
  (query: Builder) => string
>

export type WhereCompilers = Record<
  WhereClauseType,
  (query: Builder, where: WhereClause) => string
>

// Trait methods are merged onto the class. `mixing().useTrait()` copies them onto the prototype at runtime.
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface Grammar extends BaseGrammar, CompilesJsonPaths {}

// Trait methods are merged onto the class. `mixing().useTrait()` copies them onto the prototype at runtime.
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class Grammar
  extends mixing(BaseGrammar).useTrait([CompilesJsonPaths])
  implements Grammar {
  /**
   * The components that make up a select clause.
   *
   * @type {SelectComponent[]}
   */
  selectComponents: SelectComponents = [
    { name: 'aggregate', property: 'aggregateProperty' },
    { name: 'columns', property: 'columns' },
    { name: 'from', property: 'fromProperty' },
    { name: 'indexHint', property: 'indexHint' },
    { name: 'joins', property: 'joins' },
    { name: 'wheres', property: 'wheres' },
    { name: 'groups', property: 'groups' },
    { name: 'havings', property: 'havings' },
    { name: 'orders', property: 'orders' },
    { name: 'limit', property: 'limitProperty' },
    { name: 'offset', property: 'offsetProperty' },
    { name: 'lock', property: 'lockProperty' }
  ]

  /**
   * Each compiler receives the query and reads its own typed value,
   * so no value has to be passed through an `unknown` parameter.
   */
  protected get compilers (): ComponentCompilers {
    return {
      aggregate: (query: Builder) => {
        const aggregate = query.aggregateProperty

        return aggregate === undefined
          ? ''
          : this.compileAggregate(query, aggregate)
      },
      columns: (query: Builder) => this.compileColumns(query, query.columns),
      from: (query: Builder) => this.compileFrom(query, query.fromProperty),
      indexHint: (query: Builder) =>
        this.compileIndexHint(query, query.indexHint),
      joins: (query: Builder) => this.compileJoins(query, query.joins),
      wheres: (query: Builder) => this.compileWheres(query),
      groups: (query: Builder) => this.compileGroups(query, query.groups),
      havings: (query: Builder) => this.compileHavings(query),
      orders: (query: Builder) => this.compileOrders(query, query.orders),
      limit: (query: Builder) => {
        const limit = query.limitProperty

        return limit === undefined ? '' : this.compileLimit(query, limit)
      },
      offset: (query: Builder) =>
        this.compileOffset(query, query.offsetProperty ?? 0),
      lock: (query: Builder) =>
        this.compileLock(query, query.lockProperty ?? false)
    }
  }

  /**
   * Each where type has its own compiler, looked up the same way as select components.
   */
  protected get whereCompilers (): WhereCompilers {
    return {
      Basic: (query, where) => this.whereBasic(query, where),
      Bitwise: (query, where) => this.whereBasic(query, where),
      Binary: (query, where) => this.whereBinary(query, where),
      Column: (query, where) => this.whereColumn(query, where),
      Date: (query, where) => this.whereDate(query, where),
      Day: (query, where) => this.whereDay(query, where),
      Expression: (query, where) => this.whereExpression(query, where),
      Fulltext: (query, where) => this.whereFulltext(query, where),
      In: (query, where) => this.whereIn(query, where),
      InRaw: (query, where) => this.whereInRaw(query, where),
      JsonBoolean: (query, where) => this.whereBasic(query, where),
      Like: (query, where) => this.whereLike(query, where),
      Month: (query, where) => this.whereMonth(query, where),
      Nested: (query, where) => this.whereNested(query, where),
      NotIn: (query, where) => this.whereNotIn(query, where),
      NotInRaw: (query, where) => this.whereNotInRaw(query, where),
      NotNull: (query, where) => this.whereNotNull(query, where),
      Null: (query, where) => this.whereNull(query, where),
      NullSafeEquals: (query, where) => this.whereNullSafeEquals(query, where),
      Sub: (query, where) => this.whereSub(query, where),
      Time: (query, where) => this.whereTime(query, where),
      Year: (query, where) => this.whereYear(query, where),
      between: (query, where) => this.whereBetween(query, where),
      betweenColumns: (query, where) => this.whereBetweenColumns(query, where),
      raw: (query, where) => this.whereRaw(query, where),
      valueBetween: (query, where) => this.whereValueBetween(query, where)
    }
  }

  /**
   * The grammar specific bitwise operators.
   *
   * @var array
   */
  protected bitwiseOperators: string[] = []

  /**
   * The grammar specific operators.
   *
   * @var array
   */
  protected operators: string[] = []

  /**
   * Get the grammar specific operators.
   *
   * @return array
   */
  public getOperators (): string[] {
    return this.operators
  }

  /**
   * Compile a select query into SQL.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @return string
   */
  public compileSelect (query: Builder): string {
    if (
      (query.unions.length > 0 || query.havings.length > 0) &&
      query.aggregateProperty
    ) {
      return this.compileUnionAggregate(query)
    }

    // If a "group limit" is in place, we will need to compile the SQL to use a
    // different syntax. This primarily supports limits on eager loads using
    // Eloquent. We'll also set the columns if they have not been defined.
    if (isValueSet(query.groupLimitProperty)) {
      if (query.columns.length === 0) {
        query.columns = ['*']
      }

      return this.compileGroupLimit(query)
    }

    // If the query does not have any columns set, we'll set the columns to the
    // * character to just get all of the columns from the database. Then we
    // can build the query and concatenate all the pieces together as one.
    const original = query.columns

    if (query.columns == null || query.columns.length === 0) {
      query.columns = ['*']
    }

    // To compile the query, we'll spin through each component of the query and
    // see if that component exists. If it does we'll just call the compiler
    // function for the component which is responsible for making the SQL.
    let sql = this.concatenate(this.compileComponents(query)).trim()

    if (query.unions.length > 0) {
      sql = this.wrapUnion(sql) + ' ' + this.compileUnions(query)
    }

    query.columns = original

    return sql
  }

  /**
   * Compile the random statement into SQL.
   *
   * @param  string|int  $seed
   * @return string
   */
  // @ts-expect-error expected error; seed is not used in this method
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- required by the base compileRandom signature
  public compileRandom (seed: string | number): string {
    return 'RANDOM()'
  }

  /**
   * Compile a group limit clause.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @return string
   */
  protected compileGroupLimit (query: Builder): string {
    const selectBindings = [
      ...query.getRawBindings().select,
      ...query.getRawBindings().order
    ]

    query.setBindings(selectBindings, 'select')
    query.setBindings([], 'order')

    const groupLimit = query.groupLimitProperty

    if (groupLimit === undefined) {
      return ''
    }

    let limit = groupLimit.value
    let offset = query.offsetProperty

    if (isValueSet(offset)) {
      offset = typeof offset === 'number' ? offset : parseInt(offset, 10)
      limit += offset

      query.offsetProperty = undefined
    }

    const components = this.compileComponents(query)

    components.columns += this.compileRowNumber(
      query.groupLimitProperty?.column ?? '',
      components.orders ?? ''
    )

    delete components.orders

    const table = this.wrap('laravel_table')
    const row = this.wrap('laravel_row')

    let sql = this.concatenate(components)

    sql =
      'select * from (' +
      sql +
      ') as ' +
      table +
      ' where ' +
      row +
      ' <= ' +
      limit

    if (isValueSet(offset)) {
      sql += ' and ' + row + ' > ' + offset
    }

    return sql + ' order by ' + row
  }

  /**
   * Compile a row number clause.
   *
   * @param  string  $partition
   * @param  string  $orders
   * @return string
   */
  protected compileRowNumber (partition: string, orders: string): string {
    const over = String(
      'partition by ' + this.wrap(partition) + ' ' + orders
    ).trim()

    return ', row_number() over (' + over + ') as ' + this.wrap('laravel_row')
  }

  /**
   * Compile a union aggregate query into SQL.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @return string
   */
  protected compileUnionAggregate (query: Builder): string {
    const aggregate = query.aggregateProperty

    if (aggregate === undefined) {
      return ''
    }

    const sql = this.compileAggregate(query, aggregate)

    query.aggregateProperty = undefined

    return (
      sql +
      ' from (' +
      this.compileSelect(query) +
      ') as ' +
      this.wrapTable('temp_table')
    )
  }

  /**
   * Compile the "union" queries attached to the main query.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @return string
   */
  protected compileUnions (query: Builder): string {
    let sql = ''

    for (const union of query.unions) {
      sql += this.compileUnion(union)
    }

    if (query.unionOrders?.length > 0) {
      sql += ' ' + this.compileOrders(query, query.unionOrders)
    }

    const unionLimit = query.unionLimit

    if (unionLimit !== undefined) {
      sql += ' ' + this.compileLimit(query, unionLimit)
    }

    const unionOffset = query.unionOffset

    if (unionOffset !== undefined) {
      sql += ' ' + this.compileOffset(query, unionOffset)
    }

    return sql.trimStart()
  }

  /**
   * Compile the "order by" portions of the query.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $orders
   * @return string
   */
  protected compileOrders (query: Builder, orders: Order[]): string {
    if (orders.length > 0) {
      return 'order by ' + this.compileOrdersToArray(query, orders).join(', ')
    }

    return ''
  }

  /**
   * Compile an "in order of" clause.
   *
   * @param  array  $order
   * @return string
   */
  protected compileInOrderOf (order: Order): string {
    const column = this.wrap(order.column ?? '')

    const cases = []

    for (const [index, value] of Object.entries(order.values ?? [])) {
      cases.push(
        'when ' + column + ' = ' + this.parameter(value) + ' then ' + index
      )
    }

    // return (
    //   'case ' +
    //   cases.join(' ') +
    //   ' else ' +
    //   Object.values(order.values ?? []).length +
    //   ' end'
    // )
    return 'case ' + cases.join(' ') + ' else ' + order.values?.length + ' end'
  }

  /**
   * Compile the query orders to an array.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $orders
   * @return array
   */
  protected compileOrdersToArray (query: Builder, orders: Order[]): string[] {
    return orders.map((order) => {
      if (isValueSet(order.sql) && this.isExpression(order.sql)) {
        return String(order.sql.getValue(query.getGrammar()))
      }

      if (isValueSet(order.type) && order.type === 'InOrderOf') {
        return this.compileInOrderOf(order)
      }

      return order.sql ?? this.wrap(order.column ?? '') + ' ' + order.direction
    })
  }

  /**
   * Compile a single union statement.
   *
   * @param  array  $union
   * @return string
   */
  protected compileUnion (union: Union): string {
    const conjunction = union.all ? ' union all ' : ' union '

    return conjunction + this.wrapUnion(union.query.toSql() ?? '')
  }

  /**
   * Compile the lock into SQL.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  bool|string  $value
   * @return string
   */
  protected compileLock (_query: Builder, value: boolean | string): string {
    return typeof value === 'string' ? value : ''
  }

  /**
   * Compile the "group by" portions of the query.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $groups
   * @return string
   */
  protected compileGroups (
    // @ts-expect-error expected error; query is not used in this method
    // @eslint-disable-next-line @typescript-eslint/no-unused-vars
    query: Builder,
    groups: Array<Expression | string>
  ): string {
    return 'group by ' + this.columnize(groups)
  }

  /**
   * Wrap a union subquery in parentheses.
   *
   * @param  string  $sql
   * @return string
   */
  protected wrapUnion (sql: string) {
    return '(' + sql + ')'
  }

  /**
   * Concatenate an array of segments, removing empties.
   *
   * @param  Record<string, any>  segments
   * @return string
   */
  protected concatenate (segments: Record<string, string>): string {
    return Object.values(segments)
      .filter((value: string) => value !== '')
      .join(' ')
  }

  /**
   * Compile the "select *" portion of the query.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $columns
   * @return string|null
   */
  protected compileColumns (
    query: Builder,
    columns: Array<string | Expression>
  ): string {
    // If the query is actually performing an aggregating select, we will let that
    // compiler handle the building of the select clauses, as it will need some
    // more syntax that is best handled by that function to keep things neat.
    if (query.aggregateProperty !== undefined) {
      return ''
    }

    let select: string

    if (isTruthy(query.distinctProperty)) {
      select = 'select distinct '
    } else {
      select = 'select '
    }

    return select + this.columnize(columns)
  }

  /**
   * Compile an aggregated select clause.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array{function: string, columns: array<\Illuminate\Contracts\Database\Query\Expression|string>}  $aggregate
   * @return string
   */
  protected compileAggregate (query: Builder, aggregate: Agregate): string {
    let column = this.columnize(aggregate.columns)

    // If the query has a "distinct" constraint and we're not asking for all columns
    // we need to prepend "distinct" onto the column name so that the query takes
    // it into account when it performs the aggregating operations on the data.
    if (Array.isArray(query.distinctProperty)) {
      column = 'distinct ' + this.columnize(query.distinctProperty)
    } else if (query.distinctProperty && column !== '*') {
      column = 'distinct ' + column
    }

    return `select ${aggregate.function}(${column}) as ${this.wrap('aggregate')}`
  }

  /**
   * Compile the "limit" portions of the query.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {number}  limit
   * @return {string}
   */
  // @ts-expect-error expected error; query is not used in this method

  protected compileLimit (query: Builder, limit: number): string {
    return `limit ${typeof limit === 'number' ? limit : parseInt(limit, 10)}`
  }

  /**
   * Compile the "offset" portions of the query.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  int  $offset
   * @return string
   */
  // @ts-expect-error expected error; query is not used in this method

  protected compileOffset (query: Builder, offset: number): string {
    return (
      'offset ' + (typeof offset === 'number' ? offset : parseInt(offset, 10))
    )
  }

  /**
   * Compile the components necessary for a select clause.
   *
   * @param  \Illuminate\Database\Query\Builder  query
   * @return array
   */
  protected compileComponents (
    query: Builder
  ): Partial<Record<SelectComponentName, string>> {
    const sql: Partial<Record<SelectComponentName, string>> = {}

    for (const { name, property } of this.selectComponents) {
      if (this.isExecutable(query, property)) {
        // const method = `compile${pascalCase(name)}`

        // sql[name] = this[method](query, query[property as keyof Builder])
        sql[name] = this.compilers[name](query)
      }
    }

    return sql
  }

  protected isExecutable (query: Builder, property: string): boolean {
    const subject = Reflect.get(query, property)

    if (subject === undefined || subject === '') {
      return false
    }

    if (Array.isArray(subject) && subject.length === 0) {
      return false
    }

    return true
  }

  /**
   * Compile the "having" portions of the query.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @return string
   */
  protected compileHavings (query: Builder): string {
    // return 'having ' + this.removeLeadingBoolean((new Collection(query.havings)).map((having: Having) => having.boolean + ' ' + this.compileHaving(having)).join(' '))
    return (
      'having ' +
      this.removeLeadingBoolean(
        new Collection(query.havings)
          .map((having: Having) => {
            return having.boolean + ' ' + this.compileHaving(having)
          })
          .implode(' ')
      )
    )
  }

  /**
   * Remove the leading boolean from a statement.
   *
   * @param  string  $value
   * @return string
   */
  protected removeLeadingBoolean (value: string): string {
    return value.replace(/and |or /i, '')
  }

  /**
   * Compile a single having clause.
   *
   * @param  {Having}  having
   * @return {string}
   */
  protected compileHaving (having: Having): string {
    // If the having clause is "raw", we can just return the clause straight away
    // without doing any more processing on it. Otherwise, we will compile the
    // clause into SQL based on the components that make it up from builder.
    switch (having.type) {
      case 'Raw':
        return having.sql ?? ''
      case 'between':
        return this.compileHavingBetween(having)
      case 'Null':
        return this.compileHavingNull(having)
      case 'NotNull':
        return this.compileHavingNotNull(having)
      case 'bit':
        return this.compileHavingBit(having)
      case 'Expression':
        return this.compileHavingExpression(having)
      case 'Nested':
        return this.compileNestedHavings(having)
      default:
        return this.compileBasicHaving(having)
    }
  }

  /**
   * Compile the "join" portions of the query.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $joins
   * @return string
   */
  protected compileJoins (query: Builder, joins: JoinClause[]): string {
    return new Collection(joins)
      .map((join: JoinClause) => {
        const table = this.wrapTable(join.table)

        const nestedJoins =
          join.joins.length === 0
            ? ''
            : ' ' + this.compileJoins(query, join.joins)

        const tableAndNestedJoins =
          join.joins.length === 0 ? table : '(' + table + nestedJoins + ')'

        if (join instanceof JoinLateralClause) {
          return this.compileJoinLateral(join, String(tableAndNestedJoins))
        }

        const joinWord =
          join.type === 'straight_join' && this.supportsStraightJoins()
            ? ''
            : ' join'

        return String(
          `${join.type}${joinWord} ${tableAndNestedJoins} ${this.compileWheres(join)}`
        ).trim()
      })
      .implode(' ')
  }

  /**
   * Compile the "where" portions of the query.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @return string
   */
  public compileWheres (query: Builder): string {
    // Each type of where clause has its own compiler function, which is responsible
    // for actually creating the where clauses SQL. This helps keep the code nice
    // and maintainable since each clause has a very small method that it uses.
    if (!query.wheres) {
      return ''
    }

    const sql = this.compileWheresToArray(query)

    // If we actually have some where clauses, we will strip off the first boolean
    // operator, which is added by the query builders for convenience so we can
    // avoid checking for the first clauses in each of the compilers methods.
    if (sql.length > 0) {
      return this.concatenateWhereClauses(query, sql)
    }

    return ''
  }

  /**
   * Compile a basic where clause.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $where
   * @return string
   */
  protected whereBasic (_query: Builder, where: WhereClause): string {
    const value = this.parameter(where.value)

    const operator = where.operator?.replace('?', '??') ?? ''

    return this.wrap(where.column ?? '') + ' ' + operator + ' ' + value
  }

  /**
   * Compile a "between" where clause.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $where
   * @return string
   */
  protected whereBetween (_query: Builder, where: WhereClause): string {
    const between = where.not ? 'not between' : 'between'
    const values = where.values ?? []

    const min = this.parameter(
      Array.isArray(values) ? Arr.first(values) : values[0]
    )

    const max = this.parameter(
      Array.isArray(values) ? Arr.last(values) : values[1]
    )

    return (
      this.wrap(where.column ?? '') + ' ' + between + ' ' + min + ' and ' + max
    )
  }

  /**
   * Get an array of all the where clauses for the query.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @return array
   */
  protected compileWheresToArray (query: Builder): string[] {
    return query.wheres.map((where) => {
      return where.boolean + ' ' + this.whereCompilers[where.type](query, where)
    })
  }

  /**
   * Compile a "where not null" clause.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $where
   * @return string
   */
  protected whereNotNull (_query: Builder, where: WhereClause): string {
    return this.wrap(where.column ?? '') + ' is not null'
  }

  /**
   * Compile a "where fulltext" clause.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $where
   * @return string
   *
   * @throws \RuntimeException
   */
  // @ts-expect-error expected error; query is not used in this method
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public whereFulltext (query: Builder, where: WhereClause): string {
    throw new Error(
      'RuntimeException: This database engine does not support fulltext search operations.'
    )
  }

  /**
   * Compile a nested where clause.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $where
   * @return string
   */
  // @ts-expect-error expected error; query is not used in this method

  protected whereExpression (query: Builder, where: WhereClause): string {
    if (where.column instanceof Expression) {
      return String(this.getValue(where.column))
    }

    return String(this.wrap(where.column ?? ''))
  }

  // @ts-expect-error expected error; query is not used in this method

  protected whereSub (query: Builder, where: WhereClause): string {
    const nested = where.query

    if (nested === undefined) {
      throw new Error(
        'RuntimeException: Subquery where clause is missing its query.'
      )
    }

    return (
      this.wrap(where.column ?? '') +
      ' ' +
      (where.operator ?? '') +
      ' (' +
      nested.toSql() +
      ')'
    )
  }

  // @ts-expect-error expected error; query is not used in this method

  protected whereNested (query: Builder, where: WhereClause): string {
    const nested = where.query

    if (nested === undefined) {
      throw new Error(
        'RuntimeException: Nested where clause is missing its query.'
      )
    }

    // Here we will calculate what portion of the string we need to remove. If this
    // is a join clause query, we need to remove the "on" portion of the SQL and
    // if it is a normal query we need to take the leading "where" of queries.
    const offset = nested instanceof JoinClause ? 3 : 6

    return '(' + this.compileWheres(nested).substring(offset) + ')'
  }

  /**
   * Compile a "where not in raw" clause.
   *
   * For safety, whereIntegerInRaw ensures this method is only used with integer values.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $where
   * @return string
   */
  // @ts-expect-error expected error; query is not used in this method

  protected whereNotInRaw (query: Builder, where: WhereClause): string {
    const values = where.values

    if (Array.isArray(values) && values.length > 0) {
      return (
        this.wrap(where.column ?? '') + ' not in (' + values.join(', ') + ')'
      )
    }

    return '1 = 1'
  }

  /**
   * Compile a "where in raw" clause.
   *
   * For safety, whereIntegerInRaw ensures this method is only used with integer values.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $where
   * @return string
   */
  // @ts-expect-error expected error; query is not used in this method

  protected whereInRaw (query: Builder, where: WhereClause): string {
    const values = where.values

    if (Array.isArray(values) && values.length > 0) {
      return this.wrap(where.column ?? '') + ' in (' + values.join(', ') + ')'
    }

    return '0 = 1'
  }

  /**
   * Compile a "where in" clause.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $where
   * @return string
   */
  // @ts-expect-error expected error; query is not used in this method

  protected whereIn (query: Builder, where: WhereClause): string {
    const values = where.values

    if (Array.isArray(values) && values.length > 0) {
      return (
        this.wrap(where.column ?? '') +
        ' in (' +
        this.parameterize(values) +
        ')'
      )
    }

    return '0 = 1'
  }

  /**
   * Compile a "where not in" clause.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $where
   * @return string
   */
  // @ts-expect-error expected error; query is not used in this method

  protected whereNotIn (query: Builder, where: WhereClause): string {
    const values = where.values

    if (Array.isArray(values) && values.length > 0) {
      return (
        this.wrap(where.column ?? '') +
        ' not in (' +
        this.parameterize(values) +
        ')'
      )
    }

    return '1 = 1'
  }

  /**
   * Compile a raw where clause.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $where
   * @return string
   */
  // @ts-expect-error expected error; query is not used in this method

  protected whereRaw (query: Builder, where: WhereClause): string {
    return where.sql instanceof Expression
      ? String(where.sql.getValue(this))
      : (where.sql ?? '')
  }

  /**
   * Compile a "value between" where clause.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $where
   * @return string
   */
  // @ts-expect-error expected error; query is not used in this method

  protected whereValueBetween (query: Builder, where: WhereClause): string {
    const between = where.not ? 'not between' : 'between'
    const columns = where.columns ?? []

    const min = this.wrap(Arr.first(columns) ?? '')

    const max = this.wrap(Arr.last(columns) ?? '')

    return (
      this.parameter(where.value) + ' ' + between + ' ' + min + ' and ' + max
    )
  }

  /**
   * Compile a "where null" clause.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $where
   * @return string
   */
  // @ts-expect-error expected error; query is not used in this method

  protected whereNull (query: Builder, where: WhereClause): string {
    return this.wrap(where.column ?? '') + ' is null'
  }

  /**
   * Compile a "where null safe equals" clause.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $where
   * @return string
   */
  // @ts-expect-error expected error; query is not used in this method

  protected whereNullSafeEquals (query: Builder, where: WhereClause): string {
    return (
      this.wrap(where.column ?? '') +
      ' is not distinct from ' +
      this.parameter(where.value)
    )
  }

  /**
   * Compile a "where like" clause.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $where
   * @return string
   *
   * @throws \RuntimeException
   */
  protected whereLike (query: Builder, where: WhereClause): string {
    if (where.caseSensitive) {
      throw new Error(
        'RuntimeException: This database engine does not support case sensitive like operations.'
      )
    }

    where.operator = where.not ? 'not like' : 'like'

    return this.whereBasic(query, where)
  }

  /**
   * Compile a "where binary" clause.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $where
   * @return string
   *
   * @throws \RuntimeException
   */
  // @ts-expect-error expected error; query is not used in this method
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected whereBinary (query: Builder, where: WhereClause): string {
    throw new Error(
      'RuntimeException: This database engine does not support binary comparison operations.'
    )
  }

  /**
   * Compile a "where date" clause.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $where
   * @return string
   */
  protected whereDate (query: Builder, where: WhereClause): string {
    return this.dateBasedWhere('date', query, where)
  }

  /**
   * Compile a "where time" clause.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $where
   * @return string
   */
  protected whereTime (query: Builder, where: WhereClause): string {
    return this.dateBasedWhere('time', query, where)
  }

  /**
   * Compile a "where month" clause.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $where
   * @return string
   */
  protected whereMonth (query: Builder, where: WhereClause): string {
    return this.dateBasedWhere('month', query, where)
  }

  /**
   * Compile a "where year" clause.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $where
   * @return string
   */
  protected whereYear (query: Builder, where: WhereClause): string {
    return this.dateBasedWhere('year', query, where)
  }

  /**
   * Narrow a where value to something `wrap()` can accept.
   */
  private columnExpression (value: unknown): string | Expression {
    if (typeof value === 'string' || value instanceof Expression) {
      return value
    }

    return ''
  }

  /**
   * Compile a "between" where clause.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $where
   * @return string
   */
  // @ts-expect-error expected error; query is not used in this method

  protected whereBetweenColumns (query: Builder, where: WhereClause): string {
    const between = where.not ? 'not between' : 'between'
    const values = where.values ?? []

    const min = this.wrap(
      this.columnExpression(
        Array.isArray(values) ? Arr.first(values) : values[0]
      )
    )

    const max = this.wrap(
      this.columnExpression(
        Array.isArray(values) ? Arr.last(values) : values[1]
      )
    )

    return (
      this.wrap(where.column ?? '') + ' ' + between + ' ' + min + ' and ' + max
    )
  }

  /**
   * Compile a date based where clause.
   *
   * @param  string  $type
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $where
   * @return string
   */
  protected dateBasedWhere (
    type: string,
    // @ts-expect-error expected error; query is not used in this method

    query: Builder,
    where: WhereClause
  ): string {
    const value = this.parameter(where.value)

    return (
      type +
      '(' +
      this.wrap(where.column ?? '') +
      ') ' +
      where.operator +
      ' ' +
      value
    )
  }

  /**
   * Compile a "where day" clause.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $where
   * @return string
   */
  protected whereDay (query: Builder, where: WhereClause): string {
    return this.dateBasedWhere('day', query, where)
  }

  /**
   * Compile a "where column" clause.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $where
   * @return string
   */
  // @ts-expect-error expected error; query is not used in this method

  protected whereColumn (query: Builder, where: WhereClause): string {
    const operator = (where.operator ?? '').replace('?', '??')

    return (
      this.wrap(this.columnExpression(where.first)) +
      ' ' +
      operator +
      ' ' +
      this.wrap(where.second ?? '')
    )
  }

  /**
   * Concatenate the where clauses into a single string.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $sql
   * @return string
   */
  protected concatenateWhereClauses (query: Builder, sql: string[]): string {
    const conjunction = query instanceof JoinClause ? 'on' : 'where'

    return conjunction + ' ' + this.removeLeadingBoolean(sql.join(' '))
  }

  /**
   * Determine if the grammar supports straight joins.
   *
   * @return bool
   *
   * @throws \RuntimeException
   */
  protected supportsStraightJoins (): boolean {
    throw new Error(
      'RuntimeException: This database engine does not support straight joins.'
    )
  }

  /**
   * Compile a "lateral join" clause.
   *
   * @param  \Illuminate\Database\Query\JoinLateralClause  $join
   * @param  string  $expression
   * @return string
   *
   * @throws \RuntimeException
   */
  public compileJoinLateral (
    // @ts-expect-error expected error; join is not used in this method
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    join: JoinLateralClause,
    // @ts-expect-error expected error; expression is not used in this method
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    expression: string
  ): string {
    throw new Error(
      'RuntimeException: This database engine does not support lateral joins.'
    )
  }

  /**
   * Compile an index hint. Dialects that support index hints override this.
   */
  // @ts-expect-error expected error; query is not used in this method
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected compileIndexHint (query: Builder, indexHint?: IndexHint): string {
    return ''
  }

  /**
   * Compile a nested having clause.
   *
   * @param  {Having}  having
   * @return {string}
   */
  protected compileNestedHavings (having: Having): string {
    if (having.query === undefined) {
      throw new Error(
        'RuntimeException: Nested having clause is missing its query.'
      )
    }

    return '(' + this.compileHavings(having.query).substring(7) + ')'
  }

  /**
   * Compile a basic having clause.
   *
   * @param  {Having}  having
   * @return {string}
   */
  protected compileBasicHaving (having: Having): string {
    const column = this.wrap((having.column ?? '') as string | Expression)

    const parameter = this.parameter(having.value)

    return column + ' ' + having.operator + ' ' + parameter
  }

  /**
   * Compile a "between" having clause.
   *
   * @param  array  $having
   * @return string
   */
  protected compileHavingBetween (having: Having): string {
    const between = having.not ? 'not between' : 'between'

    const column = this.wrap((having.column ?? '') as string | Expression)

    const min = this.parameter(head(having.values ?? []))

    const max = this.parameter(last(having.values ?? []))

    return column + ' ' + between + ' ' + min + ' and ' + max
  }

  /**
   * Compile a having null clause.
   *
   * @param  array  $having
   * @return string
   */
  protected compileHavingNull (having: Having): string {
    const column = this.wrap((having.column ?? '') as string | Expression)

    return column + ' is null'
  }

  /**
   * Compile a having not null clause.
   *
   * @param  array  $having
   * @return string
   */
  protected compileHavingNotNull (having: Having): string {
    const column = this.wrap((having.column ?? '') as string | Expression)

    return column + ' is not null'
  }

  /**
   * Compile a having clause involving a bit operator.
   *
   * @param  array  $having
   * @return string
   */
  protected compileHavingBit (having: Having): string {
    const column = this.wrap((having.column ?? '') as string | Expression)

    const parameter = this.parameter(having.value ?? '')

    return '(' + column + ' ' + having.operator + ' ' + parameter + ') != 0'
  }

  /**
   * Compile a having clause involving an expression.
   *
   * @param  array  $having
   * @return string
   */
  protected compileHavingExpression (having: Having): string {
    // const column = having.column

    // if (
    //   typeof column === 'object' &&
    //   column !== null &&
    //   typeof column.getValue === 'function'
    // ) {
    //   return String(column.getValue(this))
    // }

    // return typeof column === 'string' ? column : ''
    return String((having.column as Expression).getValue(this))
  }

  /**
   * Compile the "from" portion of the query.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  string  $table
   * @return string
   */
  // @ts-expect-error expected error; query is not used in this method

  protected compileFrom (query: Builder, table: string | Expression): string {
    return 'from ' + this.wrapTable(table)
  }

  /**
   * Substitute the given bindings into the given raw SQL query.
   *
   * @param  string  sql
   * @param  array  bindings
   * @return string
   */
  public substituteBindingsIntoRawSql (
    sql: string,
    bindings: BindingValues
  ): string {
    const escaped = bindings.map((value) => {
      if (value instanceof Expression) {
        return String(this.getValue(value))
      }

      return this.escape(value)
    })

    let query = ''

    let isStringLiteral = false

    for (let i = 0, length = sql.length; i < length; i++) {
      const char = sql[i]
      const nextChar = sql[i + 1] ?? ''

      // Single quotes can be escaped as '' according to the SQL standard while
      // MySQL uses \'. Postgres has operators like ?| that must get encoded
      // in PHP like ??|. We should skip over the escaped characters here.
      if (["\\'", "''", '??'].includes(char + nextChar)) {
        query += char + nextChar
        i += 1
      } else if (char === "'") {
        // Starting / leaving string literal...
        query += char
        isStringLiteral = !isStringLiteral
      } else if (char === '?' && !isStringLiteral) {
        // Substitutable binding...
        query += escaped.shift() ?? '?'
      } else {
        // Normal character...
        query += char
      }
    }

    return query
  }

  public getBitwiseOperators (): string[] {
    return this.bitwiseOperators
  }
}

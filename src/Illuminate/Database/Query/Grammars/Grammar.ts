import { isTruthy } from '@devnetic/utils'

import type { Agregate, BindingValues, Builder, Having, Order, Union } from '../Builder'

import { Collection } from '../../../Collections'
import { head, last } from '../../../Collections/helpers'
import { isEmpty, isValueSet, ucfirst } from '../../../Support'
import { mixing } from '../../../Support/Traits'
import { CompilesJsonPaths } from '../../Concerns/CompilesJsonPaths'
import { Grammar as BaseGrammar } from '../../Grammar'
import { type Expression } from '../Expression'

/**
 * Array representing the select components for a query.
 */
type SelectComponent = {
  /**
   * The name of the select component.
   */
  name: string
  /**
   * The property associated with the select component.
   */
  property: string
}

export interface Grammar extends BaseGrammar, CompilesJsonPaths { }

export class Grammar extends mixing(BaseGrammar).useTrait([CompilesJsonPaths]) implements Grammar {
  /**
   * The components that make up a select clause.
   *
   * @type {SelectComponent[]}
   */
  selectComponents: SelectComponent[] = [
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
 * Compile a select query into SQL.
 *
 * @param  \Illuminate\Database\Query\Builder  $query
 * @return string
 */
  public compileSelect (query: Builder): string {
    if ((query.unions || query.havings) && query.aggregateProperty) {
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

    if (query.columns.length === 0) {
      query.columns = ['*']
    }

    // To compile the query, we'll spin through each component of the query and
    // see if that component exists. If it does we'll just call the compiler
    // function for the component which is responsible for making the SQL.
    let sql = this.concatenate(this.compileComponents(query)).trim()

    if (query.unions) {
      sql = this.wrapUnion(sql) + ' ' + this.compileUnions(query)
    }

    query.columns = original

    return sql
  }

  /**
   * Compile a group limit clause.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @return string
   */
  protected compileGroupLimit (query: Builder): string {
    const selectBindings = [...query.getRawBindings().select, ...query.getRawBindings().order]

    query.setBindings(selectBindings, 'select')
    query.setBindings([], 'order')

    let limit = query.groupLimitProperty!.value
    let offset = query.offsetProperty

    if (isValueSet(offset)) {
      offset = typeof offset === 'number' ? offset : parseInt(offset, 10)
      limit += offset

      query.offsetProperty = undefined
    }

    const components = this.compileComponents(query)

    components.columns += this.compileRowNumber(
      query.groupLimitProperty!.column,
      components.orders ?? ''
    )

    delete components.orders

    const table = this.wrap('laravel_table')
    const row = this.wrap('laravel_row')

    let sql = this.concatenate(components)

    sql = 'select * from (' + sql + ') as ' + table + ' where ' + row + ' <= ' + limit

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
    const over = String('partition by ' + this.wrap(partition) + ' ' + orders).trim()

    return ', row_number() over (' + over + ') as ' + this.wrap('laravel_row')
  }

  /**
   * Compile a union aggregate query into SQL.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @return string
   */
  protected compileUnionAggregate (query: Builder): string {
    const sql = this.compileAggregate(query, query.aggregateProperty!)

    query.aggregateProperty = undefined

    return sql + ' from (' + this.compileSelect(query) + ') as ' + this.wrapTable('temp_table')
  }

  /**
   * Compile the "union" queries attached to the main query.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @return string
   */
  protected compileUnions (query: Builder): string {
    let sql = ''

    for (const union of query.unions!) {
      sql += this.compileUnion(union)
    }

    if (!isEmpty(query.unionOrders)) {
      sql += ' ' + this.compileOrders(query, query.unionOrders!)
    }

    if (query.unionLimit !== undefined) {
      sql += ' ' + this.compileLimit(query, query.unionLimit!)
    }

    if (query.unionOffset !== undefined) {
      sql += ' ' + this.compileOffset(query, query.unionOffset!)
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
    if (!isEmpty(orders)) {
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
      cases.push('when ' + column + ' = ' + this.parameter(value) + ' then ' + index)
    }

    return 'case ' + cases.join(' ') + ' else ' + Object.values(order.values ?? []).length + ' end'
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

    return conjunction + this.wrapUnion(union.query.toSql())
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
    columns: Array<Expression | string>
  ): string | null | undefined {
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
  compileLimit (query: Builder, limit: number): string {
    return `limit ${typeof limit === 'number' ? limit : parseInt(limit, 10)}`
  }

  /**
   * Compile the "offset" portions of the query.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  int  $offset
   * @return string
   */
  protected compileOffset (query: Builder, offset: number): string {
    return 'offset ' + (typeof offset === 'number' ? offset : parseInt(offset, 10))
  }

  /**
   * Compile the components necessary for a select clause.
   *
   * @param  \Illuminate\Database\Query\Builder  query
   * @return array
   */
  protected compileComponents (query: Builder) {
    const sql: Record<string, string> = {}

    for (const { name, property } of this.selectComponents) {
      if (this.isExecutable(query, property)) {
        const method = 'compile' + ucfirst(name)

        // console.log('method: %o', method);

        sql[name] = this[method](query, query[property as keyof Builder])
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
    return 'having ' + this.removeLeadingBoolean(new Collection(query.havings).map((/** @type {Having} */having) => {
      return having.boolean + ' ' + this.compileHaving(having)
    }).implode(' '))
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
  compileHaving (having: Having): string {
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
   * Compile a nested having clause.
   *
   * @param  {Having}  having
   * @return {string}
   */
  compileNestedHavings (having: Having): string {
    return '(' + this.compileHavings(having.query).substring(7) + ')'
  }

  /**
   * Compile a basic having clause.
   *
   * @param  {Having}  having
   * @return {string}
   */
  compileBasicHaving (having: Having): string {
    const column = this.wrap(having.column ?? '')

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

    const column = this.wrap(having.column ?? '')

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
    const column = this.wrap(having.column ?? '')

    return column + ' is null'
  }

  /**
   * Compile a having not null clause.
   *
   * @param  array  $having
   * @return string
   */
  protected compileHavingNotNull (having: Having): string {
    const column = this.wrap(having.column ?? '')

    return column + ' is not null'
  }

  /**
   * Compile a having clause involving a bit operator.
   *
   * @param  array  $having
   * @return string
   */
  protected compileHavingBit (having: Having): string {
    const column = this.wrap(having.column ?? '')

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
    if (this.isExpression(having.column)) {
      return String(having.column.getValue(this))
    }

    return having.column ?? ''
  }

  /**
   * Compile the "from" portion of the query.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  string  $table
   * @return string
   */
  protected compileFrom (query: Builder, table: string): string {
    return 'from ' + this.wrapTable(table)
  }

  /**
 * Substitute the given bindings into the given raw SQL query.
 *
 * @param  string  sql
 * @param  array  bindings
 * @return string
 */
  public substituteBindingsIntoRawSql (sql: string, bindings: BindingValues): string {
    bindings = bindings.map((value) => this.escape(value))

    let query = ''

    let isStringLiteral = false

    for (let i = 0; i < sql.length; i++) {
      const char = sql[i]
      const nextChar = sql[i + 1] ?? null

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
        query += bindings.shift() ?? '?'
      } else {
        // Normal character...
        query += char
      }
    }

    return query
  }
}

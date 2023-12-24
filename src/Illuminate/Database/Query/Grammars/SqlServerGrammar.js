import { isNumeric, isString } from '@devnetic/utils'

import Arr from '../../../Collections/Arr.js'
import { clone, isFalsy, isTruthy } from '../../../Support/helpers.js'
import Grammar from './Grammar.js'

export default class SqlServerGrammar extends Grammar {
  constructor () {
    super(...arguments)
    /**
     * All of the available clause operators.
     *
     * @member {string[]}
     */
    this.operators = [
      '=', '<', '>', '<=', '>=', '!<', '!>', '<>', '!=',
      'like', 'not like', 'ilike',
      '&', '&=', '|', '|=', '^', '^='
    ]
  }

  /**
   * Create a full ANSI offset clause for the query.
   *
   * @param  {\Illuminate\Database\Query\Builder}  query
   * @param  {object}  components
   * @return {string}
   */
  compileAnsiOffset (query, components) {
    // An ORDER BY clause is required to make this offset query work, so if one does
    // not exist we'll just create a dummy clause to trick the database and so it
    // does not complain about the queries for not having an "order by" clause.
    if (components.orders === undefined) {
      components.orders = 'order by (select 0)'
    }

    // We need to add the row number to the query so we can compare it to the offset
    // and limit values given for the statements. So we will add an expression to
    // the "select" that will give back the row numbers on each of the records.
    components.columns += this.compileOver(components.orders)
    delete components.orders

    if (this.queryOrderContainsSubquery(query)) {
      query.bindings = this.sortBindingsForSubqueryOrderBy(query)
    }

    // Next we need to calculate the constraints that should be placed on the query
    // to get the right offset and limit from our query but if there is no limit
    // set we will just handle the offset only since that is all that matters.
    const sql = this.concatenate(components)
    return this.compileTableExpression(sql, query)
  }

  /**
   * Compile the "select *" portion of the query.
   *
   * @param  {\Illuminate\Database\Query\Builder}  query
   * @param  {string[]}  columns
   * @return {string|undefined}
   */
  compileColumns (query, columns) {
    if (query.aggregateProperty !== undefined) {
      return
    }

    let select = isTruthy(query.distinctProperty) ? 'select distinct ' : 'select '
    const limit = Number(query.limitProperty ?? 0)
    const offset = Number(query.offsetProperty ?? 0)

    // If there is a limit on the query, but not an offset, we will add the top
    // clause to the query, which serves as a "limit" type clause within the
    // SQL Server system similar to the limit keywords available in MySQL.
    if (isNumeric(query.limitProperty) && limit > 0 && offset <= 0) {
      select += `top ${limit} `
    }

    return select + this.columnize(columns)
  }

  /**
   * Compile an exists statement into SQL.
   *
   * @param  {\Illuminate\Database\Query\Builder } query
   * @return {string}
   */
  compileExists (query) {
    const existsQuery = clone(query)

    existsQuery.columns = []

    return this.compileSelect(existsQuery.selectRaw('1 [exists]').limit(1))
  }

  /**
   * Compile the "from" portion of the query.
   *
   * @param  {\Illuminate\Database\Query\Builder}  query
   * @param  {string}  table
   * @return {string}
   */
  compileFrom (query, table) {
    const from = super.compileFrom(query, table)

    if (isString(query.lockProperty)) {
      return from + ' ' + String(query.lockProperty)
    }

    if (query.lockProperty !== undefined) {
      return from + ' with(rowlock,' + (query.lockProperty !== undefined ? 'updlock,' : '') + 'holdlock)'
    }

    return from
  }

  /**
   * Compile the "limit" portions of the query.
   *
   * @param  {\Illuminate\Database\Query\Builder}  query
   * @param  {number}  limit
   * @return {string}
   */
  compileLimit (query, limit) {
    return ''
  }

  /**
   * Compile the "offset" portions of the query.
   *
   * @param  {\Illuminate\Database\Query\Builder}  query
   * @param  {number}  offset
   * @return {string}
   */
  compileOffset (query, offset) {
    return ''
  }

  /**
   * Compile the over statement for a table expression.
   *
   * @param  {string}  orderings
   * @return {string}
   */
  compileOver (orderings) {
    return `, row_number() over (${orderings}) as row_num`
  }

  /**
   * Compile the limit / offset row constraint for a query.
   *
   * @param  {\Illuminate\Database\Query\Builder}  query
   * @return {string}
   */
  compileRowConstraint (query) {
    const start = Number(query.offsetProperty) + 1

    if (Number(query.limitProperty) > 0) {
      const finish = Number(query.offsetProperty) + Number(query.limitProperty)

      return `between ${start} and ${finish}`
    }

    return `>= ${start}`
  }

  /**
   * Compile a select query into SQL.
   *
   * @param  {\Illuminate\Database\Query\Builder}  query
   * @return {string}
   */
  compileSelect (query) {
    if (isFalsy(query.offsetProperty)) {
      return super.compileSelect(query)
    }

    // If an offset is present on the query, we will need to wrap the query in
    // a big "ANSI" offset syntax block. This is very nasty compared to the
    // other database systems but is necessary for implementing features.
    if (query.columns.length === 0) {
      query.columns = ['*']
    }

    const components = this.compileComponents(query)

    if (components.orders.length > 0) {
      return super.compileSelect(query) + ` offset ${String(query.offsetProperty)} rows fetch next ${String(query.limitProperty)} rows only`
    }

    // If an offset is present on the query, we will need to wrap the query in
    // a big "ANSI" offset syntax block. This is very nasty compared to the
    // other database systems but is necessary for implementing features.
    return this.compileAnsiOffset(query, components)
  }

  /**
   * Compile a common table expression for a query.
   *
   * @param  {string}  sql
   * @param  {\Illuminate\Database\Query\Builder}  query
   * @return {string}
   */
  compileTableExpression (sql, query) {
    const constraint = this.compileRowConstraint(query)

    return `select * from (${sql}) as temp_table where row_num ${constraint} order by row_num`
  }

  /**
   * Get the format for database stored dates.
   *
   * @return {string}
   */
  getDateFormat () {
    return 'Y-m-d H:i:s.v'
  }

  /**
   * Determine if the query's order by clauses contain a subquery.
   *
   * @param  {\Illuminate\Database\Query\Builder}  query
   * @return {boolean}
   */
  queryOrderContainsSubquery (query) {
    if (!Array.isArray(query.orders)) {
      return false
    }

    return Arr.first(query.orders, (value) => {
      return this.isExpression(value.column ?? undefined)
    }, false) !== false
  }

  /**
   * Move the order bindings to be after the "select" statement to account for a order by subquery.
   *
   * @param  {\Illuminate\Database\Query\Builder}  query
   * @return {Array}
   */
  sortBindingsForSubqueryOrderBy (query) {
    return Arr.sort(query.bindings, (bindings, key) => {
      return ['select', 'order', 'from', 'join', 'where', 'groupBy', 'having', 'union', 'unionOrder'].indexOf(key)
    })
  }

  /**
   * Compile a "where date" clause.
   *
   * @param  {\Illuminate\Database\Query\Builder}  query
   * @param  {Where}  where
   * @return {string}
   */
  whereDate (query, where) {
    const value = this.parameter(where.value)

    return 'cast(' + this.wrap(where.column) + ' as date) ' + String(where.operator) + ' ' + value
  }

  /**
   * Compile a "where time" clause.
   *
   * @param  {\Illuminate\Database\Query\Builder}  query
   * @param  {Where}  where
   * @return {string}
   */
  whereTime (query, where) {
    const value = this.parameter(where.value)

    return 'cast(' + this.wrap(where.column) + ' as time) ' + String(where.operator) + ' ' + value
  }

  /**
   * Wrap a table in keyword identifiers.
   *
   * @param  {\Illuminate\Database\Query\Expression|string}  table
   * @return {string}
   */
  wrapTable (table) {
    if (!this.isExpression(table)) {
      return this.wrapTableValuedFunction(super.wrapTable(table))
    }

    return this.getValue(table)
  }

  /**
   * Wrap a table in keyword identifiers.
   *
   * @param  {string}  table
   * @return {string}
   */
  wrapTableValuedFunction (table) {
    const matches = [...table.matchAll(/^(.+?)(\(.*?\))]/g)]

    if (matches.length > 0) {
      table = matches[0][1] + ']' + matches[0][2]
    }

    return table
  }

  /**
   * Wrap a union subquery in parentheses.
   *
   * @param  {string}  sql
   * @return {string}
   */
  wrapUnion (sql) {
    return 'select * from (' + sql + ') as ' + this.wrapTable('temp_table')
  }

  /**
   * Wrap a single string in keyword identifiers.
   *
   * @param  {string}  value
   * @return {string}
   */
  wrapValue (value) {
    return value === '*' ? value : '[' + value.replace(']', ']]') + ']'
  }
}

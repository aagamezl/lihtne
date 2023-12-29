// import { isTruthy } from '@devnetic/utils'
import { isTruthy } from '../../../Support/index.js'
import Grammar from './Grammar.js'

export default class MySqlGrammar extends Grammar {
  constructor () {
    super(...arguments)

    /**
     * The grammar specific operators.
     *
     * @type {string[]}
     */
    this.operators = ['sounds like']
  }

  /**
   * Compile an insert statement into SQL.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {unknown[]}  values
   * @returns {string}
   */
  compileInsert (query, values) {
    if (values.length === 0) {
      values = [[]]
    }

    return super.compileInsert(query, values)
  }

  /**
   * Compile an insert ignore statement into SQL.
   *
   * @param  {\Illuminate\Database\Query\Builder}  query
   * @param  {Record<string, any>}  values
   * @return {string}
   */
  compileInsertOrIgnore (query, values) {
    return this.compileInsert(query, values).replace('insert', 'insert ignore')
  }

  /**
   * Compile an update statement without joins into SQL.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {string}  table
   * @param  {string}  columns
   * @param  {string}  where
   * @return {string}
   */
  compileUpdateWithoutJoins (query, table, columns, where) {
    let sql = super.compileUpdateWithoutJoins(query, table, columns, where)

    if (query.orders.length > 0) {
      sql += ' ' + this.compileOrders(query, query.orders)
    }

    if (query.limitProperty !== undefined) {
      sql += ' ' + this.compileLimit(query, query.limitProperty)
    }

    return sql
  }

  /**
   * Compile a "where fulltext" clause.
   *
   * @param  {\Illuminate\Database\Query\Builder}  query
   * @param  {Where}  where
   * @return {string}
   */
  whereFulltext (query, where) {
    const columns = this.columnize(where.columns)

    const value = this.parameter(where.value)

    const mode = (where.options.mode ?? []) === 'boolean'
      ? ' in boolean mode'
      : ' in natural language mode'

    const expanded = (isTruthy(where.options.expanded) ?? []) && (where.options.mode ?? []) !== 'boolean'
      ? ' with query expansion'
      : ''

    return `match (${columns}) against (` + value + `${mode}${expanded})`
  }

  /**
   * Add a "where null" clause to the query.
   *
   * @param  {\Illuminate\Database\Query\Builder}  query
   * @param  {Where}  where
   * @return {string}
   */
  whereNull (query, where) {
    const columnValue = this.getValue(where.column)

    if (this.isJsonSelector(columnValue)) {
      const [field, path] = this.wrapJsonFieldAndPath(columnValue)

      return '(json_extract(' + field + path + ') is null OR json_type(json_extract(' + field + path + ')) = \'NULL\')'
    }

    return super.whereNull(query, where)
  }

  /**
   * Add a "where not null" clause to the query.
   *
   * @param  {\Illuminate\Database\Query\Builder}  query
   * @param  {Where}  where
   * @return {string}
   */
  whereNotNull (query, where) {
    const columnValue = this.getValue(where.column)

    if (this.isJsonSelector(columnValue)) {
      const [field, path] = this.wrapJsonFieldAndPath(columnValue)

      return '(json_extract(' + field + path + ') is not null AND json_type(json_extract(' + field + path + ')) != \'NULL\')'
    }

    return super.whereNotNull(query, where)
  }

  /**
   * Wrap the given JSON selector for boolean values.
   *
   * @param  {string}  value
   * @return {string}
   */
  wrapJsonBooleanSelector (value) {
    const [field, path] = this.wrapJsonFieldAndPath(value)

    return `json_extract(${field}${path})`
  }

  /**
   * Wrap the given JSON selector.
   *
   * @param  {string}  value
   * @return {string}
   */
  wrapJsonSelector (value) {
    const [field, path] = this.wrapJsonFieldAndPath(value)

    return 'json_unquote(json_extract(' + field + path + '))'
  }

  /**
   * Wrap a single string in keyword identifiers.
   *
   * @param  {string}  value
   * @return {string}
   */
  wrapValue (value) {
    return value === '*' ? value : '`' + value.replace('`', '``') + '`'
  }
}

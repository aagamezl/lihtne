import { isPlainObject } from '@devnetic/utils'

import { collect } from '../Collections/helpers.js'
import Expression from './Query/Expression.js'

export default class Grammar {
  constructor () {
    /**
     * The grammar table prefix.
     *
     * @var string
     */
    this.tablePrefix = ''
  }

  /**
   * Convert an array of column names into a delimited string.
   *
   * @param  {Array<string | Expression>}  columns
   * @return {string}
   */
  columnize (columns) {
    return columns.map(column => this.wrap(column)).join(', ')
  }

  /**
   * Get the format for database stored dates.
   *
   * @return {string}
   */
  getDateFormat () {
    return 'Y-m-d H:i:s'
  }

  /**
   * Get the value of a raw expression.
   *
   * @param  {\Illuminate\Database\Query\Expression}  expression
   * @return {unknown}
   */
  getValue (expression) {
    // return expression.getValue()
    if (this.isExpression(expression)) {
      return this.getValue(expression.getValue(this))
    }

    return expression
  }

  /**
   * Determine if the given value is a raw expression.
   *
   * @param  {unknown}  value
   * @return {bool}
   */
  isExpression (value) {
    return value instanceof Expression
  }

  /**
   * Determine if the given string is a JSON selector.
   *
   * @param  {string}  value
   * @return {boolean}
   */
  isJsonSelector (value) {
    return value.includes('->')
  }

  /**
   * Get the appropriate query parameter place-holder for a value.
   *
   * @param  {unknown}  value
   * @return {string}
   */
  parameter (value) {
    return this.isExpression(value) ? this.getValue(value) : '?'
  }

  /**
   * Create query parameter place-holders for an array.
   *
   * @param  {Array}  values
   * @return {string}
   */
  parameterize (values) {
    // return (Array.isArray(values) ? values : Object.values(values))
    // return (Array.isArray(values) ? values : [values])
    // TODO: clean up commented code
    return (Array.isArray(values) && isPlainObject(values) ? values : Object.values(values))
      .map((value) => this.parameter(value)).join(', ')
  }

  /**
   * Set the grammar's table prefix.
   *
   * @param  {string}  prefix
   * @return {this}
   */
  setTablePrefix (prefix) {
    this.tablePrefix = prefix
    return this
  }

  /**
   * Wrap a value in keyword identifiers.
   *
   * @param  {\Illuminate\Database\Query\Expression|string}  value
   * @param  {boolean}  prefixAlias
   * @return {string}
   */
  wrap (value, prefixAlias = false) {
    if (this.isExpression(value)) {
      return this.getValue(value)
    }

    // If the value being wrapped has a column alias we will need to separate out
    // the pieces so we can wrap each of the segments of the expression on its
    // own, and then join these both back together using the "as" connector.
    if (/\sas\s/i.test(value)) {
      return this.wrapAliasedValue(value, prefixAlias)
    }

    // If the given value is a JSON selector we will wrap it differently than a
    // traditional value. We will need to split this path and wrap each part
    // wrapped, etc. Otherwise, we will simply wrap the value as a string.
    if (this.isJsonSelector(value)) {
      return this.wrapJsonSelector(value)
    }

    return this.wrapSegments(value.split('.'))
  }

  /**
   * Wrap a value that has an alias.
   *
   * @param  {string}  value
   * @param  {boolean}  prefixAlias
   * @return {string}
   */
  wrapAliasedValue (value, prefixAlias = false) {
    const segments = value.split(/\s+as\s+/i)
    // If we are wrapping a table we need to prefix the alias with the table prefix
    // as well in order to generate proper syntax. If this is a column of course
    // no prefix is necessary. The condition will be true when from wrapTable.
    if (prefixAlias) {
      segments[1] = this.tablePrefix + segments[1]
    }
    return this.wrap(segments[0]) + ' as ' + this.wrapValue(segments[1])
  }

  /**
   * Wrap the given JSON selector.
   *
   * @param  {string}  value
   * @return {string}
   *
   * @throws \RuntimeException
   */
  wrapJsonSelector (value) {
    throw new Error('RuntimeException: This database engine does not support JSON operations.')
  }

  /**
   * Wrap the given value segments.
   *
   * @param  {Array}  segments
   * @return {string}
   */
  wrapSegments (segments) {
    return collect(segments).map((segment, key) => {
      return key === 0 && segments.length > 1
        ? this.wrapTable(segment)
        : this.wrapValue(segment)
    }).join('.')
  }

  /**
   * Wrap a table in keyword identifiers.
   *
   * @param  {\Illuminate\Database\Query\Expression|string}  table
   * @return {string}
   */
  wrapTable (table) {
    if (!this.isExpression(table)) {
      return this.wrap(this.tablePrefix + table, true)
    }

    return this.getValue(table)
  }

  /**
   * Wrap a single string in keyword identifiers.
   *
   * @param  {string}  value
   * @return {string}
   */
  wrapValue (value) {
    if (value !== '*') {
      return '"' + value.replace('"', '""') + '"'
    }
    return value
  }
}

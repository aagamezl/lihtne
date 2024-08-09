import { collect } from '../Collections/helpers.js'
import Macroable from '../Macroable/Traits/Macroable.js'
import { CustomException } from '../Support/helpers.js'
import { mix } from '../Support/Traits/use.js'
// import use from '../Support/Traits/use.js'
import Expression from './Query/Expression.js'

/**
 * @class
 * @abstract
 */
export default class Grammar extends mix().use(Macroable) {
  constructor () {
    super()
    // use(Grammar, [Macroable])

    if (new.target === Grammar) {
      throw CustomException('abstract')
    }

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
 * Compile an update from statement into SQL.
 *
 * @param  {import('./Query/Builder.js').default}  query
 * @param  {Record<string, unknown>}  values
 * @return {string}
 *
 * @throws{ RuntimeException}
 */
  compileUpdateFrom (query, values) {
    throw new Error('RuntimeException: This database engine does not support update from.')
  }

  /**
   * Escapes a value for safe SQL embedding.
   *
   * @param  {string|number|boolean|null}  value
   * @param  {boolean}  [binary=false]
   * @return {string}
   */
  escape (value, binary = false) {
    if (!this.connection) {
      throw new Error("RuntimeException: The database driver's grammar implementation does not support escaping values.")
    }

    return this.connection.escape(value, binary)
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
   * Get the grammar's table prefix.
   *
   * @return {string}
   */
  getTablePrefix () {
    return this.tablePrefix
  }

  /**
   * Get the value of a raw expression.
   *
   * @param  {Expression|string|number}  expression
   * @return {any}
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
   * @param  {any}  value
   * @return {boolean}
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
   * @param  {any}  value
   * @return {string}
   */
  parameter (value) {
    return this.isExpression(value) ? this.getValue(value) : '?'
  }

  /**
   * Create query parameter place-holders for an array.
   *
   * @param  {any[]}  values
   * @return {string}
   */
  parameterize (values) {
    return (Array.isArray(values) ? values : Object.values(values))
      .map((value) => this.parameter(value)).join(', ')
  }

  /**
   * Set the grammar's database connection.
   *
   * @param  {import('./Connection.js').default}  connection
   * @return {this}
   */
  setConnection (connection) {
    this.connection = connection

    return this
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
   * @param  {Expression|string}  value
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
    // if (/\sas\s/i.test(value)) {
    if (value.includes(' as ')) {
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
   * Wrap a table that has an alias.
   *
   * @protected
   * @param {string} value The table value with alias
   * @returns {string} The wrapped table with alias
   */
  wrapAliasedTable (value) {
    const segments = value.split(/\s+as\s+/i)

    return this.wrapTable(segments[0]) + ' as ' + this.wrapValue(this.tablePrefix + segments[1])
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
   * @param  {Expression|string}  table
   * @return {string}
   */
  wrapTable (table) {
    // if (!this.isExpression(table)) {
    //   return this.wrap(this.tablePrefix + table, true)
    // }

    // return this.getValue(table)

    if (this.isExpression(table)) {
      return this.getValue(table)
    }

    // If the table being wrapped has an alias we'll need to separate the pieces
    // so we can prefix the table and then wrap each of the segments on their
    // own and then join these both back together using the "as" connector.
    if (table.toLowerCase().includes(' as ')) {
      return this.wrapAliasedTable(table)
    }

    // If the table being wrapped has a custom schema name specified, we need to
    // prefix the last segment as the table name then wrap each segment alone
    // and eventually join them both back together using the dot connector.
    if (table.includes('.')) {
      const lastDotIndex = table.lastIndexOf('.')

      table = table.substring(0, lastDotIndex) + '.' + this.tablePrefix + table.substring(lastDotIndex + 1)

      // return collect(table.split('.'))
      return collect(table.split('.'))
        .map(this.wrapValue)
        .implode('.')
    }

    return this.wrapValue(this.tablePrefix + table)
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

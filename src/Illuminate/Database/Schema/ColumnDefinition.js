import Fluent from '../../Support/Fluent.js'

/** @typedef {import('../Query/Expression.js').default} Expression */

export default class ColumnDefinition extends Fluent {
  /**
   * Place the column "after" another column(MySQL)
   *
   * @param {string} column
   * @returns {this}
   */
  after (column) {
    this.attributes.after = column

    return this
  }

  /**
   * Used as a modifier for generatedAs() (PostgreSQL).
   *
   * @param {boolean} value
   * @returns {this}
   */
  always (value = true) {
    // Implementation here
    return this
  }

  /**
   * Set INTEGER columns as auto-increment (primary key).
   *
   * @returns {this}
   */
  autoIncrement () {
    // Implementation here
    return this
  }

  /**
   * Change the column.
   *
   * @returns {this}
   */
  change () {
    // Implementation here
    return this
  }

  /**
   * Specify a character set for the column (MySQL).
   *
   * @param {string} charset
   * @returns {this}
   */
  charset (charset) {
    // Implementation here
    return this
  }

  /**
   * Specify a collation for the column.
   *
   * @param {string} collation
   * @returns {this}
   */
  collation (collation) {
    this.offsetSet('collation', collation)

    return this
  }

  /**
   * Add a comment to the column (MySQL/PostgreSQL).
   *
   * @param {string} comment
   * @returns {this}
   */
  comment (comment) {
    this.offsetSet('comment', comment)

    return this
  }

  /**
   * Specify a "default" value for the column.
   *
   * @param {any} value
   * @returns {this}
   */
  default (value) {
    // Implementation here
    return this
  }

  /**
   * Place the column "first" in the table (MySQL).
   *
   * @returns {this}
   */
  first () {
    // Implementation here
    return this
  }

  /**
   * Set the starting value of an auto-incrementing field (MySQL / PostgreSQL).
   *
   * @param {number} startingValue
   * @returns {this}
   */
  from (startingValue) {
    this.offsetSet('from', startingValue)

    return this
  }

  /**
   * Create a SQL compliant identity column (PostgreSQL).
   *
   * @param {string|Expression} [expression]
   * @returns {this}
   */
  generatedAs (expression = undefined) {
    // Implementation here
    return this
  }

  /**
   * Add an index.
   *
   * @param {boolean|string} [indexName]
   * @returns {this}
   */
  index (indexName = undefined) {
    // Implementation here
    return this
  }

  /**
   * Specify that the column should be invisible to "SELECT *" (MySQL).
   *
   * @returns {this}
   */
  invisible () {
    // Implementation here
    return this
  }

  /**
   * Allow NULL values to be inserted into the column.
   *
   * @param {boolean} value
   * @returns {this}
   */
  nullable (value = true) {
    // Implementation here
    return this
  }

  /**
   * Mark the computed generated column as persistent (SQL Server).
   *
   * @returns {this}
   */
  persisted () {
    // Implementation here
    return this
  }

  /**
   * Add a primary index.
   *
   * @param {boolean} value
   * @returns {this}
   */
  primary (value = true) {
    // Implementation here
    return this
  }

  /**
   * Add a fulltext index.
   *
   * @param {boolean|string} [indexName]
   * @returns {this}
   */
  fulltext (indexName = undefined) {
    // Implementation here
    return this
  }

  /**
   * Add a spatial index.
   *
   * @param {boolean|string} [indexName]
   * @returns {this}
   */
  spatialIndex (indexName = undefined) {
    // Implementation here
    return this
  }

  /**
   * Set the starting value of an auto-incrementing field (MySQL/PostgreSQL).
   *
   * @param {number} startingValue
   * @returns {this}
   */
  startingValue (startingValue) {
    this.attributes.startingValue = startingValue

    return this
  }

  /**
   * Create a stored generated column (MySQL/PostgreSQL/SQLite).
   *
   * @param {string|Expression} expression
   * @returns {this}
   */
  storedAs (expression) {
    // Implementation here
    return this
  }

  /**
   * Specify a type for the column.
   *
   * @param {string} type
   * @returns {this}
   */
  type (type) {
    // Implementation here
    return this
  }

  /**
   * Add a unique index.
   *
   * @param {boolean|string} [indexName]
   * @returns {this}
   */
  unique (indexName = undefined) {
    // Implementation here
    return this
  }

  /**
   * Set the INTEGER column as UNSIGNED (MySQL).
   *
   * @returns {this}
   */
  unsigned () {
    // Implementation here
    return this
  }

  /**
   * Set the TIMESTAMP column to use CURRENT_TIMESTAMP as default value.
   *
   * @returns {this}
   */
  useCurrent () {
    // Implementation here
    return this
  }

  /**
   * Set the TIMESTAMP column to use CURRENT_TIMESTAMP when updating (MySQL).
   *
   * @returns {this}
   */
  useCurrentOnUpdate () {
    // Implementation here
    return this
  }

  /**
   * Create a virtual generated column (MySQL/PostgreSQL/SQLite).
   *
   * @param {string|Expression} expression
   * @returns {this}
   */
  virtualAs (expression) {
    // Implementation here
    return this
  }
}

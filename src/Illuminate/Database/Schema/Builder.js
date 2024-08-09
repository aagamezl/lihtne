export default class Builder {
  /**
   * The database connection instance.
   *
   * @protected
   * @type {import('../Connection.js').default}
   */
  connection

  /**
   * The default string length for migrations.
   *
   * @type {number|undefined}
   */
  static defaultStringLength = 255

  /**
   * The default relationship morph key type.
   *
   * @type {string}
   */
  static defaultMorphKeyType = 'int'

  /**
   * Create a new database Schema manager.
   *
   * @param  {import('../Connection.js').default}  connection
   */
  constructor (connection) {
    this.connection = connection
    this.grammar = connection.getSchemaGrammar()
  }

  /**
   * Get the columns for a given table.
   *
   * @param  {string}  table
   * @return {array}
   */
  getColumns (table) {
    table = this.connection.getTablePrefix() + table

    return this.connection.getPostProcessor().processColumns(
      this.connection.selectFromWriteConnection(this.grammar.compileColumns(table))
    )
  }
}

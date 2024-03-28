import SQLiteDriver from './../Database/PDO/SQLiteDriver.js'
import { SQLiteGrammar as QueryGrammar } from '../Database/Query/Grammars/index.js'
import Connection from './Connection.js'
import { bin2hex } from '../Support/helpers.js'

export default class SQLiteConnection extends Connection {
  constructor (ndo, database = '', tablePrefix = '', config = {}) {
    super(ndo, database, tablePrefix, config)

    const enableForeignKeyConstraints = this.getForeignKeyConstraintsConfigurationValue()

    if (enableForeignKeyConstraints === undefined) {
      return
    }

    enableForeignKeyConstraints
      ? this.getSchemaBuilder().enableForeignKeyConstraints()
      : this.getSchemaBuilder().disableForeignKeyConstraints()
  }

  /**
 * Escape a binary value for safe SQL embedding.
 *
 * @protected
 * @param  {string}  value
 * @return {string}
 */
  escapeBinary (value) {
    const hex = bin2hex(value)

    return `x'${hex}'`
  }

  /**
   * Get the default query grammar instance.
   *
   * @protected
   * @return {import('../Database/Query/Grammars/SQLiteGrammar.js').default}
   */
  getDefaultQueryGrammar () {
    const grammar = new QueryGrammar()

    grammar.setConnection(this)

    return this.withTablePrefix(grammar)
  }

  /**
   * Get the Doctrine DBAL driver.
   *
   * @protected
   * @return {\Illuminate\Database\PDO\SQLiteDriver}
   */
  getDoctrineDriver () {
    return new SQLiteDriver()
  }

  /**
   * Get the database connection foreign key constraints configuration option.
   *
   * @protected
   * @return {boolean|undefined}
   */
  getForeignKeyConstraintsConfigurationValue () {
    return this.getConfig('foreign_key_constraints')
  }

  /**
   * Determine if the given database exception was caused by a unique constraint violation.
   *
   * @protected
   * @param  {Error}  exception
   * @return {boolean}
   */
  isUniqueConstraintError (exception) {
    return /(column(s)? .* (is|are) not unique|UNIQUE constraint failed: .*)/i.test(exception.getMessage())
  }
}

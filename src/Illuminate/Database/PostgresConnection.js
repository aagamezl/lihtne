// import { isNil } from '@devnetic/utils'

import Connection from './Connection.js'
// import PostgresBuilder from './Schema/PostgresBuilder.js'
// import PostgresDriver from './../Database/PDO/PostgresDriver.js'
import QueryGrammar from '../Database/Query/Grammars/PostgresGrammar.js'
import PostgresProcessor from './../Database/Query/Processors/PostgresProcessor.js'
// import PostgresStatement from './../Database/Statements/PostgresStatement.js'

export default class PostgresConnection extends Connection {
  /**
   * Escape a binary value for safe SQL embedding.
   *
   * @protected
   * @param {string} value - The binary value to escape.
   * @returns {string} - The escaped binary value.
   */
  escapeBinary (value) {
    const hex = Buffer.from(value).toString('hex')

    return `'\\x${hex}'::bytea`
  }

  /**
   * Escape a bool value for safe SQL embedding.
   *
   * @protected
   * @param {boolean} value - The boolean value to escape.
   * @returns {string} - The escaped boolean value.
   */
  escapeBool (value) {
    return value ? 'true' : 'false'
  }

  /**
   * Get the default query grammar instance.
   *
   * @protected
   * @return {import('./Query/Grammars/PostgresGrammar.js').default}
   */
  getDefaultQueryGrammar () {
    const grammar = new QueryGrammar()
    grammar.setConnection(this)

    return this.withTablePrefix(grammar)
  }

  /**
   * Get the default post processor instance.
   *
   *
   * @return {import('./Query/Processors/PostgresProcessor.js').default}
   */
  getDefaultPostProcessor () {
    return new PostgresProcessor()
  }

  /**
 * Determine if the given database exception was caused by a unique constraint violation.
 *
 * @protected
 * @param {Error} exception - The exception object.
 * @returns {boolean} - Whether the exception indicates a unique constraint violation.
 */
  isUniqueConstraintError (exception) {
    // Assuming the error code is attached to the exception object
    return exception.code === '23505'
  }
}

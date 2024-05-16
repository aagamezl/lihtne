import PostgresStatement from '../Statements/PostgresStatement.js'
import Driver from './Driver.js'

export default class PostgresDriver extends Driver {
  /**
   *
   * @overload
   * @override
   * @param {string} query
   * @returns {PostgresStatement}
   * @throws {Error}
   */
  prepare (query) {
    return new PostgresStatement(this.dsn, this.options, query)
  }
}

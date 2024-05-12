import Connection from './Connection.js'

export default class SqlServerConnection extends Connection {
  /**
   * Compile the command to disable foreign key constraints.
   *
   * @return {string}
   */
  compileDisableForeignKeyConstraints () {
    return 'EXEC sp_msforeachtable "ALTER TABLE ? NOCHECK CONSTRAINT all";'
  }
}

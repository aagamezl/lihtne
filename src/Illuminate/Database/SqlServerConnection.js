import Connection from './Connection.js'
// import SqlServerDriver from './../Database/PDO/SqlServerDriver.js'

export default class SqlServerConnection extends Connection {
  /**
   * Compile the command to disable foreign key constraints.
   *
   * @return {string}
   */
  compileDisableForeignKeyConstraints () {
    return 'EXEC sp_msforeachtable "ALTER TABLE ? NOCHECK CONSTRAINT all";'
  }

  /**
   * Get the Doctrine DBAL driver.
   *
   * @return {\Illuminate\Database\PDO\SqlServerDriver}
   */
  // getDoctrineDriver () {
  //   return new SqlServerDriver()
  // }
}

export default class StatementPrepared {
  /**
   * Create a new event instance.
   *
   * @param  {import('./../Connection').default}  connection
   * @param  {import('./../Statements/Statement.js').default}  statement
   */
  constructor (connection, statement) {
    this.connection = connection
    this.statement = statement
  }
}

export default class StatementPrepared {
  /**
   * Create a new event instance.
   *
   * @param  {import('./../Connection').default}  connection
   * @param  {Statement}  statement
   * @return {void}
   */
  constructor (connection, statement) {
    this.connection = connection
    this.statement = statement
  }
}

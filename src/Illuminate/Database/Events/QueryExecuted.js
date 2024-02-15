export default class QueryExecuted {
  /**
   * Create a new event instance.
   *
   * @param  {string}  sql
   * @param  {array}  bindings
   * @param  {number}  [time]
   * @param  {import('./../Connection').default}  connection
   * @return {void}
   */
  constructor (sql, bindings, time, connection) {
    this.sql = sql
    this.time = time
    this.bindings = bindings
    this.connection = connection
    this.connectionName = connection.getName()
  }
}

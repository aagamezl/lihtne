export default class QueryExecuted {
  /**
   * Create a new event instance.
   *
   * @param  {string}  sql
   * @param  {array}  bindings
   * @param  {number|null}  time
   * @param  {import('./../Connection').default}  connection
   */
  constructor (sql, bindings, time, connection) {
    this.sql = sql
    this.time = time
    this.bindings = bindings
    this.connection = connection
    this.connectionName = connection.getName()
  }

  /**
   * Get the raw SQL representation of the query with embedded bindings.
   *
   * @return {string}
   */
  toRawSql () {
    return this.connection
      .query()
      .getGrammar()
      .substituteBindingsIntoRawSql(this.sql, this.connection.prepareBindings(this.bindings))
  }
}

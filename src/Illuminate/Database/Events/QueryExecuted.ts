import { Connection } from "../Connection"
import { Bindings } from "../Query"

export default class QueryExecuted {
  /**
 * The SQL query that was executed.
 *
 * @var string
 */
  public sql;

  /**
   * The array of query bindings.
   *
   * @var array
   */
  public bindings;

  /**
   * The number of milliseconds it took to execute the query.
   *
   * @var float
   */
  public time;

  /**
   * The database connection instance.
   *
   * @var \Illuminate\Database\Connection
   */
  public connection;

  /**
   * The database connection name.
   *
   * @var string
   */
  public connectionName;

  /**
   * Create a new event instance.
   *
   * @param  {string}  sql
   * @param  {array}  bindings
   * @param  {number|null}  time
   * @param  {import('./../Connection').default}  connection
   */
  constructor(
    sql: string,
    bindings: Bindings,
    time: number = 0,
    connection: Connection
  ) {
    this.sql = sql
    this.time = time
    this.bindings = bindings
    this.connection = connection
    this.connectionName = connection.getName()
  }

  // /**
  //  * Get the raw SQL representation of the query with embedded bindings.
  //  *
  //  * @return {string}
  //  */
  // toRawSql() {
  //   return this.connection
  //     .query()
  //     .getGrammar()
  //     .substituteBindingsIntoRawSql(this.sql, this.connection.prepareBindings(this.bindings))
  // }
}
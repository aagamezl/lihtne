import { type Connection } from '../Connection'
import { type BindingValues } from '../Query'

export class QueryExecuted {
  /**
   * The SQL query that was executed.
   *
   * @var string
   */
  public sql: string

  /**
   * The array of query bindings.
   *
   * @var array
   */
  public bindings: BindingValues

  /**
   * The number of milliseconds it took to execute the query.
   *
   * @var float
   */
  public time: number

  /**
   * The database connection instance.
   *
   * @var \Illuminate\Database\Connection
   */
  public connection: Connection

  /**
   * The database connection name.
   *
   * @var string
   */
  public connectionName: string

  /**
   * Create a new event instance.
   *
   * @param  {string}  sql
   * @param  {array}  bindings
   * @param  {number|null}  time
   * @param  {Connection}  connection
   */
  constructor (
    sql: string,
    bindings: BindingValues,
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

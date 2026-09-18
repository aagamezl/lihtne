import { type Driver } from './Drivers/Driver'
import { type Grammar } from './Grammar'
import { Processor, Grammar as QueryGrammar } from './Query'

export type ConnectionConfig = Record<string, unknown>

export class Connection {
  // The query grammar implementation.
  protected queryGrammar: QueryGrammar | undefined = undefined

  // The name of the connected database.
  protected database: string

  // The query post processor implementation.
  protected postProcessor: Processor | undefined = undefined

  /**
   * The active driver connection.
   *
   * @protected
   * @type {Driver}
   */
  driver: Driver | Function

  // The table prefix for the connection.
  protected tablePrefix = ''

  // The database connection configuration options.
  protected config: ConnectionConfig = {}

  /**
   * Create a new database connection instance.
   *
   * @param  \PDO|(\Closure(): \PDO)  $pdo
   * @param  string  $database
   * @param  string  $tablePrefix
   * @param  array  $config
   */
  constructor (
    driver: Driver,
    database: string = '',
    tablePrefix: string = '',
    config: ConnectionConfig = {}
  ) {
    // super()

    this.driver = driver

    // First we will setup the default properties. We keep track of the DB
    // name we are connected to since it is needed when some reflective
    // type commands are run such as checking whether a table exists.
    this.database = database

    this.tablePrefix = tablePrefix

    this.config = config

    // We need to initialize a query grammar and the query post processors
    // which are both very important parts of the database abstractions
    // so we initialize these to their default values while starting.
    this.useDefaultQueryGrammar()

    this.useDefaultPostProcessor()
  }

  /**
   * Get the table prefix for the connection.
   *
   * @return string
   */
  public getTablePrefix (): string {
    return this.tablePrefix
  }

  /**
   * Get the query grammar used by the connection.
   *
   * @return \Illuminate\Database\Query\Grammars\Grammar
   */
  public getQueryGrammar (): Grammar {
    return this.queryGrammar!
  }

  /**
   * Get the query post processor used by the connection.
   *
   * @return \Illuminate\Database\Query\Processors\Processor
   */
  public getPostProcessor () {
    return this.postProcessor
  }

  /**
   * Get the name of the connected database.
   *
   * @return string
   */
  public getDatabaseName () {
    return this.database
  }

  /**
 * Set the query grammar to the default implementation.
 *
 * @return void
 */
  public useDefaultQueryGrammar () {
    this.queryGrammar = this.getDefaultQueryGrammar()
  }

  /**
   * Get the default query grammar instance.
   *
   * @return \Illuminate\Database\Query\Grammars\Grammar
   */
  protected getDefaultQueryGrammar () {
    return new QueryGrammar(this)
  }

  /**
 * Set the query post processor to the default implementation.
 *
 * @return void
 */
  public useDefaultPostProcessor () {
    this.postProcessor = this.getDefaultPostProcessor()
  }

  /**
 * Get the default post processor instance.
 *
 * @return \Illuminate\Database\Query\Processors\Processor
 */
  protected getDefaultPostProcessor () {
    return new Processor()
  }
}

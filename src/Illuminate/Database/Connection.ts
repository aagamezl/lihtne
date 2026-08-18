import { Grammar as QueryGrammar } from './Query'
import { Grammar } from './Grammar'
import { Processor } from './Query'
import { Driver } from './Drivers'

export class Connection {
  /**
   * The active driver connection.
   *
   * @protected
   * @type {Driver}
   */
  driver: Driver | Function

  // The name of the connected database.
  protected database: string

  // The table prefix for the connection.
  protected tablePrefix = ''

  // The database connection configuration options.
  protected config: Record<string, unknown> = {}

  // The query grammar implementation.
  protected queryGrammar: QueryGrammar | undefined = undefined

  // The query post processor implementation.
  protected postProcessor: Processor | undefined = undefined

  /**
   * Create a new database connection instance.
   *
   * @param  \PDO|(\Closure(): \PDO)  $pdo
   * @param  string  $database
   * @param  string  $tablePrefix
   * @param  array  $config
   */
  constructor(
    driver: Driver,
    database: string = '',
    tablePrefix: string = '',
    config: Record<string, unknown> = {}
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
 * Set the query grammar to the default implementation.
 *
 * @return void
 */
  public useDefaultQueryGrammar() {
    this.queryGrammar = this.getDefaultQueryGrammar()
  }

  /**
   * Get the default query grammar instance.
   *
   * @return \Illuminate\Database\Query\Grammars\Grammar
   */
  protected getDefaultQueryGrammar() {
    return new QueryGrammar(this)
  }

  /**
   * Set the query post processor to the default implementation.
   *
   * @return void
   */
  public useDefaultPostProcessor() {
    this.postProcessor = this.getDefaultPostProcessor()
  }

  /**
   * Get the default post processor instance.
   *
   * @return \Illuminate\Database\Query\Processors\Processor
   */
  protected getDefaultPostProcessor() {
    return new Processor()
  }

  /**
   * Get the query grammar used by the connection.
   *
   * @return \Illuminate\Database\Query\Grammars\Grammar
   */
  public getQueryGrammar(): Grammar {
    return this.queryGrammar!
  }

  /**
 * Get the query post processor used by the connection.
 *
 * @return \Illuminate\Database\Query\Processors\Processor
 */
  public getPostProcessor() {
    return this.postProcessor
  }
}

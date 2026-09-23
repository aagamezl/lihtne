import { dateFormat } from '@devnetic/utils'
import { isNil } from 'es-toolkit'

import type { Dispatcher } from '../Contracts'
import type { Driver } from './Drivers/Driver'
import type { Grammar } from './Grammar'
import type { BindingValues } from './Query/Builder'
import type { Statement } from './Statements'

import { Arr } from '../Collections'
import { mixing } from '../Support'
import { DetectsLostConnections } from './DetectsLostConnections'
import { QueryExecuted, StatementPrepared } from './Events'
import { Grammar as QueryGrammar } from './Query/Grammars/Grammar'
import { Processor } from './Query/Processors/Processor'
// import { type BindingValues, Processor, Grammar as QueryGrammar } from './Query/index-backup'

export type QueryLogEntry = {
  query: string
  bindings: BindingValues
  time: number
}

export type ConnectionConfig = Record<string, unknown>
export type Reconnector = (connection: Connection) => unknown

export interface Connection extends DetectsLostConnections { }

export class Connection extends mixing().useTrait([DetectsLostConnections]) {
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
 * Indicates if the connection is in a "dry run".
 *
 * @var bool
 */
  protected pretendingProperty = false

  /**
   * The event dispatcher instance.
   *
   * @var \Illuminate\Contracts\Events\Dispatcher|null
   */
  protected events: Dispatcher | null = null

  /**
    * All of the callbacks that should be invoked before a query is executed.
    *
    * @var (\Closure(string, array, \Illuminate\Database\Connection): mixed)[]
    */
  protected beforeExecutingCallbacks: Function[] = []

  /**
    * The number of active transactions.
    *
    * @var number
    */
  protected transactions = 0

  /**
   * The duration of all executed queries in milliseconds.
   *
   * @var {Number}
   */
  protected totalQueryDurationProperty = 0.0

  /**
   * The reconnector instance for the connection.
   *
   * @var (callable(\Illuminate\Database\Connection): mixed)
   */
  protected reconnector: Reconnector = () => { }

  /**
   * Indicates whether queries are being logged.
   *
   * @var bool
   */
  protected loggingQueries = false

  /**
   * All of the queries run against the connection.
   *
   * @var QueryLogEntry[]
   */
  protected queryLog: QueryLogEntry[] = []

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
    super()

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
   * Escape a value for safe SQL embedding.
   *
   * @param  string|float|int|bool|null  $value
   * @param  bool  $binary
   * @return string
   *
   * @throws \RuntimeException
   */
  public escape (value: string | number | boolean | undefined | null, binary: boolean = false): string {
    if (isNil(value) === true) {
      return 'null'
    } else if (binary) {
      return this.escapeBinary(value)
    } else if (typeof value === 'number') {
      return String(value)
    } else if (typeof value === 'boolean') {
      return this.escapeBool(value)
    } else if (Array.isArray(value)) {
      throw new Error('RuntimeException: The database connection does not support escaping arrays.')
    } else {
      if (value.includes('\0')) {
        throw new Error('RuntimeException: Strings with null bytes cannot be escaped. Use the binary escape option.')
      }

      if (value.isWellFormed() === false) {
        throw new Error('RuntimeException: Strings with invalid UTF-8 byte sequences cannot be escaped.')
      }

      return this.escapeString(value)
    }
  }

  /**
   * Escape a string value for safe SQL embedding.
   *
   * @protected
   * @param  string  value
   * @return {string}
   */
  protected escapeString (value: string): string {
    return this.quote(value)
  }

  /**
 *
 * @param {string} value
 * @returns {string}
 */
  protected quote (value: string): string {
    // Escape special characters within the input string
    const escapedString = value.replace(/'/g, "''")

    return `'${escapedString}'`
  }

  /**
   * Escape a boolean value for safe SQL embedding.
   *
   * @param  bool  $value
   * @return string
   */
  protected escapeBool (value: boolean): string {
    return value ? '1' : '0'
  }

  /**
   * Escape a binary value for safe SQL embedding.
   *
   * @param  string  $value
   * @return string
   *
   * @throws \RuntimeException
   */
  protected escapeBinary (value: string | number | boolean): string {
    throw new Error('RuntimeException: The database connection does not support escaping binary values.')
  }

  /**
   * Run a select statement against the database.
   *
   * @param  string  $query
   * @param  array  $bindings
   * @return array
   */
  async select (
    query: string,
    bindings: BindingValues
  ): Promise<Record<string, unknown>[]> {
    return await this.run(query, bindings, (query: string, bindings: BindingValues) => {
      if (this.pretending()) {
        return []
      }

      // For select statements, we'll simply execute the query and return an array
      // of the database result set. Each element in the array will be a single
      // row from the database table, and will either be an array or objects.
      const statement = this.prepared(
        // this.connection, query
        this.getDriver().prepare(query)
      )

      this.bindValues(statement, this.prepareBindings(bindings))

      statement.execute()

      return statement.fetchAll()
    })
  }

  /**
   * Determine if the given database exception was caused by a unique constraint violation.
   *
   * @param  \Exception  $exception
   * @return bool
   */
  protected isUniqueConstraintError (exception: Error) {
    return false
  }

  /**
   * Run a SQL statement and log its execution context.
   *
   * @param  string  query
   * @param  array  bindings
   * @param  \Closure  callback
   * @return mixed
   *
   * @throws \Illuminate\Database\QueryException
   */
  protected async run (
    query: string,
    bindings: BindingValues,
    callback: Function
  ): Promise<Record<string, unknown>[]> {
    for (const beforeExecutingCallback of this.beforeExecutingCallbacks) {
      await beforeExecutingCallback(query, bindings, this)
    }

    this.reconnectIfMissingConnection()

    const start = Date.now()

    let result

    // Here we will run this query. If an exception occurs we'll determine if it was
    // caused by a connection that has been lost. If that is the cause, we'll try
    // to re-establish connection and re-run the query with a fresh connection.
    try {
      result = this.runQueryCallback(query, bindings, callback)
    } catch (e) {
      result = this.handleQueryException(e as Error, query, bindings, callback)
    }

    // Once we have run the query we will calculate the time that it took to run and
    // then log the query, bindings, and execution time so we will report them on
    // the event that the developer needs them. We'll log time in milliseconds.
    this.logQuery(query, bindings, this.getElapsedTime(start))

    return result
  }

  /**
   * Get the elapsed time in milliseconds since a given starting point.
   *
   * @param  float  $start
   * @return float
   */
  protected getElapsedTime (start: number): number {
    return Number(Math.round((Date.now() - start) * 1000).toPrecision(2))
  }

  /**
   * Handle a query exception.
   *
   * @param  \Illuminate\Database\QueryException  $e
   * @param  string  $query
   * @param  array  $bindings
   * @param  \Closure  $callback
   * @return mixed
   *
   * @throws \Illuminate\Database\QueryException
   */
  protected handleQueryException (
    e: Error,
    query: string,
    bindings: BindingValues,
    callback: Function
  ) {
    if (this.transactions >= 1) {
      throw e
    }

    return this.tryAgainIfCausedByLostConnection(e, query, bindings, callback)
  }

  /**
   * Get the database connection name.
   *
   * @return string|null
   */
  public getName () {
    return this.getConfig('name')
  }

  /**
   * Get an option from the configuration options.
   *
   * @param  [string]  option
   * @return unknown
   */
  public getConfig (option?: string) {
    return Arr.get(this.config, option)
  }

  /**
   * Log a query in the connection's query log.
   *
   * @param  string  query
   * @param  array  bindings
   * @param  float|null  time
   * @return void
   */
  public logQuery (query: string, bindings: BindingValues, time: number) {
    this.totalQueryDurationProperty += time ?? 0.0

    this.event(new QueryExecuted(query, bindings, time, this))

    query = this.pretendingProperty === true
      ? this.queryGrammar?.substituteBindingsIntoRawSql(query, bindings) ?? query
      : query

    if (this.loggingQueries) {
      this.queryLog.push({ query, bindings, time })
    }
  }

  /**
   * Reconnect to the database.
   *
   * @return mixed|false
   *
   * @throws \Illuminate\Database\LostConnectionException
   */
  reconnect () {
    if (typeof this.reconnector === 'function') {
      return this.reconnector(this)
    }

    throw new Error('LostConnectionException: Lost connection and no reconnector available.')
  }

  /**
    * Handle a query exception that occurred during query execution.
    *
    * @param  \Illuminate\Database\QueryException  $e
    * @param  string  $query
    * @param  array  $bindings
    * @param  \Closure  $callback
    * @return mixed
    *
    * @throws \Illuminate\Database\QueryException
    */
  protected tryAgainIfCausedByLostConnection (
    e: Error,
    query: string,
    bindings: BindingValues,
    callback: Function
  ) {
    if (this.causedByLostConnection(e.cause as Error)) {
      this.reconnect()

      return this.runQueryCallback(query, bindings, callback)
    }

    throw e
  }

  /**
   * Run a SQL statement.
   *
   * @param  string  query
   * @param  array  bindings
   * @param  \Closure  callback
   * @return mixed
   *
   * @throws \Illuminate\Database\QueryException
   */
  protected async runQueryCallback (
    query: string,
    bindings: BindingValues,
    callback: Function
  ) {
    // To execute the statement, we'll simply call the callback, which will actually
    // run the SQL against the PDO connection. Then we can calculate the time it
    // took to execute and log the query SQL, bindings and time in our memory.
    try {
      const result = await callback(query, bindings)

      return result
    }
    // If an exception occurs when attempting to run a query, we'll format the error
    // message to include the bindings with SQL, which will make this exception a
    // lot more helpful to the developer instead of just the database's errors.
    catch (e) {
      const exceptionType = this.isUniqueConstraintError(e as Error)
        ? 'UniqueConstraintViolationException'
        : 'QueryException'

      throw new Error(`${exceptionType}: ${JSON.stringify({
        name: this.getNameWithReadWriteType(),
        query,
        bindings: this.prepareBindings(bindings),
        e,
        connectionDetails: this.getConnectionDetails()
      })}`)
    }
  }

  /**
   * Reconnect to the database if a PDO connection is missing.
   *
   * @return void
   */
  reconnectIfMissingConnection () {
    if (isNil(this.driver)) {
      this.reconnect()
    }
  }

  /**
   * Prepare the query bindings for execution.
   *
   * @param  array  bindings
   * @return array
   */
  public prepareBindings (bindings: BindingValues) {
    const grammar = this.getQueryGrammar()

    for (const [key, value] of bindings.entries()) {
      // We need to transform all instances of DateTimeInterface into the actual
      // date string. Each query grammar maintains its own date string format
      // so we'll just ask the grammar for the format to get from the date.
      if (value instanceof Date) {
        bindings[key] = dateFormat(value, grammar.getDateFormat())
      } else if (typeof value === 'boolean') {
        bindings[key] = value ? 1 : 0
      }
    }

    return bindings
  }

  /**
    * Get the current Driver connection.
    *
    * @return {Driver}
    */
  getDriver () {
    if (typeof this.driver === 'function') {
      return this.driver()
    }

    return this.driver
  }

  /**
    * Bind values to their parameters in the given statement.
    *
    * @param  \PDOStatement  $statement
    * @param  array  bindings
    * @return void
    */
  public bindValues (statement: Statement, bindings: BindingValues) {
    for (const [key, value] of Object.entries(bindings)) {
      statement.bindValue(typeof key === 'string' ? key : Number(key) + 1, value)
    }
  }

  /**
    * Fire the given event if possible.
    *
    * @param  mixed  event
    * @return void
    */
  protected event (event: any) {
    this.events?.dispatch(event)
  }

  /**
    * Configure the PDO prepared statement.
    *
    * @param  \PDOStatement  statement
    * @return \PDOStatement
    */
  protected prepared (statement: Statement): Statement {
    this.event(new StatementPrepared(this, statement))

    return statement
  }

  /**
   * Determine if the connection is in a "dry run".
   *
   * @return bool
   */
  pretending () {
    return this.pretendingProperty === true
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

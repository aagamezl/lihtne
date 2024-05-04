import { dateFormat, getValue, isFunction, isNumeric } from '@devnetic/utils'

import DetectsLostConnections from './DetectsLostConnections.js'
import Expression from './Query/Expression.js'
import Processor from './Query/Processors/Processor.js'
import { Builder as QueryBuilder } from './Query/internal.js'
import QueryExecuted from './Events/QueryExecuted.js'
import QueryGrammar from './Query/Grammars/Grammar.js'
import StatementPrepared from './Events/StatementPrepared.js'
import use from '../Support/Traits/use.js'

/**
 * @typedef {Object} QueryLogEntry
 * @property {string} query - The query string.
 * @property {Record<string, unknown>} bindings - Bindings for the query parameters.
 * @property {number} time - The time parameter.
 */

export default class Connection {
  /**
   * The connection resolvers.
   *
   * @var Record<string, unknown>
   */
  static { this.resolvers = {} }

  /**
   * The database connection configuration options.
   *
   * @type {object}
   */
  config = {}

  /**
   * The name of the connected database.
   *
   * @type {string}
   */
  database = ''

  /**
   * The event dispatcher instance.
   *
   * @type {import('../Contracts/Events/Dispatcher.js').default}
   */
  events = undefined

  /**
   * The default fetch mode of the connection.
   *
   * @type {string}
   */
  fetchMode = 'obj' // assoc, obj

  /**
   * Indicates whether queries are being logged.
   *
   * @type {boolean}
   */
  loggingQueries = false

  /**
   * The active NDO connection.
   *
   * @member {object|Function}
   */
  ndo

  /**
   * The query post processor implementation.
   *
   * @type {import('./Query/Processors/Processor.js').default}
   */
  postProcessor

  /**
   * Indicates if the connection is in a "dry run".
   *
   * @type {boolean}
   */
  pretendingConnection = false

  /**
   * The query grammar implementation.
   *
   * @type {import('./Query/Grammars/Grammar.js').default}
   */
  queryGrammar = undefined

  /**
   * All of the queries run against the connection.
   *
   * @type {QueryLogEntry[]}
   */
  queryLog = []

  /**
   * The reconnector instance for the connection.
   *
   * @type {Function}
   */
  reconnector = () => { }

  /**
   * Indicates if changes have been made to the database.
   *
   * @type {boolean}
   */
  recordsModified = false

  /**
   * The table prefix for the connection.
   *
   * @type {string}
   */
  tablePrefix = ''

  /**
   * The number of active transactions.
   *
   * @type {number}
   */
  transactions = 0

  /**
   * Create a new database connection instance.
   *
   * @param  {object|Function}  ndo
   * @param  {string}  database
   * @param  {string}  tablePrefix
   * @param  {object}  config
   * @return {void}
   */
  constructor (ndo, // TODO: verify the real type and remove the any
    database = '', tablePrefix = '', config = {}
  ) {
    // use(this.constructor, [DetectsLostConnections])
    use(Connection, [DetectsLostConnections])

    this.ndo = ndo

    // First we will setup the default properties. We keep track of the DB
    // name we are connected to since it is needed when some reflective
    // type commands are run such as checking whether a table exists.
    this.database = database

    this.tablePrefix = tablePrefix

    this.config = config

    // We need to initialize a query grammar and the query post processors
    // which are both very importa parts of the database abstractions
    // so we initialize these to their default values while starting.
    this.useDefaultQueryGrammar()

    this.useDefaultPostProcessor()
  }

  /**
   * Run an SQL statement and get the number of rows affected.
   *
   * @param  {string}  query
   * @param  {object}  bindings
   * @return {number}
   */
  async affectingStatement (query, bindings = {}) {
    return await this.run(query, bindings, async (query, bindings) => {
      if (this.pretending()) {
        return 0
      }

      // For update or delete statements, we want to get the number of rows affected
      // by the statement and return that back to the developer. We'll first need
      // to execute the statement and then we'll use PDO to fetch the affected.
      const statement = this.getNdo().prepare(query)

      this.bindValues(statement, this.prepareBindings(bindings))

      await statement.execute()

      const count = statement.rowCount()
      this.recordsHaveBeenModified(count > 0)

      return count
    })
  }

  /**
   * Bind values to their parameters in the given statement.
   *
   * @param  {\Illuminate\Database\Statements\Statement}  statement
   * @param  {object}  bindings
   * @return {void}
   */
  bindValues (statement, bindings) {
    for (const [key, value] of Object.entries(bindings)) {
      statement.bindValue(isNumeric(key) ? Number(key) + 1 : key, value)
    }
  }

  /**
   * Run a delete statement against the database.
   *
   * @param  {string}  query
   * @param  {unknown[]}  bindings
   * @return {number}
   */
  delete (query, bindings = []) {
    return this.affectingStatement(query, bindings)
  }

  /**
   * Disconnect from the underlying PDO connection.
   *
   * @return {void}
   */
  disconnect () {
    this.setNdo(undefined)
  }

  /**
   * Fire the given event if possible.
   *
   * @param  {any}  event
   * @return {void}
   */
  event (event) {
    if (this.events !== undefined) {
      this.events.dispatch(event)
    }
  }

  /**
   * Get an option from the configuration options.
   *
   * @param  {string}  [option]
   * @return {unknown}
   */
  getConfig (option) {
    return option === undefined ? this.config : getValue(this.config, option)
  }

  /**
   * Get the name of the connected database.
   *
   * @return {string}
   */
  getDatabaseName () {
    return this.database
  }

  /**
   * Get the default post processor instance.
   *
   * @return {\Illuminate\Database\Query\Processors\Processor}
   */
  getDefaultPostProcessor () {
    return new Processor()
  }

  /**
   * Get the default query grammar instance.
   *
   * @return {\Illuminate\Database\Query\Grammars\Grammar}
   */
  getDefaultQueryGrammar () {
    return new QueryGrammar()
  }

  /**
   * Get the elapsed time since a given starting point.
   *
   * @param  {number}  start
   * @return {number}
   */
  getElapsedTime (start) {
    return parseFloat(Math.fround((Date.now() - start) * 1000).toPrecision(2))
  }

  /**
   * Get the database connection name.
   *
   * @return {string|undefined}
   */
  getName () {
    return this.getConfig('name')
  }

  /**
   * Get the database connection full name.
   *
   * @return {string|undefined}
   */
  getNameWithReadWriteType () {
    return this.getName()
  }

  /**
   * Get the current PDO connection.
   *
   * @return {import('./Statements/Statement.js').default}
   */
  getNdo () {
    if (isFunction(this.ndo)) {
      this.ndo = this.ndo()

      return this.ndo
    }

    return this.ndo
  }

  /**
   * Get the query post processor used by the connection.
   *
   * @return {import('./Query/Processors/Processor.js').default}
   */
  getPostProcessor () {
    return this.postProcessor
  }

  /**
   * Get the query grammar used by the connection.
   *
   * @returns {import('./Query/Grammars/Grammar.js').default}
   */
  getQueryGrammar () {
    return this.queryGrammar
  }

  /**
   * Get the connection resolver for the given driver.
   *
   * @param  {string}  driver
   * @return {any}
   */
  static getResolver (driver) {
    return this.resolvers[driver] ?? undefined
  }

  /**
   * Handle a query exception.
   *
   * @param  {Error}  error
   * @param  {string}  query
   * @param  {Bindings}  bindings
   * @param  {Function}  callback
   * @return {unknown}
   *
   * @throws {Error}
   */
  handleQueryException (error, query, bindings, callback) {
    if (this.transactions >= 1) {
      throw error
    }

    return this.tryAgainIfCausedByLostConnection(error, query, bindings, callback)
  }

  /**
   * Run an insert statement against the database.
   *
   * @param  {string}  query
   * @param  {object}  bindings
   * @return {boolean}
   */
  async insert (query, bindings = {}) {
    return await this.statement(query, bindings)
  }

  /**
   * Log a query in the connection's query log.
   *
   * @param  {string}  query
   * @param  {object}  bindings
   * @param  {number}  time
   * @return {void}
   */
  logQuery (query, bindings, time) {
    this.event(new QueryExecuted(query, bindings, time, this))

    if (this.loggingQueries) {
      this.queryLog.push({ query, bindings, time })
    }
  }

  /**
   * Prepare the query bindings for execution.
   *
   * @param  {object}  object
   * @return {object}
   */
  prepareBindings (bindings) {
    const grammar = this.getQueryGrammar()

    for (const [key, value] of Object.entries(bindings)) {
      // We need to transform all instances of DateTimeInterface into the actual
      // date string. Each query grammar maintains its own date string format
      // so we'll just ask the grammar for the format to get from the date.
      if (value instanceof Date) {
        bindings[key] = dateFormat(value, grammar.getDateFormat())
      } else if (/* isBoolean(value) */typeof value === 'boolean') {
        bindings[key] = Number(value)
      }
    }

    return bindings
  }

  /**
   * Configure the prepare statement.
   *
   * @param  {import('./Statements/Statement.js').default}  statement
   * @return {import('./Statements/Statement.js').default}
   */
  prepared (statement) {
    this.event(new StatementPrepared(this, statement))

    return statement
  }

  /**
   * Determine if the connection is in a "dry run".
   *
   * @return {boolean}
   */
  pretending () {
    return this.pretendingConnection
  }

  /**
   * Get a new query builder instance.
   *
   * @return {import('./Query/Builder.js').default}
   */
  query () {
    return new QueryBuilder(this, this.getQueryGrammar(), this.getPostProcessor())
  }

  /**
   * Get a new raw query expression.
   *
   * @param  {unknown}  value
   * @return {import('./Query/Expression.js').default}
   */
  raw (value) {
    return new Expression(value)
  }

  /**
   * Reconnect to the database.
   *
   * @return {void}
   *
   * @throws \LogicException
   */
  reconnect () {
    if (isFunction(this.reconnector)) {
      return this.reconnector(this)
    }

    throw new Error('LogicException: Lost connection and no reconnector available.')
  }

  /**
   * Reconnect to the database if a PDO connection is missing.
   *
   * @return {void}
   */
  reconnectIfMissingConnection () {
    if (this.ndo !== undefined) {
      this.reconnect()
    }
  }

  /**
   * Indicate if any records have been modified.
   *
   * @param  {boolean}  [value=true]
   * @return {void}
   */
  recordsHaveBeenModified (value = true) {
    if (!this.recordsModified) {
      this.recordsModified = value
    }
  }

  /**
   * Run a SQL statement and log its execution context.
   *
   * @param  {string}  query
   * @param  {object}  bindings
   * @param  {Function} callback
   * @return {Promise<any>}
   *
   * @throws {Error<QueryException>}
   */
  async run (query, bindings, callback) {
    this.reconnectIfMissingConnection()

    const start = Date.now()

    let result

    // Here we will run this query. If an exception occurs we'll determine if it was
    // caused by a connection that has been lost. If that is the cause, we'll try
    // to re-establish connection and re-run the query with a fresh connection.
    try {
      result = await this.runQueryCallback(query, bindings, callback)
    } catch (/** @type {any} */error) {
      result = this.handleQueryException(error, query, bindings, callback)
    }

    // Once we have run the query we will calculate the time that it took to run and
    // then log the query, bindings, and execution time so we will report them on
    // the event that the developer needs them. We'll log time in milliseconds.
    this.logQuery(query, bindings, this.getElapsedTime(start))

    return result
  }

  /**
   * Run a SQL statement.
   *
   * @param  {string}  query
   * @param  {object}  bindings
   * @param  {Function}  callback
   * @return {unknown}
   *
   * @throws {Error<QueryException>}
   */
  async runQueryCallback (query, bindings, callback) {
    // To execute the statement, we'll simply call the callback, which will actually
    // run the SQL against the PDO connection. Then we can calculate the time it
    // took to execute and log the query SQL, bindings and time in our memory.
    try {
      const result = await callback(query, bindings)

      return result
    } catch (error) {
      // If an exception occurs when attempting to run a query, we'll format the error
      // message to include the bindings with SQL, which will make this exception a
      // lot more helpful to the developer instead of just the database's errors.
      throw new Error(
        `QueryException: ${query} - ${JSON.stringify(this.prepareBindings(bindings))}`
      )
    }
  }

  /**
   * Run a select statement against the database.
   *
   * @param  {string}  query
   * @param  {object}  [bindings]
   * @return {Promise<unknown[]>}
   */
  async select (query, bindings) {
    return await this.run(query, bindings, async (query, bindings) => {
      if (this.pretending()) {
        return []
      }

      // For select statements, we'll simply execute the query and return an array
      // of the database result set. Each element in the array will be a single
      // row from the database table, and will either be an array or objects.
      const statement = this.prepared(
        // this.connection, query
        this.getNdo().prepare(query)
      )

      this.bindValues(statement, this.prepareBindings(bindings))

      await statement.execute()

      return statement.fetchAll()
    })
  }

  /**
   * Run a select statement against the database.
   *
   * @param  {string}  query
   * @param  {Record<string, unknown>}  bindings
   * @returns {unknown}
   */
  selectFromWriteConnection (query, bindings = {}) {
    return this.select(query, bindings)
  }

  /**
   * Set the event dispatcher instance on the connection.
   *
   * @param  {\Illuminate\Contracts\Events\Dispatcher}  events
   * @return {this}
   */
  setEventDispatcher (events) {
    this.events = events

    return this
  }

  /**
   * Set the PDO connection.
   *
   * @param  {object|Function}  ndo
   * @return {this}
   */
  setNdo (ndo) {
    this.transactions = 0

    this.ndo = ndo

    return this
  }

  /**
   * Set the reconnect instance on the connection.
   *
   * @param  {callable}  reconnector
   * @return {this}
   */
  setReconnector (reconnector) {
    this.reconnector = reconnector

    return this
  }

  /**
   * Execute an SQL statement and return the boolean result.
   *
   * @param  {string}  query
   * @param  {object}  bindings
   * @return {Promise<boolean>}
   */
  async statement (query, bindings = {}) {
    return await this.run(query, bindings, async (query, bindings) => {
      if (this.pretending()) {
        return true
      }

      const statement = this.getNdo().prepare(query)

      this.bindValues(statement, this.prepareBindings(bindings))

      this.recordsHaveBeenModified()

      const result = await statement.execute()

      return result
    })
  }

  /**
   * Handle a query exception that occurred during query execution.
   *
   * @param  {Error}  error
   * @param  {string}  query
   * @param  {object}  bindings
   * @param  {Function}  callback
   * @return {unknown}
   *
   * @throws \Illuminate\Database\QueryException
   */
  tryAgainIfCausedByLostConnection (error, query, bindings, callback) {
    if (this.causedByLostConnection(error)) {
      this.reconnect()
      return this.runQueryCallback(query, bindings, callback)
    }
    throw error
  }

  /**
   * Run an update statement against the database.
   *
   * @param  {string}  query
   * @param  {unknown[]}  bindings
   * @return {number}
   */
  update (query, bindings = []) {
    return this.affectingStatement(query, bindings)
  }

  /**
   * Set the query post processor to the default implementation.
   *
   * @return {void}
   */
  useDefaultPostProcessor () {
    this.postProcessor = this.getDefaultPostProcessor()
  }

  /**
 * Set the query grammar to the default implementation.
 *
 * @return {void}
 */
  useDefaultQueryGrammar () {
    this.queryGrammar = this.getDefaultQueryGrammar()
  }

  /**
   * Set the table prefix and return the grammar.
   *
   * @param  {\Illuminate\Database\Grammar}  grammar
   * @return {\Illuminate\Database\Grammar}
   */
  withTablePrefix (grammar) {
    grammar.setTablePrefix(this.tablePrefix)
    return grammar
  }
}

import { castArray, dateFormat, isNil, isNumeric } from '@devnetic/utils'

import DetectsLostConnections from './DetectsLostConnections.js'
import Driver from './Drivers/Driver.js'
import Expression from './Query/Expression.js'
import Macroable from '../Macroable/Traits/Macroable.js'
import Processor from './Query/Processors/Processor.js'
import QueryExecuted from './Events/QueryExecuted.js'
import QueryGrammar from './Query/Grammars/Grammar.js'
import SchemaBuilder from './Schema/Builder.js'
import StatementPrepared from './Events/StatementPrepared.js'
import Str from '../Support/Str.js'
import { mix } from '../Support/Traits/use.js'
import { Builder as QueryBuilder } from './Query/internal.js'
import { CustomException, match } from '../Support/helpers.js'
import { reset } from '../Collections/helpers.js'
import TransactionBeginning from './Events/TransactionBeginning.js'
import TransactionCommitted from './Events/TransactionCommitted.js'
import TransactionCommitting from './Events/TransactionCommitting.js'
import TransactionRolledBack from './Events/TransactionRolledBack.js'
import Arr from '../Collections/Arr.js'

/** @typedef {import('./Schema/Grammars/Grammar.js').default} SchemaGrammar */
/** @typedef {import('../Contracts/Events/Dispatcher.js').default} Dispatcher */
/** @typedef {import('./Statements/Statement.js').default} Statement */
/** @typedef {import('./Query/Builder.js').Bindings} Bindings */

/**
 * @typedef {Object} QueryLogEntry
 * @property {string} query - The query string.
 * @property {Record<string, unknown>} bindings - Bindings for the query parameters.
 * @property {number} time - The time parameter.
 */

/**
 * @typedef {Object} RawQueryLogEntry
 * @property {string} raw_query - The SQL query with bindings substituted.
 * @property {number} time - The time taken to execute the query in milliseconds.
 */

/**
 * @typed{ef {Object} QueryLogEntry}
 * @property {string} query - The query string.
 * @property {Record<string, unknown>} bindings - Bindings for the query parameters.
 * @property {number} time - The time parameter.
 */
export default class Connection extends mix().use(DetectsLostConnections, Macroable) {
  /**
   * The active driver connection.
   *
   * @protected
   * @type {Driver|Function}
   */
  driver

  /**
   * The name of the connected database.
   *
   * @protected
   * @type {string}
   */
  database

  /**
   * The table prefix for the connection.
   *
   * @protected
   * @type {string}
   */
  tablePrefix = ''

  /**
   * The database connection configuration options.
   *
   * @protected
   * @type {Record<string, unknown>}
   */
  config = {}

  /**
   * The reconnector instance for the connection.
   *
   * @protected
   * @type {Function}
   */
  reconnector = () => { }

  /**
   * The query grammar implementation.
   *
   * @protected
   * @type {QueryGrammar}
   */
  queryGrammar

  /**
   * The schema grammar implementation.
   *
   * @protected
   * @type {SchemaGrammar}
   */
  schemaGrammar

  /**
   * The query post processor implementation.
   *
   * @protected
   * @type {Processor}
   */
  postProcessor

  /**
   * The event dispatcher instance.
   *
   * @protected
   * @type {Dispatcher}
   */
  events = null

  /**
   * The default fetch mode of the connection.
   *
   * @protected
   * @type {number}
   */
  fetchMode = Driver.FETCH_OBJ

  /**
   * The number of active transactions.
   *
   * @protected
   * @type {number}
   */
  transactions = 0

  /**
   * The transaction manager instance.
   *
   * @protected
   * @type {\Illuminate\Database\DatabaseTransactionsManager}
   */
  transactionsManager

  /**
   * Indicates if changes have been made to the database.
   *
   * @protected
   * @type {boolean}
   */
  recordsModified = false

  /**
   * Indicates if the connection should use the "write" PDO connection.
   *
   * @protected
   * @type {boolean}
   */
  readOnWriteConnection = false

  /**
   * All of the queries run against the connection.
   *
   * @protected
   * @type {QueryLogEntry[]}
   */
  queryLog = []

  /**
   * Indicates whether queries are being logged.
   *
   * @protected
   * @type {boolean}
   */
  loggingQueries = false

  /**
   * The duration of all executed queries in milliseconds.
   *
   * @protected
   * @type {number}
   */
  totalQueryDurationProperty = 0.0

  /**
   * All of the registered query duration handlers.
   *
   * @protected
   * @type {array}
   */
  queryDurationHandlers = []

  /**
   * Indicates if the connection is in a "dry run".
   *
   * @protected
   * @type {boolean}
   */
  pretendingProperty = false

  /**
   * All of the callbacks that should be invoked before a transaction is started.
   *
   * @protected
   * @type {Function[]}
   */
  beforeStartingTransactionProperty = []

  /**
   * All of the callbacks that should be invoked before a query is executed.
   *
   * @protected
   * @type {Function[]}
   */
  beforeExecutingCallbacks = []

  /**
   * The connection resolvers.
   *
   * @protected
   * @type {Function[]}
   */
  static resolvers = []

  /**
   * Create a new database connection instance.
   *
   * @param  {Driver|Function}  driver
   * @param  {string}  database
   * @param  {string}  tablePrefix
   * @param  {Record<string, unknown>}  config
   */
  constructor (driver, database = '', tablePrefix = '', config = {}) {
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
    this.queryGrammar = this.getDefaultQueryGrammar()

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
   * Get the default query grammar instance.
   *
   * @protected
   * @return {QueryGrammar}
   */
  getDefaultQueryGrammar () {
    const grammar = new QueryGrammar()
    grammar.setConnection(this)

    return grammar
  }

  /**
   * Set the schema grammar to the default implementation.
   *
   * @return {void}
   */
  useDefaultSchemaGrammar () {
    this.schemaGrammar = this.getDefaultSchemaGrammar()
  }

  /**
   * Get the default schema grammar instance.
   *
   * @protected
   * @return {SchemaGrammar|null}
   */
  getDefaultSchemaGrammar () {
    //
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
   * Get the default post processor instance.
   *
   * @protected
   * @return {Processor}
   */
  getDefaultPostProcessor () {
    return new Processor()
  }

  /**
   * Get a schema builder instance for the connection.
   *
   * @return {SchemaBuilder}
   */
  getSchemaBuilder () {
    if (isNil(this.schemaGrammar)) {
      this.useDefaultSchemaGrammar()
    }

    return new SchemaBuilder(this)
  }

  /**
   * Begin a fluent query against a database table.
   *
   * @param  {Function|QueryBuilder|Expression|string}  table
   * @param  {string|null}  as
   * @return {QueryBuilder}
   */
  table (table, as = null) {
    return this.query().from(table, as)
  }

  /**
   * Get a new query builder instance.
   *
   * @return {QueryBuilder}
   */
  query () {
    return new QueryBuilder(
      this, this.getQueryGrammar(), this.getPostProcessor()
    )
  }

  /**
   * Run a select statement and return a single result.
   *
   * @param  {string}  query
   * @param  {object}  bindings
   * @return {Promise<any>}
   */
  async selectOne (query, bindings = {}) {
    const records = await this.select(query, bindings)

    return records.shift()
  }

  /**
   * Run a select statement and return the first column of the first row.
   *
   * @param  {string}  query
   * @param  {object}  bindings
   * @return {Promise<any>}
   *
   * @throws {\Illuminate\Database\MultipleColumnsSelectedException}
   */
  async scalar (query, bindings = {}) {
    let record = await this.selectOne(query, bindings)

    if (isNil(record)) {
      return null
    }

    record = castArray(record)

    if (record.length > 1) {
      throw CustomException('multiple-columns-selected', 'MultipleColumnsSelectedException')
    }

    return reset(record)
  }

  /**
   * Run a select statement against the database.
   *
   * @param  {string}  query
   * @param  {object}  bindings
   * @return {Promise<Record<string, any>[]>}
   */
  async select (query, bindings = {}) {
    return await this.run(query, bindings, async (query, bindings) => {
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

      await statement.execute()

      return statement.fetchAll()
    })
  }

  /**
   * Run a select statement against the database and returns all of the result sets.
   *
   * @param  {string}  query
   * @param  {object}  bindings
   * @return {Promise<Record<string, any>[]>}
   */
  async selectResultSets (query, bindings = {}) {
    return await this.run(query, bindings, (query, bindings) => {
      if (this.pretending()) {
        return []
      }

      const statement = this.prepared(
        this.getDriver().prepare(query)
      )

      this.bindValues(statement, this.prepareBindings(bindings))

      statement.execute()

      const sets = []

      do {
        sets.push(statement.fetchAll())
      } while (statement.nextRowset())

      return sets
    })
  }

  /**
   * Run a select statement against the database and returns a generator.
   *
   * @param  {string}  query
   * @param  {object}  bindings
   * @return {Generator}
   */
  * cursor (query, bindings = {}, useReadPdo = true) {
    const statement = this.run(query, bindings, (query, bindings) => {
      if (this.pretending()) {
        return []
      }

      // First we will create a statement for the query. Then, we will set the fetch
      // mode and prepare the bindings for the query. Once that's done we will be
      // ready to execute the query against the database and return the cursor.
      const statement = this.prepared(this.getDriver()
        .prepare(query))

      this.bindValues(
        statement, this.prepareBindings(bindings)
      )

      // Next, we'll execute the query against the database and return the statement
      // so we can return the cursor. The cursor will use a PHP generator to give
      // back one row at a time without using a bunch of memory to render them.
      statement.execute()

      return statement
    })

    let record = statement.fetch()
    while (record) {
      yield record

      record = statement.fetch()
    }
  }

  /**
   * Configure the PDO prepared statement.
   *
   * @protected
   * @param  {Statement}  statement
   * @return {Statement}
   */
  prepared (statement) {
    statement.setFetchMode(this.fetchMode)

    this.event(new StatementPrepared(this, statement))

    return statement
  }

  /**
   * Run an insert statement against the database.
   *
   * @param  {string}  query
   * @param  {object}  bindings
   * @return {Promise<boolean>}
   */
  insert (query, bindings = {}) {
    return this.statement(query, bindings)
  }

  /**
   * Run an update statement against the database.
   *
   * @param  {string}  query
   * @param  {object}  bindings
   * @return {Promise<number>}
   */
  update (query, bindings = {}) {
    return this.affectingStatement(query, bindings)
  }

  /**
   * Run a delete statement against the database.
   *
   * @param  {string}  query
   * @param  {object}  bindings
   * @return {Promise<number>}
   */
  delete (query, bindings = {}) {
    return this.affectingStatement(query, bindings)
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

      const statement = this.getDriver().prepare(query)

      this.bindValues(statement, this.prepareBindings(bindings))

      this.recordsHaveBeenModified()

      const result = await statement.execute()

      return result
    })
  }

  /**
   * Run an SQL statement and get the number of rows affected.
   *
   * @param  {string}  query
   * @param  {object}  bindings
   * @return {Promise<number>}
   */
  async affectingStatement (query, bindings = {}) {
    return await this.run(query, bindings, async (query, bindings) => {
      if (this.pretending()) {
        return 0
      }

      // For update or delete statements, we want to get the number of rows affected
      // by the statement and return that back to the developer. We'll first need
      // to execute the statement and then we'll use PDO to fetch the affected.
      const statement = this.getDriver().prepare(query)

      this.bindValues(statement, this.prepareBindings(bindings))

      await statement.execute()

      const count = statement.rowCount()
      this.recordsHaveBeenModified(count > 0)

      return count
    })
  }

  /**
   * Run a raw, unprepared query against the PDO connection.
   *
   * @param  {string}  query
   * @return {Promise<boolean>}
   */
  async unprepared (query) {
    return await this.run(query, [], function (query) {
      if (this.pretending()) {
        return true
      }

      const change = this.getDriver().exec(query)
      this.recordsHaveBeenModified(change !== false)

      return change
    })
  }

  /**
   * Execute the given callback in "dry run" mode.
   *
   * @param  {Function}  callbackFunction
   * @return {array}
   */
  pretend (callbackFunction) {
    return this.withFreshQueryLog(() => {
      this.pretendingProperty = true

      // Basically to make the database connection "pretend", we will just return
      // the default values for all the query methods, then we will return an
      // array of queries that were "executed" within the Closure callback.
      callbackFunction(this)

      this.pretendingProperty = false

      return this.queryLog
    })
  }

  /**
   * Execute the given callback without "pretending".
   *
   * @param  {Function}  callback
   * @return {any}
   */
  withoutPretending (callback) {
    if (!this.pretending) {
      return callback()
    }

    this.pretendingProperty = false

    const result = callback()

    this.pretendingProperty = true

    return result
  }

  /**
   * Execute the given callback in "dry run" mode.
   *
   * @protected
   * @param  {Function}  callback
   * @return {array}
   */
  withFreshQueryLog (callback) {
    const loggingQueries = this.loggingQueries

    // First we will back up the value of the logging queries property and then
    // we'll be ready to run callbacks. This query log will also get cleared
    // so we will have a new log of all the queries that are executed now.
    this.enableQueryLog()

    this.queryLog = []

    // Now we'll execute this callback and capture the result. Once it has been
    // executed we will restore the value of query logging and give back the
    // value of the callback so the original callers can have the results.
    const result = callback()

    this.loggingQueries = loggingQueries

    return result
  }

  /**
   * Bind values to their parameters in the given statement.
   *
   * @param  {Statement}  statement
   * @param  {object}  bindings
   * @return {void}
   */
  bindValues (statement, bindings) {
    for (const [key, value] of Object.entries(bindings)) {
      statement.bindValue(isNumeric(key) ? Number(key) + 1 : key, value)
    }
  }

  /**
   * Prepare the query bindings for execution.
   *
   * @param  {object}  bindings
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
      } else if (typeof value === 'boolean') {
        bindings[key] = Number(value)
      }
    }

    return bindings
  }

  /**
   * Run a SQL statement and log its execution context.
   *
   * @protected
   * @param  {string}  query
   * @param  {object}  bindings
   * @param  {Function} callback
   * @return {Promise<any>}
   *
   * @throws {Error<QueryException>}
   */
  async run (query, bindings, callback) {
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
   * @protected
   * @param  {string}  query
   * @param  {object}  bindings
   * @param  {Function}  callback
   * @return {Promise<any>}
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
        // `QueryException: ${query} - ${JSON.stringify(this.prepareBindings(bindings))}`
        `(Connection: ${this.getName()}, SQL: ${Str.replaceArray('?', this.prepareBindings(bindings), query)})`
      )
    }
  }

  /**
   * Determine if the given database exception was caused by a unique constraint violation.
   *
   * @protected
   * @param  {Error}  exception
   * @return {boolean}
   */
  isUniqueConstraintError (exception) {
    return false
  }

  /**
   * Log a query in the connection's query log.
   *
   * @param  {string}  query
   * @param  {object}  bindings
   * @param  {number|null}  time
   * @return {void}
   */
  logQuery (query, bindings, time = null) {
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
   * Get the elapsed time since a given starting point.
   *
   * @protected
   * @param  {number}  start
   * @return {number}
   */
  getElapsedTime (start) {
    return Number(Math.round((Date.now() - start) * 1000).toPrecision(2))
  }

  /**
   * Register a callback to be invoked when the connection queries for longer than a given amount of time.
   *
   * @param  {Date|number}  threshold
   * @param  callable  handler
   * @return {void}
   */
  whenQueryingForLongerThan (threshold, handler) {
    threshold = threshold instanceof Date
      ? this.secondsUntil(threshold) * 1000
      : threshold

    this.queryDurationHandlers.push({
      hasRun: false,
      handler
    })

    const key = this.queryDurationHandlers.length - 1

    this.listen((event) => {
      if (!this.queryDurationHandlers[key].has_run && this.totalQueryDuration() > threshold) {
        handler(this, event)

        this.queryDurationHandlers[key].has_run = true
      }
    })
  }

  /**
   * Allow all the query duration handlers to run again, even if they have already run.
   *
   * @return {void}
   */
  allowQueryDurationHandlersToRunAgain () {
    for (const [key] of Object.entries(this.queryDurationHandlers)) {
      this.queryDurationHandlers[key].has_run = false
    }
  }

  /**
   * Get the duration of all run queries in milliseconds.
   *
   * @return {number}
   */
  totalQueryDuration () {
    return this.totalQueryDurationProperty
  }

  /**
   * Reset the duration of all run queries.
   *
   * @return {void}
   */
  resetTotalQueryDuration () {
    this.totalQueryDurationProperty = 0.0
  }

  /**
   * Handle a query exception.
   *
   * @param  {Error}  e
   * @param  {string}  query
   * @param  {Bindings}  bindings
   * @param  {Function}  callback
   * @return {any}
   *
   * @protected
   * @throws {Error}
   */
  handleQueryException (e, query, bindings, callback) {
    if (this.transactions >= 1) {
      throw e
    }

    return this.tryAgainIfCausedByLostConnection(
      e, query, bindings, callback
    )
  }

  /**
   * Handle a query exception that occurred during query execution.
   *
   * @param  {Error}  error
   * @param  {string}  query
   * @param  {Bindings}  bindings
   * @param  {Function}  callback
   * @return {unknown}
   *
   * @protected
   * @throws {Error}
   */
  tryAgainIfCausedByLostConnection (error, query, bindings, callback) {
    if (this.causedByLostConnection(error)) {
      this.reconnect()

      return this.runQueryCallback(query, bindings, callback)
    }

    throw error
  }

  /**
   * Reconnect to the database.
   *
   * @return {any|boolean}
   *
   * @throws {Error}
   */
  reconnect () {
    if (typeof this.reconnector === 'function') {
      return this.reconnector(this)
    }

    throw new Error('LostConnectionException: Lost connection and no reconnector available.')
  }

  /**
   * Reconnect to the database if a PDO connection is missing.
   *
   * @return {void}
   */
  reconnectIfMissingConnection () {
    if (isNil(this.pdo)) {
      this.reconnect()
    }
  }

  /**
   * Disconnect from the underlying PDO connection.
   *
   * @return {void}
   */
  disconnect () {
    this.setDriver(null)
  }

  /**
   * Register a hook to be run just before a database transaction is started.
   *
   * @param  {Function}  callback
   * @return {this}
   */
  beforeStartingTransaction (callback) {
    this.beforeStartingTransactionProperty.push(callback)

    return this
  }

  /**
   * Register a hook to be run just before a database query is executed.
   *
   * @param  {Function}  callback
   * @return {this}
   */
  beforeExecuting (callback) {
    this.beforeExecutingCallbacks.push(callback)

    return this
  }

  /**
   * Register a database query listener with the connection.
   *
   * @param  {Function}  callback
   * @return {void}
   */
  listen (callback) {
    this.events?.listen(QueryExecuted.constructor, callback)
  }

  /**
   * Fire an event for this connection.
   *
   * @protected
   * @param  {string}  event
   * @return {array|null}
   */
  fireConnectionEvent (event) {
    return this.events?.dispatch(match(event, {
      beganTransaction: new TransactionBeginning(this),
      committed: new TransactionCommitted(this),
      committing: new TransactionCommitting(this),
      rollingBack: new TransactionRolledBack(this),
      default: null
    }))
  }

  /**
   * Fire the given event if possible.
   *
   * @protected
   * @param  {any}  event
   * @return {void}
   */
  event (event) {
    if (this.events) {
      this.events.dispatch(event)
    }
  }

  /**
   * Get a new raw query expression.
   *
   * @param  {any}  value
   * @return {Expression}
   */
  raw (value) {
    return new Expression(value)
  }

  /**
   * Escape a value for safe SQL embedding.
   *
   * @param {string|number|boolean|null} value - The value to escape.
   * @param {boolean} [binary=false] - Whether the value is binary.
   * @returns {string} - The escaped value.
   */
  escape (value, binary = false) {
    if (value === null) {
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
      if (value.includes('\x00')) {
        throw new Error('RuntimeException: Strings with null bytes cannot be escaped. Use the binary escape option.')
      }

      // eslint-disable-next-line no-control-regex
      if (!/[\u0080-\uFFFF]/.test(value)) {
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
  escapeString (value) {
    return this.quote(value)
  }

  /**
   *
   * @param {string} value
   * @returns {string}
   */
  quote (value) {
    // Escape special characters within the input string
    const escapedString = value.replace(/'/g, "''")

    return `'${escapedString}'`
  }

  /**
   * Escape a boolean value for safe SQL embedding.
   *
   * @protected
   * @param  {boolean}  value
   * @return {string}
   */
  escapeBool (value) {
    return value ? '1' : '0'
  }

  /**
   * Escape a binary value for safe SQL embedding.
   *
   * @protected
   * @param  {string}  value
   * @return {string}
   */
  escapeBinary (value) {
    throw new Error('RuntimeException: The database connection does not support escaping binary values.')
  }

  /**
   * Determine if the database connection has modified any database records.
   *
   * @return {boolean}
   */
  hasModifiedRecords () {
    return this.recordsModified
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
   * Set the record modification state.
   *
   * @param  {boolean}  value
   * @return {this}
   */
  setRecordModificationState (value) {
    this.recordsModified = value

    return this
  }

  /**
   * Reset the record modification state.
   *
   * @return {void}
   */
  forgetRecordModificationState () {
    this.recordsModified = false
  }

  /**
   * Get the current Driver connection.
   *
   * @return {Driver}
   */
  getDriver () {
    if (typeof this.driver === 'function') {
      this.driver = this.driver()

      return this.driver
    }

    return this.driver
  }

  /**
   * Set the Driver connection.
   *
   * @param  {Driver|Function}  driver
   * @return {this}
   */
  setDriver (driver) {
    this.transactions = 0

    this.driver = driver

    return this
  }

  /**
   * Set the reconnect instance on the connection.
   *
   * @param  {Function}  reconnector
   * @return {this}
   */
  setReconnector (reconnector) {
    this.reconnector = reconnector

    return this
  }

  /**
   * Get the database connection name.
   *
   * @return {string|null}
   */
  getName () {
    return this.getConfig('name')
  }

  /**
   * Get an option from the configuration options.
   *
   * @param  {string|null}  option
   * @return {any}
   */
  getConfig (option = null) {
    return Arr.get(this.config, option)
  }

  /**
   * Get the PDO driver name.
   *
   * @return {string}
   */
  getDriverName () {
    return this.getConfig('driver')
  }

  /**
   * Get the query grammar used by the connection.
   *
   * @return {QueryGrammar}
   */
  getQueryGrammar () {
    return this.queryGrammar
  }

  /**
   * Set the query grammar used by the connection.
   *
   * @param  {QueryGrammar}  grammar
   * @return {this}
   */
  setQueryGrammar (grammar) {
    this.queryGrammar = grammar

    return this
  }

  /**
   * Get the schema grammar used by the connection.
   *
   * @return {SchemaGrammar}
   */
  getSchemaGrammar () {
    return this.schemaGrammar
  }

  /**
   * Set the schema grammar used by the connection.
   *
   * @param  {SchemaGrammar}  grammar
   * @return {this}
   */
  setSchemaGrammar (grammar) {
    this.schemaGrammar = grammar

    return this
  }

  /**
   * Get the query post processor used by the connection.
   *
   * @return {Processor}
   */
  getPostProcessor () {
    return this.postProcessor
  }

  /**
   * Set the query post processor used by the connection.
   *
   * @param  {Processor}  processor
   * @return {this}
   */
  setPostProcessor (processor) {
    this.postProcessor = processor

    return this
  }

  /**
   * Get the event dispatcher used by the connection.
   *
   * @return {Dispatcher}
   */
  getEventDispatcher () {
    return this.events
  }

  /**
   * Set the event dispatcher instance on the connection.
   *
   * @param  {Dispatcher}  events
   * @return {this}
   */
  setEventDispatcher (events) {
    this.events = events

    return this
  }

  /**
   * Unset the event dispatcher for this connection.
   *
   * @return {void}
   */
  unsetEventDispatcher () {
    this.events = null
  }

  /**
   * Set the transaction manager instance on the connection.
   *
   * @param  {import('./DatabaseTransactionsManager.js').default}  manager
   * @return {this}
   */
  setTransactionManager (manager) {
    this.transactionsManager = manager

    return this
  }

  /**
   * Unset the transaction manager for this connection.
   *
   * @return {void}
   */
  unsetTransactionManager () {
    this.transactionsManager = null
  }

  /**
   * Determine if the connection is in a "dry run".
   *
   * @return boolean
   */
  pretending () {
    return this.pretendingProperty === true
  }

  /**
   * Get the connection query log.
   *
   * @return {QueryLogEntry[]}
   */
  getQueryLog () {
    return this.queryLog
  }

  /**
   * Get the connection query log with embedded bindings.
   *
   * @return {RawQueryLogEntry[]}
   */
  getRawQueryLog () {
    return this.getQueryLog().map(log => ({
      raw_query: this.queryGrammar.substituteBindingsIntoRawSql(
        log.query,
        this.prepareBindings(log.bindings)
      ),
      time: log.time
    }))
  }

  /**
   * Clear the query log.
   *
   * @return {void}
   */
  flushQueryLog () {
    this.queryLog = []
  }

  /**
   * Enable the query log on the connection.
   *
   * @return {void}
   */
  enableQueryLog () {
    this.loggingQueries = true
  }

  /**
   * Disable the query log on the connection.
   *
   * @return {void}
   */
  disableQueryLog () {
    this.loggingQueries = false
  }

  /**
   * Determine whether we're logging queries.
   *
   * @return {boolean}
   */
  logging () {
    return this.loggingQueries
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
   * Set the name of the connected database.
   *
   * @param  {string}  database
   * @return {this}
   */
  setDatabaseName (database) {
    this.database = database

    return this
  }

  /**
   * Get the table prefix for the connection.
   *
   * @return {string}
   */
  getTablePrefix () {
    return this.tablePrefix
  }

  /**
   * Set the table prefix in use by the connection.
   *
   * @param  {string}  prefix
   * @return {this}
   */
  setTablePrefix (prefix) {
    this.tablePrefix = prefix

    this.getQueryGrammar().setTablePrefix(prefix)

    return this
  }

  /**
   * Set the table prefix and return the grammar.
   *
   * @param  {import('./Grammar.js').default}  grammar
   * @return {import('./Grammar.js').default}
   */
  withTablePrefix (grammar) {
    grammar.setTablePrefix(this.tablePrefix)

    return grammar
  }

  /**
   * Get the server version for the connection.
   *
   * @return {string}
   */
  getServerVersion () {
    return this.getDriver().getAttribute(Driver.ATTR_SERVER_VERSION)
  }

  /**
   * Register a connection resolver.
   *
   * @param  {string}  driver
   * @param  {Function}  callback
   * @return {void}
   */
  static resolverFor (driver, callback) {
    this.resolvers[driver] = callback
  }

  /**
   * Get the connection resolver for the given driver.
   *
   * @param  {string}  driver
   * @return {any}
   */
  static getResolver (driver) {
    return this.resolvers[driver] ?? null
  }
}

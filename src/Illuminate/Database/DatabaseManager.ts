import { getValue, isNil } from '@devnetic/utils'

import type { Repository } from '../Config/Repository'
import type { DatabaseConfig, LihtneConfig } from '../Config/types'
import type { Connection, Reconnector } from './Connection'
import type { ConnectionFactory } from './Connectors/ConnectionFactory'

import { ConfigurationUrlParser } from './../Support/ConfigurationUrlParser'

/**
 * @typedef {import('../Config/Repository.js').default} Repository
 */

/**
 * @typedef {import('../Database/Connection.js').default} Connection
 */

/**
 * @typedef {(connection: Connection) => void} Reconnector
 */

// export type { DatabaseConfig }

export type ConnectionResolver = (config: DatabaseConfig, name: string) => Connection

// const isDatabaseConfig = (value: unknown): value is string | DatabaseConfig => {
//   return typeof value === 'string' || (typeof value === 'object' && value !== null)
// }

/**
 * @mixin {Connection}
 */
export class DatabaseManager {
  /**
   * The application instance.
   *
   * @type {Repository}
   */
  protected repository: Repository

  /**
   * The active connection instances.
   *
   * @type {Record<string, Connection>}
   */
  protected connections: Record<string, Connection> = {}

  /**
   * The custom connection resolvers.
   *
   * @type {Record<string, Function>}
   */
  extensions: Record<string, ConnectionResolver> = {}

  /**
   * The database connection factory instance.
   *
   * @type {import('../Database/Connectors/ConnectionFactory.js').default}
   */
  factory

  /**
   * The callback to be executed to reconnect to a database.
   *
   * @type {Reconnector}
   */
  reconnector: Reconnector

  /**
   * The path to the configuration file.
   *
   * @var string
   */
  protected configFile: string = 'lihtne.config.ts'

  /**
   * Create a new database manager instance.
   *
   * @param  {import('../Database/Connectors/ConnectionFactory.js').default}  factory
   * @param  {Repository}  repository
   */
  constructor (
    factory: ConnectionFactory,
    repository: Repository,
    config: Partial<LihtneConfig> = {}
  ) {
    this.factory = factory
    this.repository = repository

    // const config = JSON.parse(fs.readFileSync(path, { encoding: 'utf8' }))
    // const path = join(process.cwd(), this.configFile)

    // const configContent = readFileSync(path, { encoding: 'utf8' })
    // const context = { configContent }
    // // const script = `
    // //   const config = ${JSON.stringify(configContent)}
    // //   module.exports = config
    // // `
    // const script = configContent
    // const { default: config } = runInNewContext(script, context, {
    //   filename: this.configFile,
    //   lineOffset: -1,
    //   displayErrors: true
    // })

    this.repository.set('database', config.database)

    this.reconnector = (connection) => {
      this.reconnect(connection.getName())
    }
  }

  /**
   * Dynamically pass methods to the default connection.
   *
   * @param  {string}  method
   * @param  {Array}  parameters
   * @return {*}
   */
  protected call (method: string, ...parameters: unknown[]): unknown {
    return this.connection()[method](...parameters)
  }

  /**
   * Get the configuration for a connection.
   *
   * @param  {string}  name
   * @return {Record<string, any>}
   *
   * @throws {TypeError}
   */
  public configuration (name: string): DatabaseConfig {
    name = name ?? this.getDefaultConnection()

    // To get the database connection configuration, we will just pull each of the
    // connection configurations and get the configurations for the given name.
    // If the configuration doesn't exist, we'll throw an exception and bail.
    const connections = this.repository.get<string, Record<string, DatabaseConfig>>('database.connections')
    const config = getValue(connections, name)

    // if (!isDatabaseConfig(config)) {
    //   throw new Error(`InvalidArgumentException: Database connection [${name}] not configured.`)
    // }

    return (new ConfigurationUrlParser()).parseConfiguration(config)
  }

  /**
   * Prepare the database connection instance.
   *
   * @param  {Connection}  connection
   * @return {Connection}
   */
  protected configure (connection: Connection): Connection {
    // connection = this.setNdoForType(connection, type).setReadWriteType(type)

    // First we'll set the fetch mode and a few other dependencies of the database
    // connection. This method basically just configures and prepares it to get
    // used by the application. Once we're finished we'll return it back out.
    // if (this.repository.bound('events')) {
    //   connection.setEventDispatcher(this.repository.events)
    // }

    // if (this.repository.bound('db.transactions')) {
    //   connection.setTransactionManager(this.repository['db.transactions'])
    // }

    // Here we'll set a reconnector callback. This reconnector can be any callable
    // so we will set a Closure to reconnect from this manager with the name of
    // the connection, which will allow us to reconnect from the connections.
    connection.setReconnector(this.reconnector)

    return connection
  }

  /**
   * Get a database connection instance.
   *
   * @param  {string}  [name]
   * @return {Connection}
   */
  public connection (name?: string): Connection {
    name = name ?? this.getDefaultConnection()

    const database = this.parseConnectionName(name)

    // If we haven't created this connection, we'll create it based on the config
    // provided in the application. Once we've created the connections we will
    // set the "fetch mode" for PDO which determines the query return types.
    if (this.connections[name] === undefined) {
      this.connections[name] = this.configure(this.makeConnection(database))

      // TODO: Implement events
      // this.dispatchConnectionEstablishedEvent(this.connections[name])
    }

    return this.connections[name]
  }

  /**
   * Disconnect from the given database.
   *
   * @param  {string|undefined}  name
   * @return {void}
   */
  public disconnect (name?: string): void {
    name = name ?? this.getDefaultConnection()

    if (this.connections[name]) {
      this.connections[name].disconnect()
    }
  }

  /**
   * Get the default connection name.
   *
   * @return {string}
   */
  public getDefaultConnection (): string {
    return this.repository.get('database.default')
  }

  /**
   * Make the database connection instance.
   *
   * @protected
   *
   * @param  {string}  name
   * @return {Connection}
   */
  protected makeConnection (name: string): Connection {
    const config = this.configuration(name)

    // First we will check by the connection name to see if an extension has been
    // registered specifically for that connection. If it has we will call the
    // Closure and pass it the config allowing it to resolve the connection.
    if (this.extensions[name] !== undefined) {
      return this.extensions[name](config, name)
    }

    // Next we will check to see if an extension has been registered for a driver
    // and will call the Closure if so, which allows us to have a more generic
    // resolver for the drivers themselves which applies to all connections.
    const driver = config.driver

    if (driver !== undefined && this.extensions[driver] !== undefined) {
      return this.extensions[driver](config, name)
    }

    return this.factory.make(config, name)
  }

  /**
   * Parse the connection into an array of the name and read / write type.
   *
   * @protected
   * @param  {string}  name
   * @return {string[]}
   */
  protected parseConnectionName (name?: string) {
    name = name ?? this.getDefaultConnection()

    // return Str.endsWith(name, ['::read', '::write'])
    //   ? name.split('::', 2)
    //   : [name, undefined]
    return name
  }

  /**
   * Reconnect to the given database.
   *
   * @param  {string|undefined}  name
   * @return {Connection}
   */
  public reconnect (name?: string = undefined) {
    name = name ?? this.getDefaultConnection()

    this.disconnect(name)

    if (isNil(this.connections[name])) {
      return this.connection(name)
    }

    return this.refreshDriversConnections(name)
  }

  /**
   * Refresh the PDO connections on a given connection.
   *
   * @param  {string}  name
   * @return {Connection}
   */
  protected refreshDriversConnections (name: string): Connection {
    const [database, type] = this.parseConnectionName(name)

    const fresh = this.configure(this.makeConnection(database), type)

    return this.connections[name]
      .setDriver(fresh.getDriver())
  }

  /**
   * Set the reconnect instance on the connection.
   *
   * @param  {Reconnector}  reconnector
   * @return {this}
   */
  public setReconnector (reconnector: Reconnector): this {
    this.reconnector = reconnector

    return this
  }
}

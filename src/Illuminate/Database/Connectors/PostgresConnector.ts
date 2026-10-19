import type { DatabaseConfig } from '../../Config/types'
import type { Driver, DriverOptions } from '../Drivers/Driver'

import { mixing } from '../../Support'
import { ParsesSearchPath } from '../Concerns/ParsesSearchPath'
import { PostgresDriver } from '../Drivers/PostgresDriver'
import { Connector } from './Connector'

// Trait methods are merged onto the class. `mixing().useTrait()` copies them onto the prototype at runtime.
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface PostgresConnector extends Connector, ParsesSearchPath { }

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class PostgresConnector extends mixing(Connector).useTrait([ParsesSearchPath]) {
  /**
   * Establish a database connection.
   *
   * @param  array  $config
   * @return \PDO
   */
  public override connect (config: DatabaseConfig): Driver {
    // First we'll create the basic DSN and connection instance connecting to the
    // using the configuration option specified by the developer. We will also
    // set the default character set on the connections to UTF-8 by default.
    const connection = this.createConnection(this.getDsn(config), config, this.getOptions(config))

    this.configureIsolationLevel(connection, config)

    // Next, we will check to see if a timezone has been specified in this config
    // and if it has we will issue a statement to modify the timezone with the
    // database. Setting this DB timezone is an optional configuration item.
    this.configureTimezone(connection, config)

    this.configureSearchPath(connection, config)

    this.configureSynchronousCommit(connection, config)

    return connection
  }

  /**
   * Set the connection transaction isolation level.
   *
   * @param  \PDO  $connection
   * @param  array  $config
   * @return void
   */
  protected configureIsolationLevel (connection: Driver, config: DatabaseConfig) {
    if (config.isolation_level !== undefined) {
      connection.prepare(`set session characteristics as transaction isolation level ${config.isolation_level}`).execute()
    }
  }

  /**
   * Set the timezone on the connection.
   *
   * @param  \PDO  $connection
   * @param  array  $config
   * @return void
   */
  protected configureTimezone (connection: Driver, config: DatabaseConfig) {
    if (config.timezone !== undefined) {
      connection.prepare(`set time zone '${config.timezone}'`).execute()
    }
  }

  /**
   * Set the "search_path" on the database connection.
   *
   * @param  \PDO  $connection
   * @param  array  $config
   * @return void
   */
  protected configureSearchPath (connection: Driver, config: DatabaseConfig) {
    if (config.search_path !== undefined || config.schema !== undefined) {
      const searchPath = this.quoteSearchPath(
        this.parseSearchPath(config.search_path ?? config.schema)
      )

      connection.prepare(`set search_path to ${searchPath}`).execute()
    }
  }

  /**
   * Format the search path for the DSN.
   *
   * @param  array  $searchPath
   * @return string
   */
  protected quoteSearchPath (searchPath: string[]): string {
    return searchPath.length === 1 ? `"${searchPath[0]}"` : `"${searchPath.join('", "')}"`
  }

  /**
   * Configure the synchronous_commit setting.
   *
   * @param  \PDO  $connection
   * @param  array  $config
   * @return void
   */
  protected configureSynchronousCommit (connection: Driver, config: DatabaseConfig) {
    if (config.synchronous_commit !== undefined) {
      connection.prepare(`set synchronous_commit to '${config.synchronous_commit}'`).execute()
    }
  }

  /**
   * Add the SSL options to the DSN.
   *
   * @protected
   * @param  {string}  dsn
   * @param  {Record<string, unknown>}  config
   * @return {string}
   */
  protected addSslOptions (dsn: string, config: DatabaseConfig): string {
    for (const option of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) {
      if (config[option] !== undefined) {
        dsn += `;${option}=${config[option]}`
      }
    }

    return dsn
  }

  /**
   * Create a DSN string from a configuration.
   *
   * @protected
   * @param  {Record<string, unknown>}  config
   * @return {string}
   */
  protected getDsn (config: DatabaseConfig): string {
    // First we will create the basic DSN setup as well as the port if it is in
    // in the configuration options. This will give us the basic DSN we will
    // need to establish the PDO connections and return them back for use.
    let {
      username,
      password,
      host,
      port,
      connect_via_port:
      connectViaPort,
      connect_via_database:
      connectViaDatabase,
      database
    } = config

    // Sometimes - users may need to connect to a database that has a different
    // name than the database used for "information_schema" queries. This is
    // typically the case if using "pgbouncer" type software when pooling.
    database = connectViaDatabase ?? database ?? ''
    port = connectViaPort ?? port ?? undefined

    let dsn = `pgsql://${username}:${password}@${host}`

    // If a port was specified, we will add it to this Postgres DSN connections
    // format. Once we have done that we are ready to return this connection
    // string back out for usage, as this has been fully constructed here.
    if (port !== undefined && port !== null) {
      dsn += `:${port}`
    }

    dsn += `/${database}`

    return this.addSslOptions(dsn, config)
  }

  /**
   * Create a new PDO connection instance.
   *
   * @param  {string}  dsn
   * @param  {Record<string, unknown>}  options
   * @return {object}
   */
  protected override createDriverConnection (
    dsn: string,
    options: DriverOptions
  ): Driver {
    return new PostgresDriver(dsn, options)
  }
}

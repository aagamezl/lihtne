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
  public override async connect (config: DatabaseConfig): Promise<Driver> {
    // First we'll create the basic DSN and connection instance connecting to the
    // using the configuration option specified by the developer. We will also
    // set the default character set on the connections to UTF-8 by default.
    const connection = this.createConnection(
      this.getDsn(config),
      config,
      this.getOptions(config)
    )

    await this.configureIsolationLevel(connection, config)
    await this.configureTimezone(connection, config)
    await this.configureSearchPath(connection, config)
    await this.configureSynchronousCommit(connection, config)

    return connection
  }

  /**
   * Add the keepalive options to the DSN.
   *
   * @param  string  $dsn
   * @param  array  $config
   * @return string
   */
  protected addKeepaliveOptions (dsn: string, config: DatabaseConfig): string {
    const options = ['keepalives', 'keepalives_idle', 'keepalives_interval', 'keepalives_count'] as const

    for (const option of options) {
      if (config[option] !== undefined) {
        dsn = this.appendParameter(dsn, option, config[option])
      }
    }

    return dsn
  }

  /**
   * Add the server options to the DSN.
   *
   * @param  string  $dsn
   * @param  array  $config
   * @return string
   */
  protected addServerOptions (dsn: string, config: DatabaseConfig): string {
    if (config.server_options === undefined) {
      return dsn
    }

    const parts = Object.entries(config.server_options).map(([name, value]) => {
      return `-c ${name}=${String(value).replace(/\\/g, '\\\\').replace(/ /g, '\\ ')}`
    })

    const options = parts.join(' ').replace(/\\/g, '\\\\').replace(/'/g, "\\'")

    return this.appendParameter(dsn, 'options', options)
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
    const options = config as DatabaseConfig & Record<string, string | undefined>

    for (const option of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) {
      if (options[option] !== undefined) {
        dsn = this.appendParameter(dsn, option, options[option])
      }
    }

    return dsn
  }

  protected appendParameter (dsn: string, name: string, value: string | number): string {
    const separator = dsn.includes('?') ? '&' : '?'

    return `${dsn}${separator}${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`
  }

  /**
   * Set the connection transaction isolation level.
   *
   * @param  \PDO  $connection
   * @param  array  $config
   * @return void
   */
  protected async configureIsolationLevel (connection: Driver, config: DatabaseConfig) {
    if (config.isolation_level !== undefined) {
      const statement = connection.prepare(`set session characteristics as transaction isolation level ${config.isolation_level}`)

      await statement.execute()
    }
  }

  /**
   * Set the "search_path" on the database connection.
   *
   * @param  \PDO  $connection
   * @param  array  $config
   * @return void
   */
  protected async configureSearchPath (connection: Driver, config: DatabaseConfig): Promise<void> {
    if (config.search_path !== undefined || config.schema !== undefined) {
      const searchPath = this.quoteSearchPath(
        this.parseSearchPath(config.search_path ?? config.schema)
      )

      await connection.prepare(`set search_path to ${searchPath}`).execute()
    }
  }

  /**
   * Configure the synchronous_commit setting.
   *
   * @param  \PDO  $connection
   * @param  array  $config
   * @return void
   */
  protected async configureSynchronousCommit (connection: Driver, config: DatabaseConfig): Promise<void> {
    if (config.synchronous_commit !== undefined) {
      const statement = connection.prepare(`set synchronous_commit to '${config.synchronous_commit}'`)

      await statement.execute()
    }
  }

  /**
   * Set the timezone on the connection.
   *
   * @param  \PDO  $connection
   * @param  array  $config
   * @return void
   */
  protected async configureTimezone (connection: Driver, config: DatabaseConfig): Promise<void> {
    if (config.timezone !== undefined) {
      await connection.prepare(`set time zone '${config.timezone}'`).execute()
    }
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
      database,
      charset,
      application_name
    } = config

    database = connectViaDatabase ?? database ?? ''
    port = connectViaPort ?? port ?? undefined

    let dsn = `pgsql://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host ?? ''}`

    if (port !== undefined) {
      dsn += `:${port}`
    }

    dsn += `/${encodeURIComponent(database)}`

    if (charset !== undefined) {
      dsn = this.appendParameter(dsn, 'client_encoding', charset)
    }

    if (application_name !== undefined) {
      dsn = this.appendParameter(dsn, 'application_name', application_name)
    }

    return this.addServerOptions(
      this.addKeepaliveOptions(this.addSslOptions(dsn, config), config),
      config
    )
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
}

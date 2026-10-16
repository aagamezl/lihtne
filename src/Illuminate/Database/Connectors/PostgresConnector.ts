import type { DatabaseConfig } from '../../Config/types'
import type { Driver, DriverOptions } from '../Drivers/Driver'

import { PostgresDriver } from '../Drivers/PostgresDriver'
import { Connector } from './Connector'

export class PostgresConnector extends Connector {
  /**
   * Establish a database connection.
   *
   * @param  array  $config
   * @return \PDO
   */
  public connect(config: DatabaseConfig): Driver {
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
   * Add the SSL options to the DSN.
   *
   * @protected
   * @param  {string}  dsn
   * @param  {Record<string, unknown>}  config
   * @return {string}
   */
  protected addSslOptions(dsn: string, config: DatabaseConfig): string {
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
  protected getDsn(config: DatabaseConfig): string {
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
  protected override createDriverConnection(dsn: string, options: DriverOptions): Driver {
    return new PostgresDriver(dsn, options)
  }
}

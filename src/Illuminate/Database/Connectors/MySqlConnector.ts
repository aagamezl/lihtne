import type { DatabaseConfig } from '../../Config/types'

import { mixing } from '../../Support'
import { versionCompare } from '../../Support/versionCompare'
import { ParsesSearchPath } from '../Concerns/ParsesSearchPath'
import { Driver, type DriverOptions } from '../Drivers/Driver'
import { MySqlDriver } from '../Drivers/MySqlDriver'
import { Connector } from './Connector'

// Trait methods are merged onto the class. `mixing().useTrait()` copies them onto the prototype at runtime.
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface MySqlConnector extends Connector, ParsesSearchPath { }

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class MySqlConnector extends mixing(Connector).useTrait([ParsesSearchPath]) {
  /**
   * Establish a database connection.
   *
   * @param  array  $config
   * @return \PDO
   */
  public override async connect (config: DatabaseConfig): Promise<Driver> {
    const connection = this.createConnection(
      this.getDsn(config),
      config,
      this.getOptions(config)
    )

    await this.configureConnection(connection, config)

    return connection
  }

  /**
   * Configure the given PDO connection.
   *
   * @param  \PDO  $connection
   * @param  array  $config
   * @return void
   */
  protected async configureConnection (connection: Driver, config: DatabaseConfig): Promise<void> {
    if (config.isolation_level !== undefined) {
      await connection.prepare(`SET SESSION TRANSACTION ISOLATION LEVEL ${config.isolation_level}`).execute()
    }

    const statements: string[] = []

    if (config.charset !== undefined) {
      if (config.collation !== undefined) {
        statements.push(`NAMES '${config.charset}' COLLATE '${config.collation}'`)
      } else {
        statements.push(`NAMES '${config.charset}'`)
      }
    }

    if (config.timezone !== undefined) {
      statements.push(`time_zone='${config.timezone}'`)
    }

    const sqlMode = await this.getSqlMode(connection, config)

    if (sqlMode !== undefined) {
      statements.push(`SESSION sql_mode='${sqlMode}'`)
    }

    if (statements.length > 0) {
      await connection.prepare(`SET ${statements.join(', ')}`).execute()
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
    return new MySqlDriver(dsn, options)
  }

  /**
   * Create a DSN string from a configuration.
   *
   * Chooses socket or host/port based on the 'unix_socket' config value.
   *
   * @param  array  $config
   * @return string
   */
  protected getDsn (config: DatabaseConfig): string {
    return this.hasSocket(config)
      ? this.getSocketDsn(config)
      : this.getHostDsn(config)
  }

  /**
   * Get the DSN string for a host / port configuration.
   *
   * @param  array  $config
   * @return string
   */
  protected getHostDsn (config: DatabaseConfig): string {
    const { username, password, host, port, database } = config

    return config.port !== undefined
      ? `mysql://${username}:${password}@${host}:${port}/${database}`
      : `mysql://${username}:${password}@${host}/${database}`
  }

  /**
   * Get the DSN string for a socket configuration.
   *
   * @param  array  $config
   * @return string
   */
  protected getSocketDsn (config: DatabaseConfig): string {
    const username = encodeURIComponent(config.username)
    const password = encodeURIComponent(config.password)
    const socketPath = encodeURIComponent(config.unix_socket ?? '')

    return `mysql://${username}:${password}@localhost/${config.database}?socketPath=${socketPath}`
  }

  /**
   * Get the sql_mode value.
   *
   * @param  \PDO  $connection
   * @param  array  $config
   * @return string|null
   */
  protected async getSqlMode (connection: Driver, config: DatabaseConfig): Promise<string | undefined> {
    if (config.modes !== undefined) {
      return config.modes.join(',')
    }

    if (config.strict === undefined) {
      return undefined
    }

    if (!config.strict) {
      return 'NO_ENGINE_SUBSTITUTION'
    }

    const version = config.version ??
      String(await connection.getAttribute(Driver.ATTR_SERVER_VERSION))

    if (versionCompare(version, '8.0.11', '>=')) {
      return 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'
    }

    return 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION'
  }

  /**
   * Determine if the given configuration array has a UNIX socket value.
   *
   * @param  array  $config
   * @return bool
   */
  protected hasSocket (config: DatabaseConfig): boolean {
    return config.unix_socket !== undefined && config.unix_socket !== ''
  }
}

import type { Driver, DriverOptions } from '../../..'
import type { DatabaseConfig } from '../../Config/types'

import { MariaDbDriver } from '../Drivers/MariaDbDriver'
import { MySqlConnector } from './MySqlConnector'

export class MariaDbConnector extends MySqlConnector {
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
    return new MariaDbDriver(dsn, options)
  }

  /**
   * Get the DSN string for a host / port configuration.
   *
   * @param  array  $config
   * @return string
   */
  protected override getHostDsn (config: DatabaseConfig): string {
    const { username, password, host, port, database } = config

    return config.port !== undefined
      ? `mariadb://${username}:${password}@${host}:${port}/${database}`
      : `mariadb://${username}:${password}@${host}/${database}`
  }

  /**
   * Get the sql_mode value.
   *
   * @param  \PDO  $connection
   * @param  array  $config
   * @return string|null
   */
  protected override async getSqlMode (
    // @ts-expect-error expected error; connection is required by the MySqlConnector signature
    connection: Driver,
    config: DatabaseConfig
  ): Promise<string | undefined> {
    if (config.modes !== undefined) {
      return config.modes.join(',')
    }

    if (config.strict === undefined) {
      return undefined
    }

    if (!config.strict) {
      return 'NO_ENGINE_SUBSTITUTION'
    }

    return 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'
  }
}

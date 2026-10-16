import { setValue } from '@devnetic/utils'

import type { DatabaseConfig } from '../../Config/types'
import type { Driver } from '../Drivers'
import type { Connector } from './Connector'

import { MariaDbConnection } from '../MariaDbConnection'
import { PostgresConnection } from '../PostgresConnection'
import { SQLiteConnection } from '../SQLiteConnection'
import { SqlServerConnection } from '../SqlServerConnection'
import { Arr } from './../../Collections/Arr'
import { Connection } from './../Connection'
import { MySqlConnection } from './../MySqlConnection'
import { MariaDbConnector } from './MariaDbConnector'
import { MySqlConnector } from './MySqlConnector'
import { PostgresConnector } from './PostgresConnector'
import { SQLiteConnector } from './SQLiteConnector'
import { SqlServerConnector } from './SqlServerConnector'

export class ConnectionFactory {
  /**
   * Create a new connection instance.
   *
   * @protected
   * @param  {string}  driver
   * @param  {Driver|Function}  connection
   * @param  {string}  database
   * @param  {string}  [prefix='']
   * @param  {object}  [config={}]
   * @return {Connection}
   *
   * @throws {Error}
   */
  protected createConnection (driver: string, connection: Driver, database: string, prefix = '', config = {}) {
    const resolver = Connection.getResolver(driver)

    if (resolver) {
      return resolver(connection, database, prefix, config)
    }

    switch (driver) {
      case 'mariadb':
        return new MariaDbConnection(connection, database, prefix, config)

      case 'mysql':
        return new MySqlConnection(connection, database, prefix, config)

      case 'pgsql':
        return new PostgresConnection(connection, database, prefix, config)

      case 'sqlite':
        return new SQLiteConnection(connection, database, prefix, config)

      case 'sqlsrv':
        return new SqlServerConnection(connection, database, prefix, config)
    }

    throw new Error(`InvalidArgumentException: Unsupported driver [${driver}].`)
  }

  /**
   * Create a connector instance based on the configuration.
   *
   * @param  {object}  config
   *
   * @return {import('../Connectors/Connector').default}
   *
   * @throws {TypeError}
   */
  public createConnector (config: DatabaseConfig): Connector {
    if (!config.driver) {
      throw new Error('InvalidArgumentException: A driver must be specified.')
    }

    switch (config.driver) {
      case 'mysql':
        return new MySqlConnector()

      case 'mariadb':
        return new MariaDbConnector()

      case 'pgsql':
        return new PostgresConnector()

      case 'sqlite':
        return new SQLiteConnector()

      case 'sqlsrv':
        return new SqlServerConnector()
    }

    throw new Error(`InvalidArgumentException: Unsupported driver [${config.driver}].`)
  }

  /**
   * Create a new Closure that resolves to a PDO instance.
   *
   * @param  {Record<string, any>}  config
   * @return {Function}
   */
  protected createDriverResolver (config: DatabaseConfig): () => Promise<unknown> {
    return Reflect.has(config, 'host')
      ? this.createResolverWithHosts(config)
      : this.createResolverWithoutHosts(config)
  }

  /**
   * Create a new Closure that resolves to a PDO instance with a specific host or an array of hosts.
   *
   * @param  {Record<string, any>}  config
   * @return {Function}
   *
   * @throws {DriverException}
   */
  protected createResolverWithHosts (config: DatabaseConfig): () => Promise<unknown> {
    return () => {
      const hosts = this.parseHosts(config)

      for (const host of Arr.shuffle(hosts)) {
        config.host = host

        try {
          return this.createConnector(config).connect(config)
        } catch (error) {
          continue
        }
      }

      throw new Error('DriverException: Unable to create resolver with hosts.')
    }
  }

  /**
   * Create a new Closure that resolves to a PDO instance where there is no configured host.
   *
   * @param  {Record<string, any>}  config
   * @return {Function}
   */
  protected createResolverWithoutHosts (config: DatabaseConfig): () => Promise<unknown> {
    return () => {
      return this.createConnector(config).connect(config)
    }
  }

  /**
   * Create a single database connection instance.
   *
   * @protected
   * @param  {Record<string, any>}  config
   * @return {import('../Connection').default}
   */
  protected createSingleConnection (config: DatabaseConfig): Connection {
    const resolver = this.createDriverResolver(config)

    return this.createConnection(config.driver, resolver, config.database, config.prefix, config)
  }

  /**
   * Establish a PDO connection based on the configuration.
   *
   * @param  {Record<string, any>}  config
   * @param  {string|undefined}  [name]
   * @return {import('../Connection').default}
   */
  public make (config: DatabaseConfig, name?: string) {
    config = this.parseConfig(config, name)

    return this.createSingleConnection(config)
  }

  /**
   * Parse and prepare the database configuration.
   *
   * @param  {Record<string, any>}  config
   * @param  {string}  [name]
   * @return {Record<string, any>}
   */
  protected parseConfig (config: DatabaseConfig, name?: string): DatabaseConfig {
    return setValue(setValue(config, 'prefix', ''), 'name', name)
  }

  /**
   * Parse the hosts configuration item into an array.
   *
   * @param  {Record<string, any>}  config
   * @return {any[]}
   *
   * @throws {Error}
   */
  protected parseHosts (config: DatabaseConfig): string[] {
    const hosts = Arr.wrap(config.host)

    if (hosts.length === 0) {
      throw new Error('InvalidArgumentException: Database hosts array is empty.')
    }

    return hosts
  }
}

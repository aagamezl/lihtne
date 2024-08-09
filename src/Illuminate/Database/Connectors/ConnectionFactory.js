import { setValue } from '@devnetic/utils'

import Arr from './../../Collections/Arr.js'
import Connection from './../Connection.js'
import MySqlConnection from './../MySqlConnection.js'
import PostgresConnection from './../PostgresConnection.js'
import SQLiteConnection from './../SQLiteConnection.js'
import SqlServerConnection from './../SqlServerConnection.js'
import {
  MySqlConnector,
  PostgresConnector,
  SQLiteConnector,
  SqlServerConnector
} from './index.js'

/** @typedef {import('../Drivers/Driver.js').default} Driver */

export default class ConnectionFactory {
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
  createConnection (driver, connection, database, prefix = '', config = {}) {
    const resolver = Connection.getResolver(driver)

    if (resolver) {
      return resolver(connection, database, prefix, config)
    }

    switch (driver) {
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
   * @return {import('../Connectors/Connector.js').default}
   *
   * @throws {TypeError}
   */
  createConnector (config) {
    if (!config.driver) {
      throw new Error('InvalidArgumentException: A driver must be specified.')
    }

    switch (config.driver) {
      case 'mysql':
        return new MySqlConnector()
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
  createDriverResolver (config) {
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
  createResolverWithHosts (config) {
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

      throw new Error('NDOException: Unable to create resolver with hosts.')
    }
  }

  /**
   * Create a new Closure that resolves to a PDO instance where there is no configured host.
   *
   * @param  {Record<string, any>}  config
   * @return {Function}
   */
  createResolverWithoutHosts (config) {
    return () => {
      return this.createConnector(config).connect(config)
    }
  }

  /**
   * Create a single database connection instance.
   *
   * @protected
   * @param  {Record<string, any>}  config
   * @return {import('../Connection.js').default}
   */
  createSingleConnection (config) {
    const resolver = this.createDriverResolver(config)

    return this.createConnection(
      config.driver, resolver, config.database, config.prefix, config
    )
  }

  /**
   * Establish a PDO connection based on the configuration.
   *
   * @param  {Record<string, any>}  config
   * @param  {string|undefined}  [name]
   * @return {import('../Connection.js').default}
   */
  make (config, name = undefined) {
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
  parseConfig (config, name = undefined) {
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
  parseHosts (config) {
    const hosts = Arr.wrap(config.host)

    if (hosts.length === 0) {
      throw new Error('InvalidArgumentException: Database hosts array is empty.')
    }

    return hosts
  }
}

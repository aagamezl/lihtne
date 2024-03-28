import { omit, setValue } from '@devnetic/utils'

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

export default class ConnectionFactory {
  /**
   * Create a new connection instance.
   *
   * @param  {string}  driver
   * @param  {object|Function}  connection
   * @param  {string}  database
   * @param  {string}  [prefix='']
   * @param  {object}  [config={}]
   * @return {\Illuminate\Database\Connection}
   *
   * @throws \InvalidArgumentException
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
   * @throws \InvalidArgumentException
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
   * Create a new PDO instance for reading.
   *
   * @param  {object}  config
   * @return {Function}
   */
  createReadNdo (config) {
    return this.createPdoResolver(this.getReadConfig(config))
  }

  /**
   * Create a read / write database connection instance.
   *
   * @param  {object}  config
   * @return {\Illuminate\Database\Connection}
   */
  createReadWriteConnection (config) {
    const connection = this.createSingleConnection(this.getWriteConfig(config))

    return connection.setReadNdo(this.createReadNdo(config))
  }

  /**
   * Create a new Closure that resolves to a PDO instance.
   *
   * @param  {object}  config
   * @return {Function}
   */
  createResolver (config) {
    return Reflect.has(config, 'host')
      ? this.createResolverWithHosts(config)
      : this.createResolverWithoutHosts(config)
  }

  /**
   * Create a new Closure that resolves to a PDO instance with a specific host or an array of hosts.
   *
   * @param  array  config
   * @return \Closure
   *
   * @throws \PDOException
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
   * @param  {object}  config
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
   * @param  {object}  config
   * @return {\Illuminate\Database\Connection}
   */
  createSingleConnection (config) {
    const resolver = this.createResolver(config)

    return this.createConnection(
      config.driver, resolver, config.database, config.prefix, config
    )
  }

  /**
   * Get the write configuration for a read / write connection.
   *
   * @param  {object}  config
   * @return {object}
   */
  getWriteConfig (config) {
    return this.mergeReadWriteConfig(
      config, this.getReadWriteConfig(config, 'write')
    )
  }

  /**
   * Establish a PDO connection based on the configuration.
   *
   * @param  {object}  config
   * @param  {string|undefined}  [name=undefined]
   * @return {\Illuminate\Database\Connection}
   */
  make (config, name = undefined) {
    config = this.parseConfig(config, name)

    if (config.read !== undefined) {
      return this.createReadWriteConnection(config)
    }

    return this.createSingleConnection(config)
  }

  /**
   * Merge a configuration for a read / write connection.
   *
   * @param  {object}  config
   * @param  {object}  merge
   * @return {object}
   */
  mergeReadWriteConfig (config, merge) {
    return omit({ ...config, ...merge }, ['read', 'write'])
  }

  /**
 * Parse and prepare the database configuration.
 *
 * @param  {object}  config
 * @param  {string}  name
 * @return {object}
 */
  parseConfig (config, name) {
    return setValue(setValue(config, 'prefix', ''), 'name', name)
  }

  /**
   * Parse the hosts configuration item into an array.
   *
   * @param  {object}  config
   * @return {array}
   *
   * @throws \InvalidArgumentException
   */
  parseHosts (config) {
    const hosts = Arr.wrap(config.host)

    if (hosts.length === 0) {
      throw new Error('InvalidArgumentException: Database hosts array is empty.')
    }

    return hosts
  }
}

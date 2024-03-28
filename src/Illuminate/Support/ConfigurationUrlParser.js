import { URL } from 'url'

import { isNil, isString } from '@devnetic/utils'

import { pull } from './helpers.js'

export default class ConfigurationUrlParser {
  /**
   * The drivers aliases map.
   *
   * @protected
   * @type {Record<string, string>}
   */
  driverAliases = {
    mssql: 'sqlsrv',
    mysql2: 'mysql', // RDS
    postgres: 'pgsql',
    postgresql: 'pgsql',
    sqlite3: 'sqlite',
    redis: 'tcp',
    rediss: 'tls'
  }

  /**
   * Parse the database configuration, hydrating options using a database configuration URL if possible.
   *
   * @param  {Record<string, unknown>|string}  config
   * @return {Record<string, unknown>}
   */
  parseConfiguration (config) {
    if (isString(config)) {
      config = { url: config }
    }

    const url = pull(config, 'url')

    if (!url) {
      return config
    }

    const rawComponents = this.parseUrl(url)

    const decodedComponents = this.parseStringsToNativeTypes(
      rawComponents.map(decodeURI)
    )

    return {
      ...config,
      ...this.getPrimaryOptions(decodedComponents),
      ...this.getQueryOptions(rawComponents)
    }
  }

  /**
   * Get the database name from the URL.
   *
   * @protected
   * @param  {object}  url
   * @return {string|undefined}
   */
  getDatabase (url) {
    const path = url.path ?? undefined

    return path && path !== '/' ? path.substr(1) : undefined
  }

  /**
   * Get the database driver from the URL.
   *
   * @protected
   * @param  {object}  url
   * @return {string|undefined}
   */
  getDriver (url) {
    const alias = url.scheme ?? undefined

    if (!alias) {
      return
    }

    return this.driverAliases[alias] ?? alias
  }

  /**
   * Get the primary database connection options.
   *
   * @protected
   * @param  {Record<string, unknown>}  url
   * @return {Record<string, unknown>}
   */
  getPrimaryOptions (url) {
    return Object.entries({
      driver: this.getDriver(url),
      database: this.getDatabase(url),
      host: url.host ?? undefined,
      port: url.port ?? undefined,
      username: url.user ?? undefined,
      password: url.pass ?? undefined
    }).filter(([key, value]) => {
      return !isNil(value)
    })
  }

  /**
   * Get all of the additional database options from the query string.
   *
   * @protected
   * @param  {Record<string, unknown>}  url
   * @return {Record<string, unknown>}
   */
  getQueryOptions (url) {
    const queryString = url.query ?? undefined

    if (!queryString) {
      return {}
    }

    const query = queryString.entries().reduce((query, [key, value]) => {
      query[key] = value

      return query
    }, {})

    return this.parseStringsToNativeTypes(query)
  }

  /**
   * Convert string casted values to their native types.
   *
   * @protected
   * @param  {string|Array<string|unknown>}  value
   * @return {unknown}
   */
  parseStringsToNativeTypes (value) {
    if (Array.isArray(value)) {
      return value.map(this.parseStringsToNativeTypes)
    }

    if (!isString(value)) {
      return value
    }

    try {
      return JSON.parse(value, true)
    } catch (error) {
      return value
    }
  }

  /**
   * Parse the string URL to an array of components.
   *
   * @protected
   * @param  {string}  url
   * @return {Record<string, unknown>}
   *
   * @throws {\InvalidArgumentException}
   */
  parseUrl (url) {
    url = url.replace(/#^(sqlite3?):\/\/\/#/gm, '1://null/')

    const parsedUrl = new URL(url)

    if (parsedUrl === false) {
      throw new Error('InvalidArgumentException: The database configuration URL is malformed.')
    }

    return parsedUrl
  }
}

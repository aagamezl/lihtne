import { isNil, isString } from '@devnetic/utils'
import { URL } from 'node:url'

import type { DatabaseConfig } from '../Config/types'

import { pull } from './helpers'

export class ConfigurationUrlParser {
  /**
   * The drivers aliases map.
   *
   * @var array<string, string>
   */
  protected static driverAliases: Record<string, string> = {
    mssql: 'sqlsrv',
    mysql2: 'mysql', // RDS
    postgres: 'pgsql',
    postgresql: 'pgsql',
    sqlite3: 'sqlite',
    redis: 'tcp',
    rediss: 'tls',
    valkey: 'tcp',
    valkeys: 'tls'
  }

  /**
   * Add the given driver alias to the driver aliases array.
   *
   * @param  string  $alias
   * @param  string  $driver
   * @return void
   */
  public static addDriverAlias (alias: string, driver: string): void {
    ConfigurationUrlParser.driverAliases[alias] = driver
  }

  /**
   * Get all of the current drivers' aliases.
   *
   * @return array<string, string>
   */
  public static getDriverAliases (): Record<string, string> {
    return ConfigurationUrlParser.driverAliases
  }

  /**
   * Get the database name from the URL.
   *
   * @protected
   * @param  {object}  url
   * @return {string|undefined}
   */
  getDatabase (url: URL): string | undefined {
    const path = url.pathname ?? undefined

    return path && path !== '/' ? path.slice(1) : undefined
  }

  /**
   * Get the database driver from the URL.
   *
   * @protected
   * @param  {object}  url
   * @return {string|undefined}
   */
  getDriver (url: URL): string | undefined {
    const alias = url.protocol.replace(/:$/, '')

    if (alias === '') {
      return
    }

    return ConfigurationUrlParser.driverAliases[alias] ?? alias
  }

  /**
   * Get the primary database connection options.
   *
   * @protected
   * @param  {Record<string, unknown>}  url
   * @return {Record<string, unknown>}
   */
  getPrimaryOptions (url: URL): Record<string, unknown> {
    const hasUserInfo = url.username !== '' || url.password !== ''

    return Object.fromEntries(
      Object.entries({
        driver: this.getDriver(url),
        database: this.getDatabase(url),
        host: url.hostname === '' || url.hostname === null
          ? undefined
          : this.parseStringsToNativeTypes(url.hostname),
        port: url.port === ''
          ? undefined
          : this.parseStringsToNativeTypes(url.port),
        username: url.username === ''
          ? undefined
          : this.parseStringsToNativeTypes(url.username),
        password: hasUserInfo
          ? this.parseStringsToNativeTypes(url.password)
          : undefined
      }).filter((entry) => {
        return !isNil(entry[1])
      })
    )
  }

  /**
   * Get all of the additional database options from the query string.
   *
   * @protected
   * @param  {Record<string, unknown>}  url
   * @return {Record<string, unknown>}
   */
  getQueryOptions (url: URL): Record<string, unknown> {
    const query: Record<string, unknown> = {}

    for (const [key, value] of url.searchParams) {
      query[key] = this.parseStringsToNativeTypes(value)
    }

    return query
  }

  /**
   * Parse the database configuration, hydrating options using a database configuration URL if possible.
   *
   * @param  {ParsableDatabaseConfig | string}  config
   * @return {ParsableDatabaseConfig}
   */
  parseConfiguration (config: string | DatabaseConfig): DatabaseConfig {
    if (typeof config === 'string') {
      config = { url: config }
    }

    const url = pull(config, 'url')

    if (!url) {
      return config
    }

    const rawComponents = this.parseUrl(url)

    const decodedComponents = this.parseStringsToNativeTypes(rawComponents)

    return {
      ...config,
      ...this.getPrimaryOptions(decodedComponents),
      ...this.getQueryOptions(rawComponents)
    }
  }

  /**
   * Convert string casted values to their native types.
   *
   * @protected
   * @param  {string|Array<string|unknown>}  value
   * @return {unknown}
   */
  parseStringsToNativeTypes<TValue extends URL | string | string[]> (
    value: TValue
  ): TValue extends URL ? URL : TValue extends string[] ? unknown[] : unknown
  parseStringsToNativeTypes (value: URL | string | string[]): unknown {
    if (value instanceof URL) {
      return value
    }

    if (Array.isArray(value)) {
      return value.map((item: string) => this.parseStringsToNativeTypes(item))
    }

    if (!isString(value)) {
      return value
    }

    try {
      return JSON.parse(value)
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
   * @throws {Error}
   */
  parseUrl (url: string): URL {
    url = url.replace(/#^(sqlite3?):\/\/\/#/gm, '1://null/')

    const parsedUrl = new URL(url)

    if (!parsedUrl) {
      throw new Error('InvalidArgumentException: The database configuration URL is malformed.')
    }

    return parsedUrl
  }
}

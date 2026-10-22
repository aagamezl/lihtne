import { Client } from 'pg'

import type { Statement } from '../Statements/Statement'

import { PostgresStatement } from '../Statements/PostgresStatement'
import { Driver, type DriverOptions } from './Driver'

export class PostgresDriver extends Driver {
  protected client?: Promise<Client>

  constructor (dsn: string, options: DriverOptions) {
    super(dsn, options)

    this.driverTitle = 'pgsql'
  }

  public connection (): Promise<Client> {
    this.client ??= this.open()

    return this.client
  }

  /**
   * Get a driver attribute.
   *
   * `ATTR_SERVER_VERSION` is PostgreSQL's `server_version` setting, the same
   * value PDO returns for `PDO::ATTR_SERVER_VERSION`.
   */
  public override async getAttribute (
    attribute: string | number
  ): Promise<string> {
    if (attribute !== Driver.ATTR_SERVER_VERSION) {
      return super.getAttribute(attribute)
    }

    this.serverVersion ??= await this.fetchServerVersion()

    return this.serverVersion
  }

  /**
 *
 * @overload
 * @override
 * @param {string} query
 * @returns {PostgresStatement}
 * @throws {Error}
 */
  public override prepare<
    TRow extends Record<string, unknown> = Record<string, unknown>
  >(query: string): Statement<TRow> {
    return new PostgresStatement<TRow>(this.dsn, this.options, query, this)
  }

  protected async fetchServerVersion (): Promise<string> {
    const client = await this.connection()
    const result = await client.query<{ server_version: string }>(
      "SELECT current_setting('server_version') AS server_version"
    )
    const version = result.rows[0]?.server_version

    if (typeof version !== 'string' || version === '') {
      throw new Error('RuntimeException: Unable to retrieve the server version.')
    }

    return version
  }

  protected async open (): Promise<Client> {
    const client = new Client({
      connectionString: this.dsn,
      connectionTimeoutMillis: 2000
    })

    await client.connect()

    return client
  }

  // public override async lastInsertId (
  //   sequence: string | undefined = undefined
  // ): Promise<string | number> {
  //   const statement = this.prepare<{ id: string | number }>(
  //     sequence === undefined
  //       ? 'select lastval() as id'
  //       : 'select currval(?::regclass) as id'
  //   )

  //   const rows = await statement.execute(
  //     sequence === undefined ? undefined : [sequence]
  //   )
  //   const id = rows[0]?.id

  //   if (typeof id !== 'string' && typeof id !== 'number') {
  //     throw new Error(
  //       'RuntimeException: Unable to retrieve the last insert ID.'
  //     )
  //   }

  //   return id
  // }
}

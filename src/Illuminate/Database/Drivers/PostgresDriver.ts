import { Client } from 'pg'

import type { Statement } from '../Statements/Statement'

import { PostgresStatement } from '../Statements/PostgresStatement'
import { Driver, type DriverOptions } from './Driver'

export class PostgresDriver extends Driver {
  protected override client: Client | undefined = undefined

  constructor (dsn: string, options: DriverOptions) {
    super(dsn, options)

    this.driverTitle = 'pgsql'
  }

  public override async connect (): Promise<Client> {
    if (!this.client) {
      this.client = new Client({
        connectionString: this.dsn,
        connectionTimeoutMillis: 2000
      })

      await this.client.connect()
    }

    return this.client
  }

  public override async disconnect (): Promise<void> {
    if (!this.isConnected()) {
      return
    }

    if (this.client !== undefined) {
      await this.client.end()
    }

    this.client = undefined
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
    const client = await this.connect()
    const result = await client.query<{ server_version: string }>(
      "SELECT current_setting('server_version') AS server_version"
    )
    const version = result.rows[0]?.server_version

    if (typeof version !== 'string' || version === '') {
      throw new Error('RuntimeException: Unable to retrieve the server version.')
    }

    return version
  }

  protected openClient (): Promise<Client> {
    const client = new Client({
      connectionString: this.dsn,
      connectionTimeoutMillis: 2000
    })

    return client.connect()
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

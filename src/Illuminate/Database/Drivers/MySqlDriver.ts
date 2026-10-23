import mysql, { type Connection, type RowDataPacket } from 'mysql2/promise'

import type { Statement } from '../Statements/Statement'

import { MySqlStatement } from '../Statements/MySqlStatement'
import { Driver, type DriverOptions } from './Driver'

export class MySqlDriver extends Driver {
  protected override client: Connection | undefined = undefined

  protected insertedId: string | number = 0

  constructor(dsn: string, options: DriverOptions) {
    super(dsn, options)

    this.driverTitle = 'mysql'
  }

  public override async connect(): Promise<Connection> {
    if (!this.client) {
      this.client = await mysql.createConnection({
        uri: this.dsn,
        connectTimeout: 2000
      })
    }

    return this.client
  }

  public override async disconnect(): Promise<void> {
    const client = this.client

    this.client = undefined

    if (client !== undefined) {
      await (await client).end()
    }
  }

  /**
   * Get a driver attribute.
   *
   * `ATTR_SERVER_VERSION` is the string returned by `VERSION()`, the same
   * value PDO returns for `PDO::ATTR_SERVER_VERSION`.
   */
  public override async getAttribute(
    attribute: string | number
  ): Promise<string> {
    if (attribute !== Driver.ATTR_SERVER_VERSION) {
      return await super.getAttribute(attribute)
    }

    this.serverVersion ??= await this.fetchServerVersion()

    return this.serverVersion
  }

  public override lastInsertId(): string | number {
    return this.insertedId
  }

  /**
   * Store the auto-increment id from the last insert result.
   */
  public setLastInsertId(id: string | number): void {
    this.insertedId = id
  }

  public override prepare<
    TRow extends Record<string, unknown> = Record<string, unknown>
  >(query: string): Statement<TRow> {
    return new MySqlStatement<TRow>(this.dsn, this.options, query, this)
  }

  protected async fetchServerVersion(): Promise<string> {
    const connection = await this.connect()
    const [rows] = await connection.query<Array<RowDataPacket & { version: string }>>(
      'SELECT VERSION() AS version'
    )
    const version = rows[0]?.version

    if (typeof version !== 'string' || version === '') {
      throw new Error('RuntimeException: Unable to retrieve the server version.')
    }

    return version
  }
}

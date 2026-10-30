import mariadb, { type Connection } from 'mariadb'

import type { Statement } from '../Statements/Statement'

import { MariaDbStatement } from '../Statements/MariaDbStatement'
import { Driver, type DriverOptions } from './Driver'

export class MariaDbDriver extends Driver {
  protected override client: Connection | undefined = undefined

  protected insertedId: number = 0

  constructor (dsn: string, options: DriverOptions) {
    super(dsn, options)

    this.driverTitle = 'mariadb'
  }

  public override async connect (): Promise<Connection> {
    if (!this.client) {
      this.client = await mariadb.createConnection(this.dsn)
    }

    return this.client
  }

  public override async disconnect (): Promise<void> {
    const client = this.client

    this.client = undefined

    if (client !== undefined) {
      await (await client).end()
    }
  }

  public override prepare (query: string): Statement {
    return new MariaDbStatement(this.dsn, this.options, query, this)
  }

  /**
   * Store the auto-increment id from the last insert result.
   */
  public setLastInsertId (id: number): void {
    this.insertedId = id
  }
}

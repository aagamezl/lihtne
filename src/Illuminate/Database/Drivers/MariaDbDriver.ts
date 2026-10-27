import mariadb, { type Connection } from 'mariadb';

import { Driver, type DriverOptions } from './Driver'
import { MariaDbStatement } from '../Statements/MariaDbStatement'
import type { Statement } from '../Statements/Statement';

export class MariaDbDriver extends Driver {
  protected override client: Connection | undefined = undefined

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

  // public override prepare<
  //   TRow extends Record<string, unknown> = Record<string, unknown>
  // >(query: string): Statement<TRow> {
  //   return new MariaDbStatement<TRow>(this.dsn, this.options, query, this)
  // }
  public override prepare(query: string): Statement {
    return new MariaDbStatement(this.dsn, this.options, query, this)
  }

  public override async disconnect (): Promise<void> {
    const client = this.client

    this.client = undefined

    if (client !== undefined) {
      await (await client).end()
    }
  }
}

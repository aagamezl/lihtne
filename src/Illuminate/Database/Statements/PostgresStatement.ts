import type { Client } from 'pg'

import crypto from 'node:crypto'
import pg from 'pg'

import type { DriverOptions } from '../Drivers/Driver'
import type { BindingValues } from '../Query/Builder'

import { Statement } from './Statement'

export class PostgresStatement<
  TRow extends Record<string, unknown> = Record<string, unknown>
> extends Statement<TRow> {
  protected override client!: Client

  constructor (dsn: string, options: DriverOptions, query: string) {
    super(dsn, options, query)

    this.client = new pg.Client({
      connectionString: this.dsn,
      connectionTimeoutMillis: 2000
    })
  }

  public override prepare (query: string): this {
    this.statement = {
      name: `prepared-statement-${crypto.randomUUID()}`,
      text: this.parameterize(query)
    }

    this.bindings = {}

    return this
  }

  public override parameterize (query: string): string {
    const regex = /\?/gm

    if (query.match(regex) === null) {
      return query
    }

    let index = 0
    return query.replace(regex, () => `$${++index}`)
  }

  public override fetchAll (): TRow[] {
    return this.result.rows
  }

  /**
   *
   * @param {unknown[]} values
   * @returns {Promise<any[]>}
   */
  public override async execute (values?: BindingValues): Promise<TRow[]> {
    values = values ?? Object.values(this.bindings)

    if (Object.values(values).length > 0) {
      this.statement.values = values
    }

    try {
      await this.client.connect()

      const result = await this.client.query<TRow>(this.statement)

      this.result = {
        rows: result.rows,
        rowCount: result.rowCount ?? 0
      }

      return this.result.rows
    } finally {
      await this.close()
    }
  }

  public async close (): Promise<void> {
    await this.client.end()
  }

  public override rowCount (): number {
    return this.result.rowCount ?? 0
  }
}

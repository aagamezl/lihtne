import type { Client } from 'pg'

import crypto from 'node:crypto'

import type { DriverOptions } from '../Drivers/Driver'
import type { PostgresDriver } from '../Drivers/PostgresDriver'
import type { BindingValues } from '../Query/Builder'

import { Statement } from './Statement'

export class PostgresStatement<
  TRow extends Record<string, unknown> = Record<string, unknown>
> extends Statement<TRow> {
  protected override client!: Client

  constructor (
    dsn: string,
    options: DriverOptions,
    query: string,
    protected readonly driver: PostgresDriver
  ) {
    super(dsn, options, query)
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

    this.client = await this.driver.connect()

    const result = await this.client.query<TRow>(this.statement)

    this.result = {
      rows: result.rows,
      rowCount: result.rowCount ?? 0
    }

    return this.result.rows
  }

  public override fetchAll (): TRow[] {
    return this.result.rows
  }

  public override parameterize (query: string): string {
    const regex = /\?/gm

    if (query.match(regex) === null) {
      return query
    }

    let index = 0
    return query.replace(regex, () => `$${++index}`)
  }

  public override prepare (query: string): this {
    this.statement = {
      name: `prepared-statement-${crypto.randomUUID()}`,
      text: this.parameterize(query)
    }

    this.bindings = {}

    return this
  }

  public override rowCount (): number {
    return this.result.rowCount ?? 0
  }
}

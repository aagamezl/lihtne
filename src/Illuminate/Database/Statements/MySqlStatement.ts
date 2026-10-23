import type { Connection, ResultSetHeader } from 'mysql2/promise'

import type { DriverOptions } from '../Drivers/Driver'
import type { MySqlDriver } from '../Drivers/MySqlDriver'
import type { BindingValues } from '../Query/Builder'

import { Statement } from './Statement'

export class MySqlStatement<
  TRow extends Record<string, unknown> = Record<string, unknown>
> extends Statement<TRow> {
  protected override client!: Connection

  constructor (
    dsn: string,
    options: DriverOptions,
    query: string,
    protected readonly driver: MySqlDriver
  ) {
    super(dsn, options, query)
  }

  public override async execute (values?: BindingValues): Promise<TRow[]> {
    const bound = values ?? Object.values(this.bindings)

    this.client = await this.driver.connect()

    const [result] = await this.client.query(this.statement.text, bound)

    if (Array.isArray(result)) {
      const rows = result as TRow[]

      this.result = {
        rows,
        rowCount: rows.length
      }

      return rows
    }

    const header = result as ResultSetHeader

    this.result = {
      rows: [],
      rowCount: header.affectedRows
    }

    if (header.insertId > 0) {
      this.driver.setLastInsertId(header.insertId)
    }

    return []
  }

  public override fetchAll (): TRow[] {
    return this.result.rows
  }

  public override parameterize (query: string): string {
    return query
  }

  public override prepare (query: string): this {
    this.statement = {
      name: '',
      text: this.parameterize(query)
    }

    this.bindings = {}

    return this
  }

  public override rowCount (): number {
    return this.result.rowCount ?? 0
  }
}

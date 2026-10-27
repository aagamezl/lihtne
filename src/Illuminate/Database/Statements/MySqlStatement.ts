import type { Connection, PreparedStatementInfo, QueryResult } from 'mysql2/promise'

import type { DriverOptions } from '../Drivers/Driver'
import type { MySqlDriver } from '../Drivers/MySqlDriver'
import type { BindingValues } from '../Query/Builder'

import { Statement } from './Statement'

// export class MySqlStatement<
//   TRow extends Record<string, unknown> = Record<string, unknown>
// > extends Statement<TRow> {
export class MySqlStatement extends Statement{
  protected override client!: Connection

  protected override statement!: PreparedStatementInfo

  protected readonly driver: MySqlDriver

  constructor (
    dsn: string,
    options: DriverOptions,
    query: string,
    driver: MySqlDriver
  ) {
    super(dsn, options, query)

    this.driver = driver
  }

  // public override async execute (values?: BindingValues): Promise<TRow[]> {
  public override async execute (values?: BindingValues): Promise<unknown[]> {
    const bindings = values ?? Object.values(this.bindings)

    this.client = await this.driver.connect()

    const [result] = await this.statement.execute(bindings)

    if (Array.isArray(result)) {
      // const rows = result as TRow[]

      // this.result = {
      //   rows,
      //   rowCount: rows.length ?? 0
      // }

      // return rows
      this.result = {
        rows: result,
        rowCount: result.length ?? 0
      }

      return this.result.rows
    }

    // const header = result as ResultSetHeader

    this.result = {
      rows: [],
      rowCount: result.affectedRows
    }

    if (result.insertId > 0) {
      this.driver.setLastInsertId(result.insertId)
    }

    return []
  }

  // public override fetchAll (): TRow[] {
  public override fetchAll () {
    return this.result.rows
  }

  public override parameterize (query: string): string {
    return query
  }

  public override async prepare (query: string): Promise<this> {
    // this.statement = {
    //   name: '',
    //   text: this.parameterize(query)
    // }

    this.statement = await this.client.prepare(this.parameterize(query))

    this.bindings = {}

    return this
  }

  public override rowCount (): number {
    return this.result.rowCount ?? 0
  }
}

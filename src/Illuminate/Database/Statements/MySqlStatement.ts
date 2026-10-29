import type { Connection, PreparedStatementInfo } from 'mysql2/promise'

import type { DriverOptions } from '../Drivers/Driver'
import type { MySqlDriver } from '../Drivers/MySqlDriver'
import type { BindingValues } from '../Query/Builder'

import { Statement } from './Statement'

export class MySqlStatement extends Statement {
  protected override client!: Connection

  protected override readonly driver: MySqlDriver

  protected override statement!: PreparedStatementInfo

  constructor (
    dsn: string,
    options: DriverOptions,
    query: string,
    driver: MySqlDriver
  ) {
    super(dsn, options, query)

    this.driver = driver
  }

  public override async execute (values?: BindingValues): Promise<unknown[]> {
    const bindings = values ?? Object.values(this.bindings)

    if (this.client === undefined) {
      this.client = await this.driver.connect()
    }

    if (this.statement === undefined) {
      await this.prepare(this.query)
    }

    const [result] = await this.statement.execute(bindings)

    if (Array.isArray(result)) {
      this.result = {
        rows: result,
        rowCount: result.length ?? 0
      }

      return this.result.rows
    }

    this.result = {
      rows: [],
      rowCount: result.affectedRows
    }

    if (result.insertId > 0) {
      this.driver.setLastInsertId(result.insertId)
    }

    return []
  }

  public override fetchAll () {
    return this.result.rows
  }

  public override parameterize (query: string): string {
    return query
  }

  public override async prepare (query: string): Promise<this> {
    this.statement = await this.client.prepare(this.parameterize(query))

    this.bindings = {}

    return this
  }

  public override rowCount (): number {
    return this.result.rowCount ?? 0
  }
}

import type { Connection, Prepare } from "mariadb";

import type { DriverOptions } from "../Drivers/Driver";
import { Statement } from "./Statement";
import type { MariaDbDriver } from "../Drivers/MariaDbDriver";
import type { BindingValues } from "../Query";

// export class MariaDbStatement<
//   TRow extends Record<string, unknown> = Record<string, unknown>
// >  extends Statement<TRow> {
export class MariaDbStatement extends Statement {
  protected override client!: Connection

  protected override statement!: Prepare

  protected readonly driver: MariaDbDriver

  constructor (
    dsn: string,
    options: DriverOptions,
    query: string,
    driver: MariaDbDriver
  ) {
    super(dsn, options, query)

    this.driver = driver
  }

  public override async prepare (query: string): Promise<this> {
    if (this.client === undefined) {
      this.client = await this.driver.connect()
    }

    this.statement = await this.client.prepare(this.parameterize(query))

    this.bindings = {}

    return this
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

  public override fetchAll() {
    return this.result.rows
  }

  public override parameterize (query: string): string {
    return query
  }

  public override rowCount (): number {
    return this.result.rowCount ?? 0
  }
}
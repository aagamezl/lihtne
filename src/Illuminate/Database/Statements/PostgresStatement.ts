import type { Client } from 'pg'

import crypto from 'node:crypto'

import type { DriverOptions } from '../Drivers/Driver'
import type { PostgresDriver } from '../Drivers/PostgresDriver'
import type { BindingValues } from '../Query/Builder'

import { Statement } from './Statement'

export type PreparedStatement = {
  name: string
  text: string
  values?: BindingValues
}

export class PostgresStatement extends Statement {
  protected override client!: Client

  protected readonly driver: PostgresDriver

  protected override statement!: PreparedStatement

  constructor (
    dsn: string,
    options: DriverOptions,
    query: string,
    driver: PostgresDriver
  ) {
    super(dsn, options, query)

    this.driver = driver
  }

  /**
   *
   * @param {unknown[]} values
   * @returns {Promise<any[]>}
   */
  public override async execute (values?: BindingValues): Promise<unknown[]> {
    values = values ?? Object.values(this.bindings)

    if (this.client === undefined) {
      this.client = await this.driver.connect()
    }

    if (this.statement === undefined) {
      await this.prepare(this.query)
    }

    if (Object.values(values).length > 0) {
      this.statement.values = values
    }

    this.client = await this.driver.connect()

    const result = await this.client.query(this.statement)

    this.result = {
      rows: result.rows,
      rowCount: result.rowCount ?? 0
    }

    return this.result.rows
  }

  public override fetchAll () {
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

  public override async prepare (query: string): Promise<this> {
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

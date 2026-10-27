import type { Connection } from "mariadb";

import type { DriverOptions } from "../Drivers/Driver";
import { Statement } from "./Statement";
import type { MariaDbDriver } from "../Drivers/MariaDbDriver";

// export class MariaDbStatement<
//   TRow extends Record<string, unknown> = Record<string, unknown>
// >  extends Statement<TRow> {
export class MariaDbStatement extends Statement {
  protected override client!: Connection

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

  public override fetchAll() {
    return this.result.rows
  }
}
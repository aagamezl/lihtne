import type { Statement } from '../Statements/Statement'

import { PostgresStatement } from '../Statements/PostgresStatement'
import { Driver, type DriverOptions } from './Driver'

export class PostgresDriver extends Driver {
  constructor (dsn: string, options: DriverOptions) {
    super(dsn, options)

    this.driverTitle = 'pgsql'
  }

  /**
 *
 * @overload
 * @override
 * @param {string} query
 * @returns {PostgresStatement}
 * @throws {Error}
 */
  public override prepare<
    TRow extends Record<string, unknown> = Record<string, unknown>
  >(query: string): Statement<TRow> {
    return new PostgresStatement<TRow>(this.dsn, this.options, query)
  }

  // public override async lastInsertId (
  //   sequence: string | undefined = undefined
  // ): Promise<string | number> {
  //   const statement = this.prepare<{ id: string | number }>(
  //     sequence === undefined
  //       ? 'select lastval() as id'
  //       : 'select currval(?::regclass) as id'
  //   )

  //   const rows = await statement.execute(
  //     sequence === undefined ? undefined : [sequence]
  //   )
  //   const id = rows[0]?.id

  //   if (typeof id !== 'string' && typeof id !== 'number') {
  //     throw new Error(
  //       'RuntimeException: Unable to retrieve the last insert ID.'
  //     )
  //   }

  //   return id
  // }
}

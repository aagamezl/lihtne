import type { Connection } from '../Connection'
import type { Statement } from '../Statements'

export class StatementPrepared<TRow extends Record<string, unknown> = Record<string, unknown>> {
  /**
   * Create a new event instance.
   *
   * @param  {Connection}  connection
   * @param  {Statement}  statement
   */
  constructor (
    protected connection: Connection,
    protected statement: Statement<TRow>
  ) {}
}

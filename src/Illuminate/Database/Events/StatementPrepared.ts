import { Connection } from '../Connection'
import { Statement } from '../Statements'

export class StatementPrepared {
  /**
   * Create a new event instance.
   *
   * @param  {Connection}  connection
   * @param  {Statement}  statement
   */
  constructor(
    protected connection: Connection,
    protected statement: Statement
  ) {}
}

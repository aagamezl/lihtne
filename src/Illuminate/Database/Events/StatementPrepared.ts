import { Connection } from "../Connection";
import { Statement } from "../Statements";

export class StatementPrepared {
  /**
   * Create a new event instance.
   *
   * @param  {import('./../Connection').default}  connection
   * @param  {import('./../Statements/Statement.js').default}  statement
   */
  constructor (protected connection: Connection, protected statement: Statement) {
  }
}
import type { Connection } from "../Connection";
import type { Grammar } from "../Grammar";

export class Builder {
  /**
   * The database connection instance.
   *
   * @var \Illuminate\Database\Connection
   */
  protected connection: Connection;

  /**
   * The schema grammar instance.
   *
   * @var \Illuminate\Database\Schema\Grammars\Grammar
   */
  protected grammar: Grammar | undefined;

  constructor(connection: Connection) {
    this.connection = connection;
    this.grammar = connection.getSchemaGrammar();
  }
}
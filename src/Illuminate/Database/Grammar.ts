import type { Connection } from "./Connection"

export abstract class Grammar {
  // The connection used for escaping values.
  protected connection

  /**
   * Create a new grammar instance.
   */
  public constructor(connection: Connection) {
    this.connection = connection
  }
}

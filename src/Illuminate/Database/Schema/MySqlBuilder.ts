import { Builder } from './Builder'

export class MySqlBuilder extends Builder {
  /**
   * Get the names of current schemas for the connection.
   *
   * @return string[]
   */
  public override getCurrentSchemaListing (): string[] {
    return [this.connection.getDatabaseName()]
  }
}

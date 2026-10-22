import { mixing } from '../../Support'
import { ParsesSearchPath } from '../Concerns/ParsesSearchPath'
import { Builder } from './Builder'

// Trait methods are merged onto the class. `mixing().useTrait()` copies them onto the prototype at runtime.
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface PostgresBuilder extends Builder, ParsesSearchPath { }

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class PostgresBuilder extends mixing(Builder).useTrait([ParsesSearchPath]) {
  /**
   * Get the current schemas for the connection.
   *
   * @return string[]
   */
  public override getCurrentSchemaListing (): string[] {
    const searchPath = this.connection.getConfig<string | string[]>('search_path') ??
      this.connection.getConfig<string | string[]>('schema') ??
      'public'

    return this.parseSearchPath(searchPath).map((schema) => {
      return schema === '$user'
        ? String(this.connection.getConfig('username') ?? '')
        : schema
    })
  }
}

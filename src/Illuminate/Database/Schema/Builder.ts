import type { Connection } from '../Connection'
import type { Grammar } from '../Grammar'

import { Expression } from '../Query/Expression'

export class Builder {
  /**
   * The database connection instance.
   *
   * @var \Illuminate\Database\Connection
   */
  protected connection: Connection

  /**
   * The schema grammar instance.
   *
   * @var \Illuminate\Database\Schema\Grammars\Grammar
   */
  protected grammar: Grammar

  constructor (connection: Connection) {
    this.connection = connection
    this.grammar = connection.getSchemaGrammar()
  }

  /**
   * Parse the given database object reference and extract the schema and table.
   *
   * @param  string  $reference
   * @param  string|bool|null  $withDefaultSchema
   * @return array{string|null, string}
   *
   * @throws \InvalidArgumentException
   */
  public parseSchemaAndTable (
    reference: string | Expression,
    withDefaultSchema: string | boolean | undefined = undefined
  ): [string | undefined, string] {
    const referenceName = String(
      reference instanceof Expression
        ? (reference.getValue(this.grammar) ?? '')
        : reference
    )

    const segments = referenceName.split('.')
    const [schemaSegment = '', tableSegment] = segments

    if (segments.length > 2) {
      throw new Error(
        "InvalidArgumentException: Using three-part references is not supported, you may use `Schema::connection('{$segments[0]}')` instead."
      )
    }

    const table = tableSegment ?? schemaSegment

    let schema: string | undefined

    if (tableSegment) {
      schema = schemaSegment
    } else if (typeof withDefaultSchema === 'string') {
      schema = withDefaultSchema
    } else if (withDefaultSchema) {
      schema = this.getCurrentSchemaName()
    }

    return [schema, table]
  }

  /**
   * Get the default schema name for the connection.
   *
   * @return string|null
   */
  public getCurrentSchemaName (): string | undefined {
    return this.getCurrentSchemaListing()?.[0] ?? undefined
  }

  /**
   * Get the names of the current schemas for the connection.
   *
   * @return string[]|null
   */
  public getCurrentSchemaListing (): string[] | undefined {
    return undefined
  }
}

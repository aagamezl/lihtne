import type { BindingValues, Builder } from '../Builder'

import { isNumeric } from '../../../Support/helpers'
import { Processor } from './Processor'

const postgresType = (type: string): string | null => {
  switch (type.toLowerCase()) {
    case 'b': return 'base'
    case 'c': return 'composite'
    case 'd': return 'domain'
    case 'e': return 'enum'
    case 'm': return 'multirange'
    case 'p': return 'pseudo'
    case 'r': return 'range'
    default: return null
  }
}

const postgresCategory = (category: string): string | null => {
  switch (category.toLowerCase()) {
    case 'a': return 'array'
    case 'b': return 'boolean'
    case 'c': return 'composite'
    case 'd': return 'date_time'
    case 'e': return 'enum'
    case 'g': return 'geometric'
    case 'i': return 'network_address'
    case 'n': return 'numeric'
    case 'p': return 'pseudo'
    case 'r': return 'range'
    case 's': return 'string'
    case 't': return 'timespan'
    case 'u': return 'user_defined'
    case 'v': return 'bit_string'
    case 'x': return 'unknown'
    case 'z': return 'internal_use'
    default: return null
  }
}

const postgresAction = (action: string): string | null => {
  switch (action.toLowerCase()) {
    case 'a': return 'no action'
    case 'c': return 'cascade'
    case 'd': return 'set default'
    case 'n': return 'set null'
    case 'r': return 'restrict'
    default: return null
  }
}

export class PostgresProcessor extends Processor {
  /**
   * Process the results of a "columns" query.
   *
   * @param  array  $results
   * @return array
   */
  public processColumns (results: unknown[]): Array<Record<string, unknown>> {
    return results.map((result) => {
      const column = result as {
        collation: string | null
        comment: string | null
        default: string | null
        generated: string | null
        name: string
        nullable: boolean | number | string
        type: string
        type_name: string
      }
      const autoincrement = column.default !== null && column.default.startsWith('nextval(')

      return {
        auto_increment: autoincrement,
        collation: column.collation,
        comment: column.comment,
        default: column.generated !== null && column.generated !== '' ? null : column.default,
        generation: column.generated !== null && column.generated !== ''
          ? {
            expression: column.default,
            type: column.generated === 's'
              ? 'stored'
              : column.generated === 'v'
                ? 'virtual'
                : null
          }
          : null,
        name: column.name,
        nullable: Boolean(column.nullable),
        type: column.type,
        type_name: column.type_name
      }
    })
  }

  /**
   * Process the results of a foreign key query.
   *
   * @param  array  $results
   * @return array
   */
  public processForeignKeys (results: unknown[]): Array<Record<string, unknown>> {
    return results.map((result) => {
      const foreignKey = result as {
        columns: string
        foreign_columns: string
        foreign_schema: string
        foreign_table: string
        name: string
        on_delete: string
        on_update: string
      }

      return {
        columns: foreignKey.columns.split(','),
        foreign_columns: foreignKey.foreign_columns.split(','),
        foreign_schema: foreignKey.foreign_schema,
        foreign_table: foreignKey.foreign_table,
        name: foreignKey.name,
        on_delete: postgresAction(foreignKey.on_delete),
        on_update: postgresAction(foreignKey.on_update)
      }
    })
  }

  /**
   * Process the results of an indexes query.
   *
   * @param  array  $results
   * @return array
   */
  public processIndexes (results: unknown[]): Array<Record<string, unknown>> {
    return results.map((result) => {
      const index = result as {
        columns: string | null
        name: string
        primary: boolean | number
        type: string
        unique: boolean | number
      }

      return {
        columns: index.columns !== null && index.columns !== '' ? index.columns.split(',') : [],
        name: index.name.toLowerCase(),
        primary: Boolean(index.primary),
        type: index.type.toLowerCase(),
        unique: Boolean(index.unique)
      }
    })
  }

  /**
   * Process an "insert get ID" query.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  string  $sql
   * @param  array  $values
   * @param  string|null  $sequence
   * @return int
   */
  public override async processInsertGetId (
    query: Builder,
    sql: string,
    values: BindingValues,
    sequence: string | undefined = undefined
  ): Promise<string | number> {
    const connection = query.getConnection()

    connection.recordsHaveBeenModified()

    const results = await connection.selectFromWriteConnection<
      Record<string, string | number>
    >(sql, values)

    const sequenceValue = sequence ?? 'id'

    const id = results[0]?.[sequenceValue]

    if (typeof id !== 'string' && typeof id !== 'number') {
      throw new Error(
        `RuntimeException: Unable to find sequence [${sequenceValue}] in inserted row.`
      )
    }

    return isNumeric(id) ? Number(id) : id
  }

  /**
   * Process the results of a types query.
   *
   * @param  array  $results
   * @return array
   */
  public processTypes (results: unknown[]): Array<Record<string, unknown>> {
    return results.map((result) => {
      const type = result as {
        category: string
        implicit: boolean | number
        name: string
        schema: string
        type: string
      }

      return {
        category: postgresCategory(type.category),
        implicit: Boolean(type.implicit),
        name: type.name,
        schema: type.schema,
        schema_qualified_name: `${type.schema}.${type.name}`,
        type: postgresType(type.type)
      }
    })
  }
}

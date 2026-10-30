import type { BindingValues, Builder } from '../Builder'

import { isNumeric } from '../../../Support/helpers'
import { Processor } from './Processor'

export class MySqlProcessor extends Processor {
  /**
   * Process the results of a column listing query.
   *
   * @deprecated Will be removed in a future Laravel version.
   *
   * @param  array  $results
   * @return array
   */
  public processColumnListing (results: unknown[]): string[] {
    return results.map((result) => {
      return (result as { column_name: string }).column_name
    })
  }

  /**
   * Process the results of a "columns" query.
   *
   * @param  array  $results
   * @return array
   */
  public processColumns (results: unknown[]): Array<Record<string, unknown>> {
    return results.map((result) => {
      const column = result as {
        collation: string | undefined
        comment: string | undefined
        default: string | undefined
        expression: string | undefined
        extra: string | undefined
        name: string
        nullable: string
        type: string
        type_name: string
      }

      return {
        name: column.name,
        type_name: column.type_name,
        type: column.type,
        collation: column.collation,
        nullable: column.nullable === 'YES',
        default: column.default,
        auto_increment: column.extra === 'auto_increment',
        comment: column.comment !== '' && column.comment !== undefined ? column.comment : undefined,
        generation: column.expression !== undefined && column.expression !== ''
          ? {
            expression: column.expression,
            type: column.extra === 'STORED GENERATED'
              ? 'stored'
              : column.extra === 'VIRTUAL GENERATED'
                ? 'virtual'
                : undefined
          }
          : undefined
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
        name: foreignKey.name,
        columns: foreignKey.columns.split(','),
        foreign_schema: foreignKey.foreign_schema,
        foreign_table: foreignKey.foreign_table,
        foreign_columns: foreignKey.foreign_columns.split(','),
        on_delete: foreignKey.on_delete.toLowerCase(),
        on_update: foreignKey.on_update.toLowerCase()
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
        type: string
        unique: boolean | number
      }
      const name = index.name.toLowerCase()

      return {
        name,
        columns: index.columns !== null && index.columns !== '' ? index.columns.split(',') : [],
        type: index.type.toLowerCase(),
        unique: Boolean(index.unique),
        primary: name === 'primary'
      }
    })
  }

  /**
   * Process an  "insert get ID" query.
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
    sequence?: string
  ): Promise<string | number> {
    await query.getConnection().insert(sql, values)

    const driver = await query.getConnection().getDriver()
    const id = await driver.lastInsertId(sequence)

    return isNumeric(id) ? parseInt(String(id), 10) : id
  }
}

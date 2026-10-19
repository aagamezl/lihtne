import type { BindingValues, Builder } from '../Builder'

import { isNumeric } from '../../../Support/helpers'
import { Processor } from './Processor'

export class PostgresProcessor extends Processor {
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
}

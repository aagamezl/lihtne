import { isObject } from '@devnetic/utils'

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
  ): number {
    const connection = query.getConnection()

    connection.recordsHaveBeenModified()

    const result = (await connection.selectFromWriteConnection(sql, values))[0]

    const sequenceValue = sequence ?? 'id'

    const id = isObject(result) ? result?.[sequenceValue] : result?.[sequenceValue]

    return isNumeric(id) ? Number(id) : id
  }
}

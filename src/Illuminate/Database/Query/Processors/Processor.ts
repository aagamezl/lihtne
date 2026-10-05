import type { BindingValues, Builder } from '../Builder'

import { isNumeric } from '../../../Support/helpers'

export class Processor {
  /**
   * Process the results of a "select" query.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $results
   * @return array
   */
  public processSelect (
    _query: Builder,
    results: Record<string, unknown>[]
  ): Record<string, unknown>[] {
    return results
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
  public processInsertGetId (
    query: Builder,
    sql: string,
    values: BindingValues,
    sequence?: string
  ): number {
    query.getConnection().insert(sql, values)

    const id = query.getConnection().getDriver().lastInsertId(sequence)

    return isNumeric(id) ? Number(id) : id
  }
}

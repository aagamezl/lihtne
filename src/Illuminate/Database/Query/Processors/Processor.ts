import type { BindingValues, Builder } from '../Builder'

import { isNumeric } from '../../../Support/helpers'

export class Processor {
  /**
   * Process an  "insert get ID" query.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  string  $sql
   * @param  array  $values
   * @param  string|null  $sequence
   * @return int
   */
  public async processInsertGetId (
    query: Builder,
    sql: string,
    values: BindingValues,
    sequence?: string
  ): Promise<string | number> {
    await query.getConnection().insert(sql, values)

    const driver = await query.getConnection().getDriver()
    const id = await driver.lastInsertId(sequence)

    return isNumeric(id) ? Number(id) : id
  }

  /**
   * Process the results of a "select" query.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $results
   * @return array
   */
  public processSelect<TResult> (
    // @ts-expect-error -- assertion parameter is type-only
    query: Builder,
    results: TResult
  ): TResult {
    return results
  }
}

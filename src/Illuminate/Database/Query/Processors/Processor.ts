import type { Builder } from '../Builder'

export class Processor {
  /**
 * Process the results of a "select" query.
 *
 * @param  \Illuminate\Database\Query\Builder  $query
 * @param  array  $results
 * @return array
 */
  public processSelect (query: Builder, results: Record<string, unknown>[]): Record<string, unknown>[] {
    return results
  }
}

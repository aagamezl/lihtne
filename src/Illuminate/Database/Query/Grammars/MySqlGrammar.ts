import type { Builder } from '../Builder'

import { Grammar } from './Grammar'

export class MySqlGrammar extends Grammar {
  /**
 * Compile a select query into SQL.
 *
 * @param  \Illuminate\Database\Query\Builder  $query
 * @return string
 */
  public override compileSelect (query: Builder): string {
    const sql = super.compileSelect(query)

    if (!query.timeout) {
      return sql
    }

    const milliseconds = query.timeout! * 1000

    return sql.replace(
      /^select\b/i,
      `select /*+ MAX_EXECUTION_TIME(${milliseconds}) */`
    )
  }

  /**
 * Wrap a single string in keyword identifiers.
 *
 * @param  {string}  value
 * @return {string}
 */
  public override wrapValue (value: string): string {
    return value === '*' ? value : '`' + value.replace('`', '``') + '`'
  }
}

import type { Builder, WhereClause } from '../Builder'

import { Grammar } from './Grammar'

export class MySqlGrammar extends Grammar {
  /**
 * Compile a select query into SQL.
 *
 * @param  \Illuminate\Database\Query\Builder  $query
 * @return string
 */
  public override compileSelect(query: Builder): string {
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
   * Compile a "where binary" clause.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $where
   * @return string
   */
  protected override whereBinary(query: Builder, where: WhereClause): string {
    where.operator = `${where.not ? '!=' : '='} binary`

    return this.whereBasic(query, where)
  }

  /**
   * Compile a "where like" clause.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $where
   * @return string
   */
  protected override whereLike(query: Builder, where: WhereClause): string {
    where.operator = where.not ? 'not ' : ''

    where.operator += where.caseSensitive ? 'like binary' : 'like'

    return this.whereBasic(query, where)
  }

  /**
   * Compile a "where null safe equals" clause.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $where
   * @return string
   */
  protected override whereNullSafeEquals(query: Builder, where: WhereClause): string {
    return this.wrap(where.column ?? '') + ' <=> ' + this.parameter(where.value);
  }


  /**
   * Wrap a single string in keyword identifiers.
   *
   * @param  {string}  value
   * @return {string}
   */
  public override wrapValue(value: string): string {
    return value === '*' ? value : '`' + value.replace('`', '``') + '`'
  }
}

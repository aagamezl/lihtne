import type { Builder, WhereClause } from '../Builder'

import { Grammar } from './Grammar'

export class SQLiteGrammar extends Grammar {
  /**
   * All of the available clause operators.
   *
   * @var string[]
   */
  protected override operators: string[] = [
    '=', '<', '>', '<=', '>=', '<>', '!=',
    'like', 'not like', 'ilike',
    '&', '|', '<<', '>>'
  ]

  /**
   * Compile the lock into SQL.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  bool|string  $value
   * @return string
   */
  protected compileLock (query: Builder, value: boolean | string): string {
    return ''
  }

  /**
   * Wrap a union subquery in parentheses.
   *
   * @param  string  $sql
   * @return string
   */
  protected override wrapUnion (sql: string): string {
    return `select * from (${sql})`
  }

  /**
 * Compile a "where null safe equals" clause.
 *
 * @param  \Illuminate\Database\Query\Builder  $query
 * @param  array  $where
 * @return string
 */
  protected whereNullSafeEquals (query: Builder, where: WhereClause): string {
    return this.wrap(where.column ?? '') + ' is ' + this.parameter(where.value)
  }

  /**
   * Compile a "where date" clause.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $where
   * @return string
   */
  protected override whereDate (query: Builder, where: WhereClause): string {
    return this.dateBasedWhere('%Y-%m-%d', query, where)
  }

  /**
   * Compile a "where day" clause.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $where
   * @return string
   */
  protected override whereDay (query: Builder, where: WhereClause): string {
    return this.dateBasedWhere('%d', query, where)
  }

  /**
   * Compile a "where month" clause.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $where
   * @return string
   */
  protected override whereMonth (query: Builder, where: WhereClause): string {
    return this.dateBasedWhere('%m', query, where)
  }

  /**
   * Compile a "where year" clause.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $where
   * @return string
   */
  protected override whereYear (query: Builder, where: WhereClause): string {
    return this.dateBasedWhere('%Y', query, where)
  }

  /**
   * Convert a LIKE pattern to a GLOB pattern using simple string replacement.
   *
   * @param  string  $value
   * @param  bool  $caseSensitive
   * @return string
   */
  public prepareWhereLikeBinding (value: string, caseSensitive: boolean): string {
    if (!caseSensitive) {
      return value
    }

    return value
      .replaceAll('*', '[*]')
      .replaceAll('?', '[?]')
      .replaceAll('%', '*')
      .replaceAll('_', '?')
  }

  /**
   * Compile a "where like" clause.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $where
   * @return string
   */
  protected whereLike (query: Builder, where: WhereClause): string {
    if (where.caseSensitive == false) {
      return super.whereLike(query, where)
    }
    where.operator = where.not ? 'not glob' : 'glob'

    return this.whereBasic(query, where)
  }

  /**
   * Compile a "where time" clause.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $where
   * @return string
   */
  protected override whereTime (query: Builder, where: WhereClause): string {
    return this.dateBasedWhere('%H:%M:%S', query, where)
  }

  /**
 * Compile a date based where clause.
 *
 * @param  string  $type
 * @param  \Illuminate\Database\Query\Builder  $query
 * @param  array  $where
 * @return string
 */
  protected override dateBasedWhere (type: string, query: Builder, where: WhereClause): string {
    const value = this.parameter(where.value)

    return `strftime('${type}', ${this.wrap(where.column ?? '')}) ${where.operator} cast(${value} as text)`
  }
}

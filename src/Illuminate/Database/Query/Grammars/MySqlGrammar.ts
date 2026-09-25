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
   * Compile a "where fulltext" clause.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $where
   * @return string
   */
  public override whereFulltext(query: Builder, where: WhereClause): string {
    const columns = this.columnize(where.columns ?? []);

    const value = this.parameter(where.value);

    const mode = (where.options?.mode ?? '') === 'boolean'
      ? ' in boolean mode'
      : ' in natural language mode';

    const expanded = (where.options?.expanded ?? false) && (where.options?.mode ?? '') !== 'boolean'
      ? ' with query expansion'
      : '';

    return `match (${columns}) against (${value}${mode}${expanded})`
  }

  /**
   * Add a "where null" clause to the query.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $where
   * @return string
   */
  protected override whereNull(query: Builder, where: WhereClause): string {
    const columnValue = this.getValue(where.column ?? '');

    if (this.isJsonSelector(columnValue)) {
      const [field, path] = this.wrapJsonFieldAndPath(columnValue);

      return `(json_extract(${field}${path}) is null OR json_type(json_extract(${field}${path})) = 'NULL')`;
    }

    return super.whereNull(query, where);
  }

  /**
   * Add a "where not null" clause to the query.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $where
   * @return string
   */
  protected override whereNotNull(query: Builder, where: WhereClause): string {
    const columnValue = this.getValue(where.column);

    if (this.isJsonSelector(columnValue)) {
      const [field, path] = this.wrapJsonFieldAndPath(columnValue);

      return `(json_extract(${field}${path}) is not null AND json_type(json_extract(${field}${path})) != 'NULL')`;
    }

    return super.whereNotNull(query, where);
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
    return this.wrap(where.column ?? '') + ' <=> ' + this.parameter(where.value)
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

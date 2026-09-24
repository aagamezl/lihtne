import type { Builder } from '../Builder'
import type { JoinLateralClause } from '../JoinLateralClause'

import { MySqlGrammar } from './MySqlGrammar'

export class MariaDbGrammar extends MySqlGrammar {
  /**
   * Compile a "lateral join" clause.
   *
   * @param  \Illuminate\Database\Query\JoinLateralClause  $join
   * @param  string  $expression
   * @return string
   *
   * @throws \RuntimeException
   */
  public override compileJoinLateral (join: JoinLateralClause, expression: string): string {
    throw new Error('RuntimeException: This database engine does not support lateral joins.')
  }

  /**
   * Compile a "JSON value cast" statement into SQL.
   *
   * @param  string  $value
   * @return string
   */
  public compileJsonValueCast (value: string): string {
    return `json_query(${value}, '$')`
  }

  /**
   * Compile a query to get the number of open connections for a database.
   *
   * @return string
   */
  public compileThreadCount (): string {
    return 'select variable_value as `Value` from information_schema.global_status where variable_name = \'THREADS_CONNECTED\''
  }

  /**
   * Compile a vector distance expression for the given column.
   *
   * @param  string  $column
   * @return string
   */
  public compileVectorDistanceExpression (column: string): string {
    return `vec_distance_cosine(${this.wrap(column)}, vec_fromtext(?))`
  }

  /**
   * Determine if the grammar supports vector distance queries.
   *
   * @return bool
   */
  public supportsVectorDistance (): boolean {
    return true
  }

  /**
   * Determine whether to use a legacy group limit clause for MySQL < 8.0.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @return bool
   */
  public useLegacyGroupLimit (query: Builder): boolean {
    return false
  }

  /**
   * Wrap the given JSON selector.
   *
   * @param  string  $value
   * @return string
   */
  protected override wrapJsonSelector (value: string): string {
    const [field, path] = this.wrapJsonFieldAndPath(value)

    return `json_value(${field}${path})`
  }
}

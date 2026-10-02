import type { Builder, WhereClause } from '../Builder'
import type { JoinLateralClause } from '../JoinLateralClause'

import { isNumeric } from '../../../Support'
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

    const milliseconds = query.timeout * 1000

    return sql.replace(
      /^select\b/i,
      `select /*+ MAX_EXECUTION_TIME(${milliseconds}) */`
    )
  }

  /**
    * Compile a "lateral join" clause.
    *
    * @param  \Illuminate\Database\Query\JoinLateralClause  $join
    * @param  string  $expression
    * @return string
    */
  public override compileJoinLateral (
    // @ts-expect-error expected error; join is not used in this method

    join: JoinLateralClause,
    // @ts-expect-error expected error; expression is not used in this method

    expression: string
  ): string {
    return `${join.type} join lateral ${expression} on true`
  }

  /**
   * Compile a "where binary" clause.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $where
   * @return string
   */
  protected override whereBinary (query: Builder, where: WhereClause): string {
    where.operator = `${where.not ? '!=' : '='} binary`

    return this.whereBasic(query, where)
  }

  /**
   * {@inheritdoc}
   */
  protected override supportsStraightJoins (): boolean {
    return true
  }

  /**
   * Compile the random statement into SQL.
   *
   * @param  string|number  seed
   * @return string
   */
  public override compileRandom (seed: string | number): string {
    if (seed === '' || seed === null || typeof seed === 'undefined') {
      return 'RAND()'
    }

    if (!isNumeric(seed)) {
      throw new Error(
        'InvalidArgumentException: The seed value must be numeric.'
      )
    }

    // In MySQL, RAND accepts an integer seed
    // Ensure we only pass an integer
    const intSeed = parseInt(seed as string, 10)
    return `RAND(${intSeed})`
  }

  /**
   * Compile a "where fulltext" clause.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $where
   * @return string
   */
  public override whereFulltext (_query: Builder, where: WhereClause): string {
    const columns = this.columnize(where.columns ?? [])

    const value = this.parameter(where.value)

    const mode =
      (where.options?.mode ?? '') === 'boolean'
        ? ' in boolean mode'
        : ' in natural language mode'

    const expanded =
      (where.options?.expanded ?? false) &&
        (where.options?.mode ?? '') !== 'boolean'
        ? ' with query expansion'
        : ''

    return `match (${columns}) against (${value}${mode}${expanded})`
  }

  /**
   * Add a "where null" clause to the query.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $where
   * @return string
   */
  protected override whereNull (query: Builder, where: WhereClause): string {
    const columnValue = String(this.getValue(where.column ?? ''))

    if (this.isJsonSelector(columnValue)) {
      const [field, path] = this.wrapJsonFieldAndPath(columnValue)

      return `(json_extract(${field}${path}) is null OR json_type(json_extract(${field}${path})) = 'NULL')`
    }

    return super.whereNull(query, where)
  }

  /**
   * Add a "where not null" clause to the query.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $where
   * @return string
   */
  protected override whereNotNull (query: Builder, where: WhereClause): string {
    const columnValue = String(this.getValue(where.column ?? ''))

    if (this.isJsonSelector(columnValue)) {
      const [field, path] = this.wrapJsonFieldAndPath(columnValue)

      return `(json_extract(${field}${path}) is not null AND json_type(json_extract(${field}${path})) != 'NULL')`
    }

    return super.whereNotNull(query, where)
  }

  /**
   * Compile a "where like" clause.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $where
   * @return string
   */
  protected override whereLike (query: Builder, where: WhereClause): string {
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
  protected override whereNullSafeEquals (
    _query: Builder,
    where: WhereClause
  ): string {
    return this.wrap(where.column ?? '') + ' <=> ' + this.parameter(where.value)
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

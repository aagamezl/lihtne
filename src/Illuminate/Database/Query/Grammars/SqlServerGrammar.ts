import { cloneDeep } from 'es-toolkit'

import type { Builder, WhereClause } from '../Builder'
import type { Expression } from '../Expression'
import type { JoinLateralClause } from '../JoinLateralClause'

import { Grammar, type SelectComponents } from './Grammar'

export class SqlServerGrammar extends Grammar {
  /**
   * All of the available clause operators.
   *
   * @var string[]
   */
  protected override operators = [
    '=',
    '<',
    '>',
    '<=',
    '>=',
    '!<',
    '!>',
    '<>',
    '!=',
    'like',
    'not like',
    'ilike',
    '&',
    '&=',
    '|',
    '|=',
    '^',
    '^='
  ]

  /**
   * The components that make up a select clause.
   *
   * @var string[]
   */
  public override selectComponents: SelectComponents = [
    { name: 'aggregate', property: 'aggregateProperty' },
    { name: 'columns', property: 'columns' },
    { name: 'from', property: 'fromProperty' },
    { name: 'indexHint', property: 'indexHint' },
    { name: 'joins', property: 'joins' },
    { name: 'wheres', property: 'wheres' },
    { name: 'groups', property: 'groups' },
    { name: 'havings', property: 'havings' },
    { name: 'orders', property: 'orders' },
    { name: 'offset', property: 'offsetProperty' },
    { name: 'limit', property: 'limitProperty' },
    { name: 'lock', property: 'lockProperty' }
  ]

  /**
   * Compile a "where date" clause.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $where
   * @return string
   */
  protected override whereDate (_query: Builder, where: WhereClause): string {
    const value = this.parameter(where.value)

    return (
      'cast(' +
      this.wrap(where.column ?? '') +
      ' as date) ' +
      where.operator +
      ' ' +
      value
    )
  }

  /**
   * Compile a "where time" clause.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $where
   * @return string
   */
  protected override whereTime (_query: Builder, where: WhereClause): string {
    const value = this.parameter(where.value)

    return (
      'cast(' +
      this.wrap(where.column ?? '') +
      ' as time) ' +
      where.operator +
      ' ' +
      value
    )
  }

  /**
   * Compile the "limit" portions of the query.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  int  $limit
   * @return string
   */
  protected override compileLimit (query: Builder, limit: number): string {
    limit = parseInt(String(limit))

    if (limit && (query.offsetProperty ?? 0) > 0) {
      return `fetch next ${limit} rows only`
    }

    return ''
  }

  /**
   * Compile the random statement into SQL.
   *
   * @param  string|int  $seed
   * @return string
   */
  // @ts-expect-error expected error; seed is not used in this method
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public override compileRandom (seed: string | number): string {
    return 'NEWID()'
  }

  /**
   * Compile a select query into SQL.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @return string
   */
  public override compileSelect (query: Builder): string {
    // An order by clause is required for SQL Server offset to function...
    if (query.offsetProperty && query.orders.length === 0) {
      query.orders.push({ sql: '(SELECT 0)' })
    }

    return super.compileSelect(query)
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
    const type = join.type === 'left' ? 'outer' : 'cross'

    return String(`${type} apply ${expression}`).trim()
  }

  /**
   * Wrap a union subquery in parentheses.
   *
   * @param  string  $sql
   * @return string
   */
  protected override wrapUnion (sql: string): string {
    return 'select * from (' + sql + ') as ' + this.wrapTable('temp_table')
  }

  /**
   * Compile the "select *" portion of the query.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $columns
   * @return string|null
   */
  protected override compileColumns (
    query: Builder,
    columns: Array<Expression | string>
  ): string {
    if (query.aggregateProperty !== undefined) {
      return ''
    }

    let select = query.distinctProperty ? 'select distinct ' : 'select '

    // If there is a limit on the query, but not an offset, we will add the top
    // clause to the query, which serves as a "limit" type clause within the
    // SQL Server system similar to the limit keywords available in MySQL.
    if (
      typeof query.limitProperty === 'number' &&
      query.limitProperty > 0 &&
      (query.offsetProperty ?? 0) <= 0
    ) {
      select += 'top ' + Number(query.limitProperty) + ' '
    }

    return select + this.columnize(columns)
  }

  /**
   * Compile an exists statement into SQL.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @return string
   */
  public override compileExists (query: Builder): string {
    const existsQuery = cloneDeep(query)

    existsQuery.columns = []

    return this.compileSelect(existsQuery.selectRaw('1 [exists]').limit(1))
  }

  /**
   * Compile the "from" portion of the query.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  string  $table
   * @return string
   */
  protected override compileFrom (query: Builder, table: string): string {
    const from = super.compileFrom(query, table)

    if (typeof query.lockProperty === 'string') {
      return from + ' ' + query.lockProperty
    }

    if (query.lockProperty !== undefined) {
      return (
        from +
        ' with(rowlock,' +
        (query.lockProperty ? 'updlock,' : '') +
        'holdlock)'
      )
    }

    return from
  }

  /**
   * Compile the "offset" portions of the query.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  int  $offset
   * @return string
   */
  protected override compileOffset (_query: Builder, offset: number): string {
    offset = Number(offset)

    if (offset) {
      return `offset ${offset} rows`
    }

    return ''
  }

  /**
   * Compile the lock into SQL.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  bool|string  $value
   * @return string
   */
  protected override compileLock (
    // @ts-expect-error expected error; query is not used in this method
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    query: Builder,
    // @ts-expect-error expected error; value is not used in this method
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    value: boolean | string
  ): string {
    return ''
  }

  /**
   * Wrap a single string in keyword identifiers.
   *
   * @param  string  $value
   * @return string
   */
  protected override wrapValue (value: string): string {
    return value === '*' ? value : '[' + value.replace(']', ']]') + ']'
  }

  /**
   * Wrap a table in keyword identifiers.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression|string  $table
   * @param  string|null  $prefix
   * @return string
   */
  public override wrapTable (
    table: Expression | string,
    prefix: string | null = null
  ): string {
    if (!this.isExpression(table)) {
      return this.wrapTableValuedFunction(super.wrapTable(table, prefix))
    }

    return String(this.getValue(table))
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
    return (
      'exists (select ' +
      this.wrap(where.column ?? '') +
      ' intersect select ' +
      this.parameter(where.value) +
      ')'
    )
  }

  /**
   * Wrap a table in keyword identifiers.
   *
   * @param  string  $table
   * @return string
   */
  protected wrapTableValuedFunction (table: string): string {
    const tableValuedFunction = /^(.+?)(\(.*?\))]$/

    if (tableValuedFunction.test(table)) {
      return table.replace(tableValuedFunction, '$1]$2')
    }

    return table
  }
}

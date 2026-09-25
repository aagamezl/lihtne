import type { Builder, WhereClause } from '../Builder'
import type { Expression } from '../Expression'

import { Grammar, type SelectComponents } from './Grammar'

export class SqlServerGrammar extends Grammar {
  /**
   * All of the available clause operators.
   *
   * @var string[]
   */
  protected override operators = [
    '=', '<', '>', '<=', '>=', '!<', '!>', '<>', '!=',
    'like', 'not like', 'ilike',
    '&', '&=', '|', '|=', '^', '^='
  ]

  /**
   * The components that make up a select clause.
   *
   * @var string[]
   */
  protected override selectComponents: SelectComponents = [
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
  protected override whereDate (query: Builder, where: WhereClause): string {
    const value = this.parameter(where.value)

    return 'cast(' + this.wrap(where.column) + ' as date) ' + where.operator + ' ' + value
  }

  /**
   * Compile a "where time" clause.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $where
   * @return string
   */
  protected override whereTime (query: Builder, where: WhereClause): string {
    const value = this.parameter(where.value)

    return 'cast(' + this.wrap(where.column) + ' as time) ' + where.operator + ' ' + value
  }

  /**
   * Compile a select query into SQL.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @return string
   */
  public override compileSelect (query: Builder): string {
    // An order by clause is required for SQL Server offset to function...
    if (query.offsetProperty && query.ordersProperty.length === 0) {
      query.ordersProperty.push({ sql: '(SELECT 0)' })
    }

    return super.compileSelect(query)
  }

  /**
   * Compile the "select *" portion of the query.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $columns
   * @return string|null
   */
  protected override compileColumns (query: Builder, columns: Array<Expression | string>): string | null | undefined {
    if (query.aggregateProperty !== undefined) {
      return
    }

    const select = query.distinctProperty ? 'select distinct ' : 'select '

    // If there is a limit on the query, but not an offset, we will add the top
    // clause to the query, which serves as a "limit" type clause within the
    // SQL Server system similar to the limit keywords available in MySQL.
    if (typeof query.limitProperty === 'number' && query.limitProperty > 0 && query.offsetProperty <= 0) {
      select += 'top ' + Number(query.limitProperty) + ' '
    }

    return select + this.columnize(columns)
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
      return from + ' with(rowlock,' + (query.lockProperty ? 'updlock,' : '') + 'holdlock)'
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
  protected override compileOffset (query: Builder, offset: number): string {
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
  protected compileLock (query: Builder, value: boolean | string): string {
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
  public override wrapTable (table: Expression | string, prefix: string | null = null): string {
    if (!this.isExpression(table)) {
      return this.wrapTableValuedFunction(super.wrapTable(table, prefix))
    }

    return this.getValue(table)
  }

  /**
   * Compile a "where null safe equals" clause.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $where
   * @return string
   */
  protected override whereNullSafeEquals (query: Builder, where: WhereClause): string {
    return 'exists (select ' + this.wrap(where.column ?? '') + ' intersect select ' + this.parameter(where.value) + ')'
  }

  /**
   * Wrap a table in keyword identifiers.
   *
   * @param  string  $table
   * @return string
   */
  protected wrapTableValuedFunction (table: string): string {
    if (new RegExp('^(.+?)(\\(.*?\\))]$').test(table)) {
      return table.replace(new RegExp('^(.+?)(\\(.*?\\))]$'), '$1]$2')
    }

    return table
  }
}

import { cloneDeep } from 'es-toolkit'

import type { Scalar } from '../../../Support/types'
import type { Bindings, BindingValues, Builder, Having, WhereClause } from '../Builder'
import type { Expression } from '../Expression'
import type { IndexHint } from '../IndexHint'
import type { JoinLateralClause } from '../JoinLateralClause'

import { Arr, Collection } from '../../../Collections'
import { Str } from '../../../Support'
import { getValue, isNumeric } from '../../../Support/helpers'
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
   * Compile an update statement without joins into SQL.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  string  $table
   * @param  string  $columns
   * @param  string  $where
   * @return string
   */
  protected override compileUpdateWithoutJoins (query: Builder, table: string, columns: string, where: string): string {
    const sql = super.compileUpdateWithoutJoins(query, table, columns, where)

    return query.limitProperty && query.limitProperty > 0 && (query.offsetProperty ?? 0) <= 0
      ? Str.replaceFirst('update', 'update top (' + query.limitProperty + ')', sql)
      : sql
  }

  /**
    * Compile an "upsert" statement into SQL.
    *
    * @param  \Illuminate\Database\Query\Builder  $query
    * @param  array  $values
    * @param  array  $uniqueBy
    * @param  array  $update
    * @return string
    */
  public override compileUpsert (
    query: Builder,
    values: unknown[],
    uniqueBy: string | string[],
    update: unknown[]
  ): string {
    const columns = this.columnize(Object.keys(values[0]))

    let sql = 'merge ' + this.wrapTable(query.fromProperty) + ' '

    const parameters = (new Collection(values))
      .map((record: unknown) => '(' + this.parameterize(record) + ')')
      .implode(', ')

    sql += 'using (values ' + parameters + ') ' + this.wrapTable('lihtne_source') + ' (' + columns + ') '

    const on = (new Collection(uniqueBy))
      .map((column: string) => this.wrap('lihtne_source.' + column) + ' = ' + this.wrap(query.fromProperty + '.' + column))
      .implode(' and ')

    sql += 'on ' + on + ' '

    if (update) {
      const updateColumns = (new Collection(update as unknown[])).map((value: unknown, key: PropertyKey) => {
        return isNumeric(key)
          ? this.wrap(value) + ' = ' + this.wrap('lihtne_source.' + value)
          : this.wrap(key) + ' = ' + this.parameter(value)
      }).implode(', ')

      sql += 'when matched then update set ' + updateColumns + ' '
    }

    sql += 'when not matched then insert (' + columns + ') values (' + columns + ');'

    return sql
  }

  /**
   * Compile a "JSON length" statement into SQL.
   *
   * @param  string  $column
   * @param  string  $operator
   * @param  string  $value
   * @return string
   */
  protected compileJsonLength (column: string, operator: string, value: string): string {
    const [field, path] = this.wrapJsonFieldAndPath(column)

    return `json_length(${field}${path}) ${operator} ${value}`
  }

  /**
   * Compile a row number clause.
   *
   * @param  string  $partition
   * @param  string  $orders
   * @return string
   */
  protected override compileRowNumber (partition: string, orders: string): string {
    if (orders.length === 0) {
      orders = 'order by (select 0)'
    }

    return super.compileRowNumber(partition, orders)
  }

  /**
   * Compile the SQL statement to define a savepoint.
   *
   * @param  string  $name
   * @return string
   */
  public compileSavepoint (name: string): string {
    return `SAVE TRANSACTION ${name}`
  }

  /**
   * Compile the SQL statement to execute a savepoint rollback.
   *
   * @param  string  $name
   * @return string
   */
  public compileSavepointRollBack (name: string): string {
    return `ROLLBACK TRANSACTION ${name}`
  }

  /**
   * Compile a query to get the number of open connections for a database.
   *
   * @return string
   */
  public compileThreadCount (): string {
    return `select count(*) Value from sys.dm_exec_sessions where status = N'running'`
  }

  /**
   * Get the format for database stored dates.
   *
   * @return string
   */
  public getDateFormat (): string {
    return 'Y-m-d H:i:s.v'
  }

  /**
   * Compile a "JSON value cast" statement into SQL.
   *
   * @param  string  $value
   * @return string
   */
  public compileJsonValueCast (value: string): string {
    return `cast(${value} as json)`
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

  /**
   * Prepare the bindings for an update statement.
   *
   * @param  array  $bindings
   * @param  array  $values
   * @return array
   */
  public override prepareBindingsForUpdate (bindings: Bindings, values: BindingValues): BindingValues {
    const cleanBindings = Arr.except(bindings, 'select')

    const flattenedValues = Arr.flatten(
      (Array.isArray(values) ? values : Object.values(values)).map((value) =>
        getValue(value))
    )

    return [
      ...flattenedValues,
      ...Arr.flatten(cleanBindings)
    ]
  }

  /**
    * Compile a delete statement without joins into SQL.
    *
    * @param  \Illuminate\Database\Query\Builder  $query
    * @param  string  $table
    * @param  string  $where
    * @return string
    */
  protected override compileDeleteWithoutJoins (query: Builder, table: string, where: string): string {
    const sql = super.compileDeleteWithoutJoins(query, table, where)

    return query.limitProperty && query.limitProperty > 0 && (query.offsetProperty ?? 0) <= 0
      ? Str.replaceFirst('delete', 'delete top (' + query.limitProperty + ')', sql)
      : sql
  }

  /**
   * Compile a single having clause.
   *
   * @param  array  $having
   * @return string
   */
  protected override whereBitwise (_query: Builder, where: WhereClause): string {
    const value = this.parameter(where.value)
    const operator = where.operator?.replace('?', '??') ?? ''

    return `(${this.wrap(where.column ?? '')} ${operator} ${value}) != 0`
  }

  protected override compileHaving (having: Having): string {
    if (having.type === 'Bitwise') {
      return this.compileHavingBitwise(having)
    }

    return super.compileHaving(having)
  }

  /**
   * Compile a having clause involving a bitwise operator.
   *
   * @param  array  $having
   * @return string
   */
  protected compileHavingBitwise (having: Having): string {
    const column = this.wrap(having.column ?? '')

    const parameter = this.parameter(having.value)

    return '(' + column + ' ' + having.operator + ' ' + parameter + ') != 0'
  }

  /**
   * Compile the index hints for the query.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  \Illuminate\Database\Query\IndexHint  $indexHint
   * @return string
   *
   * @throws \InvalidArgumentException
   */
  // @ts-expect-error expected error; query is not used in this method

  protected override compileIndexHint (query: Builder, indexHint: IndexHint): string {
    if (indexHint.type !== 'force') {
      return ''
    }

    const index = indexHint.index

    if (!/^[a-zA-Z0-9_$]+$/.test(index)) {
      throw new Error('InvalidArgumentException: Index name contains invalid characters.')
    }

    return `with (index([${index}]))`
  }

  /**
   * Compile a "JSON contains" statement into SQL.
   *
   * @param  string  $column
   * @param  string  $value
   * @return string
   */
  protected compileJsonContains (column: string, value: string): string {
    const [field, path] = this.wrapJsonFieldAndPath(column)

    return `json_contains(${field}, ${value}${path})`
  }

  /**
   * Compile an update statement with joins into SQL.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  string  $table
   * @param  string  $columns
   * @param  string  $where
   * @return string
   */
  protected override compileUpdateWithJoins (query: Builder, table: string, columns: string, where: string): string {
    const alias = table.split(' as ').pop() ?? ''

    const joins = this.compileJoins(query, query.joins)

    return `update ${alias} set ${columns} from ${table} ${joins} ${where}`
  }

  /**
   * Compile a "JSON contains key" statement into SQL.
   *
   * @param  string  $column
   * @return string
   */
  protected compileJsonContainsKey (column: string): string {
    const [field, path] = this.wrapJsonFieldAndPath(column)

    return `ifnull(json_contains_path(${field}, 'one${path}), 0)`
  }

  /**
  * Prepare the binding for a "JSON contains" statement.
  *
  * @param  mixed  $binding
  * @return string
  */
  public prepareBindingForJsonContains (binding: Scalar): string {
    return typeof binding === 'boolean' ? JSON.stringify(binding) : String(binding)
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

  /**
   * Wrap the given JSON boolean value.
   *
   * @param  string  $value
   * @return string
   */
  protected override wrapJsonBooleanValue (value: string): string {
    return `'${value}'`
  }
}

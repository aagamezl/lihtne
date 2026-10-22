import { isPlainObject } from '@devnetic/utils'

import type {
  Bindings,
  BindingValue,
  BindingValues,
  Builder,
  WhereClause
} from '../Builder'
import type { Expression } from '../Expression'
import type { IndexHint } from '../IndexHint'
import type { JoinLateralClause } from '../JoinLateralClause'

import { Collection } from '../../../Collections'
import { isNumeric, Str } from '../../../Support'
import { versionCompare } from '../../../Support/versionCompare'
import { Grammar } from './Grammar'

export class MySqlGrammar extends Grammar {
  /**
   * The grammar specific operators.
   *
   * @var string[]
   */
  protected override operators = ['sounds like']

  /**
   * Compile an insert statement into SQL.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $values
   * @return string
   */
  public override compileInsert (
    query: Builder,
    values: Record<string, unknown> | unknown[]
  ): string {
    if (Object.keys(values).length === 0) {
      values = [[]]
    }

    return super.compileInsert(query, values)
  }

  /**
   * Compile an insert ignore statement into SQL.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $values
   * @return string
   */
  public override compileInsertOrIgnore (
    query: Builder,
    values: unknown[]
  ): string {
    return Str.replaceFirst(
      'insert',
      'insert ignore',
      this.compileInsert(query, values)
    )
  }

  /**
   * Compile an insert ignore statement using a subquery into SQL.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $columns
   * @param  string  $sql
   * @return string
   */
  public override compileInsertOrIgnoreUsing (
    query: Builder,
    columns: string[],
    sql: string
  ): string {
    return Str.replaceFirst(
      'insert',
      'insert ignore',
      this.compileInsertUsing(query, columns, sql)
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
    join: JoinLateralClause,
    expression: string
  ): string {
    return `${join.type} join lateral ${expression} on true`
  }

  /**
     * Compile a "JSON value cast" statement into SQL.
     *
     * @param  string  $value
     * @return string
     */
  public override compileJsonValueCast (value: string): string {
    return `cast(${value} as json)`
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
   * Compile a query to get the number of open connections for a database.
   *
   * @return string
   */
  public override compileThreadCount (): string {
    return "select variable_value as `Value` from performance_schema.session_status where variable_name = 'threads_connected'"
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
    // @ts-expect-error - uniqueBy is not used

    uniqueBy: string | string[],
    update: Array<string | Expression> | Record<string, string | Expression>
  ): string {
    const useUpsertAlias = query.getConnection().getConfig('use_upsert_alias')

    let sql = this.compileInsert(query, values)

    if (useUpsertAlias) {
      sql += ' as lihtne_upsert_alias'
    }

    sql += ' on duplicate key update '

    const columns = new Collection<string, string | Expression>(update)
      .map((value, key) => {
        if (!isNumeric(key)) {
          return this.wrap(key) + ' = ' + this.parameter(value)
        }

        return useUpsertAlias
          ? this.wrap(value) +
          ' = ' +
          this.wrap('lihtne_upsert_alias') +
          '.' +
          this.wrap(value)
          : this.wrap(value) + ' = values(' + this.wrap(value) + ')'
      })
      .implode(', ')

    return sql + columns
  }

  /**
   * Prepare the bindings for an update statement.
   *
   * Booleans, integers, and doubles are inserted into JSON updates as raw values.
   *
   * @param  array  $bindings
   * @param  array  $values
   * @return array
   */
  public override prepareBindingsForUpdate (
    bindings: Bindings,
    values: BindingValues
  ): BindingValues {
    const newValues = new Collection<string, BindingValue>(values)
      .reject(
        (value, column) =>
          this.isJsonSelector(column) && typeof value === 'boolean'
      )
      .map((value) =>
        Array.isArray(value) || isPlainObject(value)
          ? JSON.stringify(value)
          : value)
      .all()

    return super.prepareBindingsForUpdate(bindings, newValues)
  }

  /**
   * Compile a "where fulltext" clause.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $where
   * @return string
   */
  public override whereFulltext (
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- required by the base whereFulltext signature
    // @ts-expect-error -- required by the base whereFulltext signature
    query: Builder,
    where: WhereClause
  ): string {
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
   * Wrap a single string in keyword identifiers.
   *
   * @param  {string}  value
   * @return {string}
   */
  public override wrapValue (value: string): string {
    return value === '*' ? value : '`' + value.replace('`', '``') + '`'
  }

  /**
   * Compile a delete statement with joins into SQL.
   *
   * Adds ORDER BY and LIMIT if present, for platforms that allow them (e.g., PlanetScale).
   *
   * Standard MySQL does not support ORDER BY or LIMIT with joined deletes and will throw a syntax error.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  string  $table
   * @param  string  $where
   * @return string
   */
  protected override compileDeleteWithJoins (
    query: Builder,
    table: string,
    where: string
  ): string {
    let sql = super.compileDeleteWithJoins(query, table, where)

    if (query.orders.length > 0) {
      sql += ' ' + this.compileOrders(query, query.orders)
    }

    if (query.limitProperty) {
      sql += ' ' + this.compileLimit(query, query.limitProperty)
    }

    return sql
  }

  /**
   * Compile a delete statement without joins into SQL.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  string  $table
   * @param  string  $where
   * @return string
   */
  protected override compileDeleteWithoutJoins (
    query: Builder,
    table: string,
    where: string
  ): string {
    let sql = super.compileDeleteWithoutJoins(query, table, where)

    if (query.orders.length > 0) {
      sql += ' ' + this.compileOrders(query, query.orders)
    }

    if (query.limitProperty) {
      sql += ' ' + this.compileLimit(query, query.limitProperty)
    }

    return sql
  }

  /**
   * Compile a group limit clause.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @return string
   */
  protected override async compileGroupLimit (query: Builder): Promise<string> {
    const useLegacyGroupLimit = await this.useLegacyGroupLimit(query)

    return useLegacyGroupLimit
      ? this.compileLegacyGroupLimit(query)
      : super.compileGroupLimit(query)
  }

  /**
   * Determine whether to use a legacy group limit clause for MySQL < 8.0.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @return bool
   */
  public async useLegacyGroupLimit(query: Builder): Promise<boolean> {
    const version = await query.getConnection().getServerVersion()

    // @ts-expect-error -- isMaria is not a property of the Connection interface, required by the base useLegacyGroupLimit signature
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- required by the base useLegacyGroupLimit signature
    const isMaria = await query.getConnection().isMaria()

    return !(isMaria) && versionCompare(version, '8.0.11', '<')
  }

  /**
   * Compile a "JSON contains" statement into SQL.
   *
   * @param  string  $column
   * @param  string  $value
   * @return string
   */
  /**
   * Compile the index hints for the query.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  \Illuminate\Database\Query\IndexHint  $indexHint
   * @return string
   *
   * @throws \InvalidArgumentException
   */
  protected override compileIndexHint (
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- required by the base compileIndexHint signature
    // @ts-expect-error -- required by the base compileIndexHint signature
    query: Builder,
    indexHint?: IndexHint
  ): string {
    if (indexHint === undefined) {
      return ''
    }

    const index = indexHint.index

    const indexes = index.split(',').map((index) => index.trim())

    for (const index of indexes) {
      if (!/^[a-zA-Z0-9_$]+$/.test(index)) {
        throw new Error(
          'InvalidArgumentException: Index name contains invalid characters.'
        )
      }
    }

    switch (indexHint.type) {
      case 'hint':
        return 'use index (' + index + ')'
      case 'force':
        return 'force index (' + index + ')'
      default:
        return 'ignore index (' + index + ')'
    }
  }

  protected override compileJsonContains (
    column: string,
    value: string
  ): string {
    const [field, path] = this.wrapJsonFieldAndPath(column)

    return 'json_contains(' + field + ', ' + value + path + ')'
  }

  /**
   * Compile a "JSON contains key" statement into SQL.
   *
   * @param  string  $column
   * @return string
   */
  protected override compileJsonContainsKey (column: string): string {
    const [field, path] = this.wrapJsonFieldAndPath(column)

    return 'ifnull(json_contains_path(' + field + ", 'one'" + path + '), 0)'
  }

  /**
   * Compile a "JSON length" statement into SQL.
   *
   * @param  string  $column
   * @param  string  $operator
   * @param  string  $value
   * @return string
   */
  protected override compileJsonLength (
    column: string,
    operator: string,
    value: string
  ): string {
    const [field, path] = this.wrapJsonFieldAndPath(column)

    return 'json_length(' + field + path + ') ' + operator + ' ' + value
  }

  /**
   * Compile a "JSON overlaps" statement into SQL.
   *
   * @param  string  $column
   * @param  string  $value
   * @return string
   */
  protected override compileJsonOverlaps (
    column: string,
    value: string
  ): string {
    const [field, path] = this.wrapJsonFieldAndPath(column)

    return 'json_overlaps(' + field + ', ' + value + path + ')'
  }

  /**
   * Prepare a JSON column being updated using the JSON_SET function.
   *
   * @param  string  $key
   * @param  mixed  $value
   * @return string
   */
  protected compileJsonUpdateColumn (key: string, value: unknown): string {
    if (typeof value === 'boolean') {
      value = value ? 'true' : 'false'
    } else if (Array.isArray(value)) {
      value = 'cast(? as json)'
    } else {
      value = this.parameter(value)
    }

    const [field, path] = this.wrapJsonFieldAndPath(key)

    return `${field} = json_set(${field}${path}, ${value})`
  }

  /**
   * Compile a group limit clause for MySQL < 8.0.
   *
   * Derived from https://softonsofa.com/tweaking-eloquent-relations-how-to-get-n-related-models-per-parent/.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @return string
   */
  protected compileLegacyGroupLimit (query: Builder): string {
    let limit = parseInt(String(query.groupLimitProperty.value), 10)
    const offset = query.offsetProperty

    if (offset !== undefined) {
      limit += parseInt(String(offset), 10)
      query.offsetProperty = undefined
    }

    let column = query.groupLimitProperty.column.split('.').pop() ?? ''
    column = this.wrap(column)

    let partition = ', @lihtne_row := if(@lihtne_group = ' + column + ', @lihtne_row + 1, 1) as `lihtne_row`'
    partition += `, @lihtne_group := ${column}`

    const orders = query.orders

    orders.unshift({
      column: query.groupLimitProperty.column,
      direction: 'asc'
    })

    query.orders = orders

    const components = this.compileComponents(query)

    let sql = this.concatenate(components)

    const from = '(select @lihtne_row := 0, @lihtne_group := 0) as `lihtne_vars`, (' + sql + ') as `lihtne_table`'

    sql = 'select `lihtne_table`.*' + partition + ' from ' + from + ' having `lihtne_row` <= ' + limit

    if (offset !== undefined) {
      sql += ' and `lihtne_row` > ' + offset
    }

    return sql + ' order by `lihtne_row`'
  }

  /**
   * Compile the lock into SQL.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  bool|string  $value
   * @return string
   */
  protected override compileLock (
    // @ts-expect-error - query is not used

    query: Builder,
    value: boolean | string
  ): string {
    if (typeof value === 'string') {
      return value
    }

    return value ? 'for update' : 'lock in share mode'
  }

  /**
   * Compile the columns for an update statement.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $values
   * @return string
   */
  protected override compileUpdateColumns (
    // @ts-expect-error - values is not used

    query: Builder,
    values: Record<string, unknown>
  ): string {
    return new Collection<string, unknown>(values)
      .map((value, key) => {
        if (this.isJsonSelector(String(key))) {
          return this.compileJsonUpdateColumn(String(key), value)
        }

        return this.wrap(key) + ' = ' + this.parameter(value)
      })
      .implode(', ')
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
  protected override compileUpdateWithoutJoins (
    query: Builder,
    table: string,
    columns: string,
    where: string
  ): string {
    let sql = super.compileUpdateWithoutJoins(query, table, columns, where)

    if (query.orders.length > 0) {
      sql += ' ' + this.compileOrders(query, query.orders)
    }

    if (query.limitProperty) {
      sql += ' ' + this.compileLimit(query, query.limitProperty)
    }

    return sql
  }

  /**
   * {@inheritdoc}
   */
  protected override supportsStraightJoins (): boolean {
    return true
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
   * Wrap the given JSON selector for boolean values.
   *
   * @param  string  $value
   * @return string
   */
  protected override wrapJsonBooleanSelector (value: string): string {
    const [field, path] = this.wrapJsonFieldAndPath(value)

    return `json_extract(${field}${path})`
  }

  /**
   * Wrap the given JSON selector.
   *
   * @param  string  $value
   * @return string
   */
  protected override wrapJsonSelector (value: string): string {
    const [field, path] = this.wrapJsonFieldAndPath(value)

    return `json_unquote(json_extract(${field}${path}))`
  }
}

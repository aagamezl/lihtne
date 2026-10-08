import { isPlainObject } from '@devnetic/utils'

import type { Bindings, BindingValues, Builder, WhereClause } from '../Builder'
import type { Expression } from '../Expression'
import type { JoinLateralClause } from '../JoinLateralClause'

import { Collection } from '../../../Collections'
import { isNumeric, Str } from '../../../Support'
import { Grammar } from './Grammar'

export class MySqlGrammar extends Grammar {
  /**
   * The grammar specific operators.
   *
   * @var string[]
   */
  protected override operators = ['sounds like']

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
   * Compile an "upsert" statement into SQL.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $values
   * @param  array  $uniqueBy
   * @param  array  $update
   * @return string
   */
  public override compileUpsert (query: Builder, values: unknown[], uniqueBy: string | string[], update: unknown[]): string {
    const useUpsertAlias = query.getConnection().getConfig('use_upsert_alias')

    let sql = this.compileInsert(query, values)

    if (useUpsertAlias) {
      sql += ' as lihtne_upsert_alias'
    }

    sql += ' on duplicate key update '

    const columns = (new Collection(update)).map((value: unknown, key: string | Expression) => {
      if (!isNumeric(key)) {
        return this.wrap(key) + ' = ' + this.parameter(value)
      }

      return useUpsertAlias
        ? this.wrap(value) + ' = ' + this.wrap('lihtne_upsert_alias') + '.' + this.wrap(value)
        : this.wrap(value) + ' = values(' + this.wrap(value) + ')'
    }).implode(', ')

    return sql + columns
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
   * Compile an insert statement into SQL.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $values
   * @return string
   */
  public override compileInsert (query: Builder, values: unknown[]): string {
    if (values.length === 0) {
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
   * Compile the columns for an update statement.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $values
   * @return string
   */
  protected override compileUpdateColumns (
    query: Builder,
    values: Record<string, unknown>
  ): string {
    return new Collection(values)
      .map((value, key) => {
        if (this.isJsonSelector(String(key))) {
          return this.compileJsonUpdateColumn(String(key), value)
        }

        return this.wrap(key) + ' = ' + this.parameter(value)
      })
      .implode(', ')
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
    const newValues = (new Collection(values))
      .reject((
        value: unknown,
        column: string | Expression
      ): boolean => this.isJsonSelector(column) && typeof value === 'boolean')
      .map((value: unknown) => (Array.isArray(value) || isPlainObject(value)) ? JSON.stringify(value) : value)
      .all()

    return super.prepareBindingsForUpdate(bindings, newValues)
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
  protected override compileDeleteWithJoins (query: Builder, table: string, where: string): string {
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
   * Compile an update statement without joins into SQL.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  string  $table
   * @param  string  $columns
   * @param  string  $where
   * @return string
   */
  protected override compileUpdateWithoutJoins (query: Builder, table: string, columns: string, where: string): string {
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
   * Wrap the given JSON selector.
   *
   * @param  string  $value
   * @return string
   */
  protected override wrapJsonSelector (value: string): string {
    const [field, path] = this.wrapJsonFieldAndPath(value)

    return `json_unquote(json_extract(${field}${path}))`
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
   * Wrap a single string in keyword identifiers.
   *
   * @param  {string}  value
   * @return {string}
   */
  public override wrapValue (value: string): string {
    return value === '*' ? value : '`' + value.replace('`', '``') + '`'
  }
}

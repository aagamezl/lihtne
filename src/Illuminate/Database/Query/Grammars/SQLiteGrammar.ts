import type { Bindings, BindingValues, Builder } from '../Builder'

import { Arr, Collection } from '../../../Collections'
import { last } from '../../../Collections/helpers'
import { getValue, isNumeric, Str } from '../../../Support'
import { Grammar } from './Grammar'

export class SQLiteGrammar extends Grammar {
  /**
   * All of the available clause operators.
   *
   * @var string[]
   */
  protected override operators: string[] = [
    '=',
    '<',
    '>',
    '<=',
    '>=',
    '<>',
    '!=',
    'like',
    'not like',
    'ilike',
    '&',
    '|',
    '<<',
    '>>'
  ]

  /**
   * Compile the lock into SQL.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  bool|string  $value
   * @return string
   */
  protected override compileLock (
    // @ts-expect-error expected error; query is not used in this method
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- required by the base compileLock signature
    query: Builder,
    // @ts-expect-error expected error; value is not used in this method
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- required by the base compileLock signature
    value: boolean | string
  ): string {
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
  protected override whereNullSafeEquals (
    _query: Builder,
    where: WhereClause
  ): string {
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
  public prepareWhereLikeBinding (
    value: string,
    caseSensitive: boolean
  ): string {
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
  protected override whereLike (query: Builder, where: WhereClause): string {
    if (where.caseSensitive === false) {
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
    * Compile an "upsert" statement into SQL.
    *
    * @param  \Illuminate\Database\Query\Builder  $query
    * @param  array  $values
    * @param  array  $uniqueBy
    * @param  array  $update
    * @return string
    */
  public override compileUpsert (query: Builder, values: unknown[], uniqueBy: string | string[], update: unknown[]): string {
    let sql = this.compileInsert(query, values)

    sql += ' on conflict (' + this.columnize(uniqueBy) + ') do update set '

    const columns = (new Collection(update)).map((value: unknown, key: PropertyKey) => {
      return isNumeric(key)
        ? this.wrap(value) + ' = ' + this.wrapValue('excluded') + '.' + this.wrap(value)
        : this.wrap(key) + ' = ' + this.parameter(value)
    }).implode(', ')

    return sql + columns
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
      'insert or ignore',
      this.compileInsertUsing(query, columns, sql)
    )
  }

  /**
   * Compile an update statement with joins or limit into SQL.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $values
   * @return string
   */
  protected compileUpdateWithJoinsOrLimit (query: Builder, values: unknown[]): string {
    const table = this.wrapTable(query.fromProperty)
    const columns = this.compileUpdateColumns(query, values)
    const alias = query.fromProperty.split(' as ').pop() ?? ''
    const selectSql = this.compileSelect(query.select(`${alias}.rowid`))

    return `update ${table} set ${columns} where ${this.wrap('rowid')} in (${selectSql})`
  }

  /**
   * Compile the columns for an update statement.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $values
   * @return string
   */

  // @ts-expect-error expected error; query is not used in this method
  protected override compileUpdateColumns (query: Builder, values: unknown[]): string {
    const jsonGroups = this.groupJsonColumnsForUpdate(values)

    return (new Collection(values))
      .reject((value: unknown, key: PropertyKey) => this.isJsonSelector(key))
      .merge(jsonGroups)
      .map((value: unknown, key: PropertyKey) => {
        const column = last(key.split('.'))

        value = jsonGroups[key] ? this.compileJsonPatch(column, value) : this.parameter(value)

        return this.wrap(column) + ' = ' + value
      })
      .implode(', ')
  }

  /**
   * Compile a "JSON" patch statement into SQL.
   *
   * @param  string  $column
   * @param  mixed  $value
   * @return string
   */
  protected compileJsonPatch (column: string, value: unknown): string {
    return `json_patch(ifnull(${this.wrap(column)}, json('{}')), json(${this.parameter(value)}))`
  }

  /**
   * Compile an update statement into SQL.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $values
   * @return string
   */
  public override compileUpdate (
    query: Builder,
    values: Record<string, unknown>
  ): string {
    if (query.joins.length > 0 || query.limitProperty > 0) {
      return this.compileUpdateWithJoinsOrLimit(query, values)
    }

    return super.compileUpdate(query, values)
  }

  /**
   * Prepare the bindings for an update statement.
   *
   * @param  array  $bindings
   * @param  array  $values
   * @return array
   */
  public override prepareBindingsForUpdate (bindings: Bindings, values: BindingValues): BindingValues {
    const groups = this.groupJsonColumnsForUpdate(values)

    const preparedValues = (new Collection(values))
      .reject((value: unknown, key: PropertyKey) => this.isJsonSelector(key))
      .merge(groups)
      .map((value: unknown) => Array.isArray(value) ? JSON.stringify(value) : value)
      .all()

    const cleanBindings = Arr.except(bindings, 'select')

    // const flattenedValues = Arr.flatten(preparedValues.map((value: unknown) => getValue(value)))
    const flattenedValues = Arr.flatten(
      (Array.isArray(preparedValues) ? preparedValues : Object.values(preparedValues)).map((value) =>
        getValue(value))
    )

    return [
      ...flattenedValues,
      ...Arr.flatten(cleanBindings)
    ]
  }

  /**
   * Group the nested JSON columns.
   *
   * @param  array  $values
   * @return array
   */
  protected groupJsonColumnsForUpdate (values: unknown[]): Record<string, unknown> {
    const groups: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(values)) {
      if (this.isJsonSelector(key)) {
        Arr.set(groups, Str.after(key, '.').replace('->', '.'), value)
      }
    }

    return groups
  }

  /**
   * Compile an insert or ignore statement with a returning clause into SQL.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $values
   * @param  array  $returning
   * @param  array|null  $uniqueBy
   * @return string
   */
  public override compileInsertOrIgnoreReturning (
    query: Builder,
    values: unknown[],
    returning: string[],
    uniqueBy?: string[] | undefined
  ): string {
    const insert = this.compileInsert(query, values)

    if (uniqueBy === undefined) {
      return `${insert} on conflict do nothing returning ${this.columnize(returning)}`
    }

    return `${insert} on conflict (${this.columnize(uniqueBy)}) do nothing returning ${this.columnize(returning)}`
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
      'insert or ignore',
      this.compileInsert(query, values)
    )
  }

  /**
   * Compile a date based where clause.
   *
   * @param  string  $type
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $where
   * @return string
   */
  protected override dateBasedWhere (
    type: string,
    _query: Builder,
    where: WhereClause
  ): string {
    const value = this.parameter(where.value)

    return `strftime('${type}', ${this.wrap(where.column ?? '')}) ${where.operator} cast(${value} as text)`
  }
}

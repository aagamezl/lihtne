import { isNumeric, isTruthy } from '@devnetic/utils'
import { isNil, isPlainObject } from 'es-toolkit'

import type { BindingValues, Builder, Having, WhereClause } from '../Builder'
import type { Expression } from '../Expression'
import type { JoinClause } from '../JoinClause'
import type { JoinLateralClause } from '../JoinLateralClause'

import { Arr } from '../../../Collections'
import { Collection } from '../../../Collections/Collection'
import { last } from '../../../Collections/helpers'
import { Str } from '../../../Support'
import { Grammar } from './Grammar'

export class PostgresGrammar extends Grammar {
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
    '<>',
    '!=',
    'like',
    'not like',
    'between',
    'ilike',
    'not ilike',
    '~',
    '&',
    '|',
    '#',
    '<<',
    '>>',
    '<<=',
    '>>=',
    '&&',
    '@>',
    '<@',
    '?',
    '?|',
    '?&',
    '||',
    '-',
    '@?',
    '@@',
    '#-',
    'is distinct from',
    'is not distinct from'
  ]

  /**
   * The Postgres grammar specific custom operators.
   *
   * @var array
   */
  protected static customOperators = []

  /**
   * The grammar specific bitwise operators.
   *
   * @var array
   */
  protected override bitwiseOperators = [
    '~',
    '&',
    '|',
    '#',
    '<<',
    '>>',
    '<<=',
    '>>='
  ]

  /**
   * Indicates if the cascade option should be used when truncating.
   *
   * @var bool
   */
  protected static cascadeTruncate = true

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
    // If the query is actually performing an aggregating select, we will let that
    // compiler handle the building of the select clauses, as it will need some
    // more syntax that is best handled by that function to keep things neat.
    if (!isNil(query.aggregateProperty)) {
      return ''
    }

    let select: string

    if (Array.isArray(query.distinctProperty)) {
      select =
        'select distinct on (' + this.columnize(query.distinctProperty) + ') '
    } else if (isTruthy(query.distinctProperty)) {
      select = 'select distinct '
    } else {
      select = 'select '
    }

    return select + this.columnize(columns)
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

    return (
      'extract(' +
      type +
      ' from ' +
      this.wrap(where.column ?? '') +
      ') ' +
      where.operator +
      ' ' +
      value
    )
  }

  /**
   * Compile a "where date" clause.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $where
   * @return string
   */
  protected override whereDate (_query: Builder, where: WhereClause): string {
    let column = this.wrap(where.column ?? '')
    const value = this.parameter(where.value)

    if (this.isJsonSelector(column)) {
      column = '(' + column + ')'
    }

    return column + '::date ' + where.operator + ' ' + value
  }

  /**
   * Compile an update statement into SQL.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $values
   * @return string
   */
  public override compileUpdate (query: Builder, values: Record<string, unknown>): string {
    if (query.joins.length > 0 || query.limitProperty > 0) {
      return this.compileUpdateWithJoinsOrLimit(query, values)
    }

    return super.compileUpdate(query, values)
  }

  /**
   * Compile an update statement with joins or limit into SQL.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $values
   * @return string
   */
  protected compileUpdateWithJoinsOrLimit (query: Builder, values: Record<string, unknown>): string {
    const table = this.wrapTable(query.fromProperty)

    const columns = this.compileUpdateColumns(query, values)

    const alias = last(query.fromProperty.split(/\s+as\s+/i))

    const selectSql = this.compileSelect(query.select(`${alias}.ctid`))

    return `update ${table} set ${columns} where ${this.wrap('ctid')} in (${selectSql})`
  }

  /**
   * Compile a delete statement into SQL.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @return string
   */
  public override compileDelete (query: Builder): string {
    if (query.joins.length > 0 || query.limitProperty > 0) {
      return this.compileDeleteWithJoinsOrLimit(query)
    }

    return super.compileDelete(query)
  }

  /**
   * Compile a delete statement with joins or limit into SQL.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @return string
   */
  protected compileDeleteWithJoinsOrLimit (query: Builder): string {
    const table = this.wrapTable(query.fromProperty)

    const alias = last(query.fromProperty.split(/\s+as\s+/i))

    const selectSql = this.compileSelect(query.select(`${alias}.ctid`))

    return `delete from ${table} where ${this.wrap('ctid')} in (${selectSql})`
  }

  /**
   * Substitute the given bindings into the given raw SQL query.
   *
   * @param  string  $sql
   * @param  array  $bindings
   * @return string
   */
  public override substituteBindingsIntoRawSql (sql: string, bindings: BindingValues): string {
    let query = super.substituteBindingsIntoRawSql(sql, bindings)

    for (const operator of this.operators) {
      if (!operator.includes('?')) {
        continue
      }

      query = query.replace(query.replace('?', '??', operator), operator)
    }

    return query
  }

  /**
   * Compile the columns for an update statement.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $values
   * @return string
   */
  protected override compileUpdateColumns (query: Builder, values: Record<string, unknown>): string {
    return (new Collection(values)).map((value, key) => {
      const column = last(key.split('.'))

      if (this.isJsonSelector(key)) {
        return this.compileJsonUpdateColumn(column, value)
      }

      return this.wrap(column) + ' = ' + this.parameter(value)
    }).implode(', ')
  }

  /**
   * Prepares a JSON column being updated using the JSONB_SET function.
   *
   * @param  string  $key
   * @param  mixed  $value
   * @return string
   */
  protected compileJsonUpdateColumn (key: string, value: unknown): string {
    const segments = key.split('->')

    const field = this.wrap(segments.shift() ?? '')

    const path = "'{" + this.wrapJsonPathAttributes(segments, '"').join(',') + "}'"

    return `${field} = jsonb_set(${field}::jsonb, ${path}, ${this.parameter(value)})`
  }

  /**
   * Compile a "where time" clause.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $where
   * @return string
   */
  protected override whereTime (_query: Builder, where: WhereClause): string {
    let column = this.wrap(where.column ?? '')
    const value = this.parameter(where.value)

    if (this.isJsonSelector(column)) {
      column = '(' + column + ')'
    }

    return column + '::time ' + where.operator + ' ' + value
  }

  /**
   * Compile an insert and get ID statement into SQL.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $values
   * @param  string|null  $sequence
   * @return string
   */
  public override compileInsertGetId (
    query: Builder,
    values: BindingValues,
    sequence: string | undefined = undefined
  ): string {
    return this.compileInsert(query, values) + ' returning ' + this.wrap(sequence ?? 'id')
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
    uniqueBy: string[] | undefined
  ): string {
    const insert = this.compileInsert(query, values)

    if (uniqueBy === undefined) {
      return `${insert} on conflict do nothing returning ${this.columnize(returning)}`
    }

    return `${insert} on conflict (${this.columnize(uniqueBy)}) do nothing returning ${this.columnize(returning)}`
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
    return (
      this.compileInsertUsing(query, columns, sql) + ' on conflict do nothing'
    )
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
    return this.compileInsert(query, values) + ' on conflict do nothing'
  }

  /**
   * Get an array of valid full text languages.
   *
   * @return array
   */
  protected validFullTextLanguages (): string[] {
    return [
      'simple',
      'arabic',
      'danish',
      'dutch',
      'english',
      'finnish',
      'french',
      'german',
      'hungarian',
      'indonesian',
      'irish',
      'italian',
      'lithuanian',
      'nepali',
      'norwegian',
      'portuguese',
      'romanian',
      'russian',
      'spanish',
      'swedish',
      'tamil',
      'turkish'
    ]
  }

  /**
   * Compile a "where fulltext" clause.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $where
   * @return string
   */
  public override whereFulltext (_query: Builder, where: WhereClause): string {
    let language = where.options?.language ?? 'english'

    if (!this.validFullTextLanguages().includes(language)) {
      language = 'english'
    }

    const isVector = where.options?.vector ?? false

    const columns = new Collection(where.columns ?? [])
      .map((column: Expression | string) =>
        isVector
          ? this.wrap(column)
          : `to_tsvector('${language}', ${this.wrap(column)})`)
      .implode(' || ')

    let mode = 'plainto_tsquery'

    if (where.options?.mode === 'phrase') {
      mode = 'phraseto_tsquery'
    }

    if (where.options?.mode === 'websearch') {
      mode = 'websearch_to_tsquery'
    }

    if (where.options?.mode === 'raw') {
      mode = 'to_tsquery'
    }

    return `(${columns}) @@ ${mode}('${language}', ${this.parameter(where.value)})`
  }

  /**
   * Compile a basic where clause.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $where
   * @return string
   */
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

    return value ? 'for update' : 'for share'
  }

  protected override whereBasic (query: Builder, where: WhereClause): string {
    if (where.operator?.toLowerCase().includes('like')) {
      return `${this.wrap(where.column ?? '')}::text ${where.operator} ${this.parameter(where.value)}`
    }

    return super.whereBasic(query, where)
  }

  protected override whereBitwise (query: Builder, where: WhereClause): string {
    const value = this.parameter(where.value)
    const operator = where.operator?.replace('?', '??') ?? ''

    return `(${this.wrap(where.column ?? '')} ${operator} ${value})::bool`
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
    where.operator += where.caseSensitive ? 'like' : 'ilike'

    return this.whereBasic(query, where)
  }

  /**
   * Wrap the given JSON selector.
   *
   * @param  string  $value
   * @return string
   */
  protected override wrapJsonSelector (value: string): string {
    const path = value.split('->')

    const field = this.wrapSegments(path.shift()?.split('.') ?? [])

    const wrappedPath = this.wrapJsonPathAttributes(path)

    const attribute = wrappedPath.pop()

    if (wrappedPath.length > 0) {
      return field + '->' + wrappedPath.join('->') + '->>' + attribute
    }

    return field + '->>' + attribute
  }

  /**
   * Compile the additional where clauses for updates with joins.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @return string
   */
  protected compileUpdateWheres (query: Builder): string {
    const baseWheres = this.compileWheres(query)

    if (!query.joins.length) {
      return baseWheres
    }

    // Once we compile the join constraints, we will either use them as the where
    // clause or append them to the existing base where clauses. If we need to
    // strip the leading boolean we will do so when using as the only where.
    const joinWheres = this.compileUpdateJoinWheres(query)

    if (baseWheres.trim() === '') {
      return 'where ' + this.removeLeadingBoolean(joinWheres)
    }

    return baseWheres + ' ' + joinWheres
  }

  /**
   * Compile an update from statement into SQL.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $values
   * @return string
   */
  public compileUpdateFrom (query: Builder, values: Record<string, unknown>): string {
    const table = this.wrapTable(query.fromProperty)

    // Each one of the columns in the update statements needs to be wrapped in the
    // keyword identifiers, also a place-holder needs to be created for each of
    // the values in the list of bindings so we can make the sets statements.
    const columns = this.compileUpdateColumns(query, values)

    let from = ''

    if (query.joins.length > 0) {
      // When using Postgres, updates with joins list the joined tables in the from
      // clause, which is different than other systems like MySQL. Here, we will
      // compile out the tables that are joined and add them to a from clause.
      const froms = (new Collection(query.joins))
        .map((join: JoinClause) => this.wrapTable(join.table))
        .all()

      if (froms.length > 0) {
        from = ' from ' + froms.join(', ')
      }
    }

    const where = this.compileUpdateWheres(query)

    return String(`update ${table} set ${columns}${from} ${where}`).trim()
  }

  public prepareBindingsForUpdateFrom (bindings: Bindings, values: Record<string, unknown>): BindingValues {
    const preparedValues = (new Collection(values))
      .map((value: unknown, column: string) => {
        return Array.isArray(value) || (this.isJsonSelector(column) && !this.isExpression(value))
          ? JSON.stringify(value)
          : value
      })
      .all()

    const bindingsWithoutWhere = Arr.except(bindings, ['select', 'where'])

    return [
      ...(Array.isArray(preparedValues) ? preparedValues : Object.values(preparedValues)),
      ...bindings.where,
      ...Arr.flatten(bindingsWithoutWhere)
    ]
  }

  /**
     * Prepare the bindings for an update statement.
     *
     * @param  array  $bindings
     * @param  array  $values
     * @return array
     */
  public override prepareBindingsForUpdate (bindings: Bindings, values: BindingValues): BindingValues {
    const preparedValues = (new Collection(values)).map((value: unknown, column: string) => {
      return Array.isArray(value) ||
        isPlainObject(value) ||
        (this.isJsonSelector(column) && !this.isExpression(value))
        ? JSON.stringify(value)
        : value
    }).all()

    const cleanBindings = Arr.except(bindings, 'select')

    const updateBindings = Array.isArray(preparedValues)
      ? preparedValues
      : Object.values(preparedValues)

    return [
      ...updateBindings,
      ...Arr.flatten(cleanBindings)
    ]
  }

  /**
   * Compile the "join" clause where clauses for an update.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @return string
   */
  protected compileUpdateJoinWheres (query: Builder): string {
    const joinWheres: string[] = []

    // Here we will just loop through all of the join constraints and compile them
    // all out then implode them. This should give us "where" like syntax after
    // everything has been built and then we will join it to the real wheres.
    for (const join of query.joins) {
      for (const where of join.wheres) {
        const method = `where${where.type}`

        joinWheres.push(where.boolean + ' ' + this[method](query, where))
      }
    }

    return joinWheres.join(' ')
  }

  /**
   * Wrap the given JSON selector for boolean values.
   *
   * @param  string  $value
   * @return string
   */
  protected override wrapJsonBooleanSelector (value: string): string {
    const selector = this.wrapJsonSelector(value).replace('->>', '->')

    return '(' + selector + ')::jsonb'
  }

  /**
   * Wrap the given JSON boolean value.
   *
   * @param  string  $value
   * @return string
   */
  protected override wrapJsonBooleanValue (value: string): string {
    return "'" + value + "'::jsonb"
  }

  /**
   * Compile a "JSON contains" statement into SQL.
   *
   * @param  string  $column
   * @param  string  $value
   * @return string
   */
  /**
   * Compile a vector distance expression for the given column.
   *
   * @param  string  $column
   * @return string
   */
  public override compileVectorDistanceExpression (column: string | Expression): string {
    return `(${this.wrap(column)} <=> ?)`
  }

  /**
   * Determine if the grammar supports vector distance queries.
   *
   * @return bool
   */
  public override supportsVectorDistance (): boolean {
    return true
  }

  protected override compileJsonContains (column: string, value: string): string {
    const wrappedColumn = this.wrap(column).replaceAll('->>', '->')

    return '(' + wrappedColumn + ')::jsonb @> ' + value
  }

  /**
   * Compile a "JSON contains key" statement into SQL.
   *
   * @param  string  $column
   * @return string
   */
  protected override compileJsonContainsKey (column: string): string {
    const segments = column.split('->')
    const lastSegment = segments.pop() ?? ''

    let index: number | undefined

    if (/^-?\d+$/.test(lastSegment)) {
      index = Number(lastSegment)
    } else {
      const match = lastSegment.match(/\[(-?[0-9]+)\]$/)

      if (match !== null) {
        segments.push(Str.beforeLast(lastSegment, match[0]))
        index = Number(match[1])
      }
    }

    const wrapped = this.wrap(segments.join('->')).replaceAll('->>', '->')

    if (index !== undefined) {
      const length = index < 0 ? Math.abs(index) : index + 1

      return (
        'case when jsonb_typeof((' +
        wrapped +
        ")::jsonb) = 'array' then jsonb_array_length((" +
        wrapped +
        ')::jsonb) >= ' +
        String(length) +
        ' else false end'
      )
    }

    const key = "'" + lastSegment.replaceAll("'", "''") + "'"

    return 'coalesce((' + wrapped + ')::jsonb ?? ' + key + ', false)'
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
    const wrappedColumn = this.wrap(column).replaceAll('->>', '->')

    return `jsonb_array_length((${wrappedColumn})::jsonb) ${operator} ${value}`
  }

  /**
   * Wrap the attributes of the given JSON path.
   *
   * @param  array  $path
   * @return array
   */
  protected wrapJsonPathAttributes (
    path: string[],
    quote: string = "'"
  ): string[] {
    return path
      .flatMap((attribute) => this.parseJsonPathArrayKeys(attribute))
      .map((attribute) => {
        if (/^\d+$/.test(attribute)) {
          return attribute
        }

        let quoted = attribute.replace("'", "''")

        if (quote !== "'") {
          quoted = quoted.replaceAll(quote, quote + quote)
        }

        return quote + quoted + quote
      })
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
    return String(`${join.type} join lateral ${expression} on true`).trim()
  }

  /**
   * Parse the given JSON path attribute for array keys.
   *
   * @param  string  $attribute
   * @return array
   */
  protected parseJsonPathArrayKeys (attribute: string): string[] {
    const parts = attribute.match(/(\[[^\]]+\])+$/)
    const matched = parts?.[0]

    if (matched === undefined) {
      return [attribute]
    }

    const key = Str.beforeLast(attribute, matched)
    const keys = [...matched.matchAll(/\[([^\]]+)\]/g)].map((match) => match[1] ?? '')

    return [key, ...keys].filter((part) => part !== '')
  }

  protected override compileHaving (having: Having): string {
    if (having.type === 'Bitwise') {
      return this.compileHavingBitwise(having)
    }

    return super.compileHaving(having)
  }

  protected compileHavingBitwise (having: Having): string {
    const column = this.wrap((having.column ?? '') as string)
    const parameter = this.parameter(having.value ?? '')

    return `(${column} ${having.operator} ${parameter})::bool`
  }
}

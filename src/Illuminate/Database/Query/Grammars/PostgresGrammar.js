import { isNumeric, isPlainObject, isTruthy } from '@devnetic/utils'

import Arr from '../../../Collections/Arr.js'
import Grammar from './Grammar.js'
import Str from '../../../Support/Str.js'
import { collect } from '../../../Collections/helpers.js'
import { pregMatchAll } from '../../../Support/helpers.js'

export default class PostgresGrammar extends Grammar {
  /**
   * The grammar specific bitwise operators.
   *
   * @type {string[]}
   */
  bitwiseOperators = [
    '~', '&', '|', '#', '<<', '>>', '<<=', '>>='
  ]

  /**
   * All of the available clause operators.
   *
   * @type {string[]}
   */
  operators = [
    '=', '<', '>', '<=', '>=', '<>', '!=',
    'like', 'not like', 'between', 'ilike', 'not ilike',
    '~', '&', '|', '#', '<<', '>>', '<<=', '>>=',
    '&&', '@>', '<@', '?', '?|', '?&', '||', '-', '@?', '@@', '#-',
    'is distinct from', 'is not distinct from'
  ]

  /**
   * Compile the "select *" portion of the query.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {Array}  columns
   * @return {string|undefined}
   */
  compileColumns (query, columns) {
    // If the query is actually performing an aggregating select, we will let that
    // compiler handle the building of the select clauses, as it will need some
    // more syntax that is best handled by that to keep things neat.
    if (query.aggregateProperty !== undefined) {
      return
    }

    let select

    if (Array.isArray(query.distinctProperty)) {
      select = 'select distinct on (' + this.columnize(query.distinctProperty) + ') '
    } else if (isTruthy(query.distinctProperty)) {
      select = 'select distinct '
    } else {
      select = 'select '
    }

    return select + this.columnize(columns)
  }

  /**
     * Compile a delete statement into SQL.
     *
     * @param  {import('./../Builder.js').default}  query
     * @return {string}
     */
  compileDelete (query) {
    if (query.joins.length > 0 || query.limitProperty !== undefined) {
      return this.compileDeleteWithJoinsOrLimit(query)
    }

    return super.compileDelete(query)
  }

  /**
     * Compile a delete statement with joins or limit into SQL.
     *
     * @param  {import('./../Builder.js').default}  query
     * @return {string}
     */
  compileDeleteWithJoinsOrLimit (query) {
    const table = this.wrapTable(query.fromProperty)

    const alias = query.fromProperty.split(/\s+as\s+/i).pop()

    const selectSql = this.compileSelect(query.select(alias + '.ctid'))

    return `delete from ${table} where ${this.wrap('ctid')} in (${selectSql})`
  }

  /**
     * Compile a single having clause.
     *
     * @param  {import('./../Builder.js').Having}  having
     * @return {string}
     */
  compileHaving (having) {
    if (having.type === 'Bitwise') {
      return this.compileHavingBitwise(having)
    }

    return super.compileHaving(having)
  }

  /**
     * Compile a having clause involving a bitwise operator.
     *
     * @param  {import('./../Builder.js').Having}  having
     * @return {string}
     */
  compileHavingBitwise (having) {
    const column = this.wrap(having.column)

    const parameter = this.parameter(having.value)

    return '(' + column + ' ' + having.operator + ' ' + parameter + ')::bool'
  }

  /**
   * Compile an insert and get ID statement into SQL.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {Record<string, unknown>}  values
   * @param  {string}  sequence
   * @return {string}
   */
  compileInsertGetId (query, values, sequence) {
    return this.compileInsert(query, values) + ' returning ' + this.wrap(sequence ?? 'id')
  }

  /**
   * Compile an insert ignore statement into SQL.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {Object.<string, any>}  values
   * @return {string}
   */
  compileInsertOrIgnore (query, values) {
    return this.compileInsert(query, values) + ' on conflict do nothing'
  }

  /**
   * Compile an insert ignore statement using a subquery into SQL.
   *
   * @param  {import('../../Query/Builder.js').default}  $query
   * @param  {any[]}  columns
   * @param  {string}  sql
   * @return {string}
   */
  compileInsertOrIgnoreUsing (query, columns, sql) {
    return this.compileInsertUsing(query, columns, sql) + ' on conflict do nothing'
  }

  /**
   * Compile a "lateral join" clause.
   *
   * @param  {import('../../Query/JoinLateralClause.js').default}  join
   * @param  {string}  expression
   * @return {string}
   */
  compileJoinLateral (join, expression) {
    return `${join.type} join lateral ${expression} on true`.trim()
  }

  /**
     * Compile a "JSON contains" statement into SQL.
     *
     * @param  {string}  column
     * @param  {string}  value
     * @return {string}
     */
  compileJsonContains (column, value) {
    column = this.wrap(column).replace('->>', '->')

    return '(' + column + ')::jsonb @> ' + value
  }

  /**
     * Compile a "JSON contains key" statement into SQL.
     *
     * @param  {string}  column
     * @return {string}
     */
  compileJsonContainsKey (column) {
    const segments = column.split('->')

    const lastSegment = segments.pop()

    let i

    if (Number.isInteger(parseInt(lastSegment))) {
      i = lastSegment
    } else {
      const matches = lastSegment.match(/\[(-?[0-9]+)\]$/)

      if (matches) {
        segments.push(Str.beforeLast(lastSegment, matches[0]))
        i = parseInt(matches[1])
      }
    }

    column = this.wrap(segments.join('->')).replace('->>', '->')

    if (i !== undefined) {
      return `case when jsonb_typeof((${column})::jsonb) = 'array'` +
        ` then jsonb_array_length((${column})::jsonb) >= ${i < 0 ? Math.abs(i) : i + 1} else false end`
    }

    const key = "'" + lastSegment.replace("'", "''") + "'"

    return 'coalesce((' + column + ')::jsonb ?? ' + key + ', false)'
  }

  /**
     * Compile a "JSON length" statement into SQL.
     *
     * @param  {string}  column
     * @param  {string}  operator
     * @param  {string}  value
     * @return {string}
     */
  compileJsonLength (column, operator, value) {
    column = this.wrap(column).replace('->>', '->')

    return 'jsonb_array_length((' + column + ')::jsonb) ' + operator + ' ' + value
  }

  /**
     * Prepares a JSON column being updated using the JSONB_SET function.
     *
     * @param  {string}  key
     * @param  {unknown}  value
     * @return {string}
     */
  compileJsonUpdateColumn (key, value) {
    const segments = key.split('->')

    const field = this.wrap(segments.shift())

    const path = "'{" + this.wrapJsonPathAttributes(segments, '"').join(',') + "}'"

    return `${field} = jsonb_set(${field}::jsonb, ${path}, ${this.parameter(value)})`
  }

  /**
   * Compile the lock into SQL.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {boolean|string}  value
   * @return {string}
   */
  compileLock (query, value) {
    if (typeof value !== 'string') {
      return value ? 'for update' : 'for share'
    }

    return value
  }

  /**
   * Compile a truncate table statement into SQL.
   *
   * @param  {import('./../Builder.js').default}  query
   * @return {Record<string, unknown[]>}
   */
  compileTruncate (query) {
    return { ['truncate ' + this.wrapTable(query.fromProperty) + ' restart identity cascade']: [] }
  }

  /**
   * Compile an update statement into SQL.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {Record<string, unknown>}  values
   * @return {string}
   */
  compileUpdate (query, values) {
    if (query.joins.length > 0 || query.limitProperty !== undefined) {
      return this.compileUpdateWithJoinsOrLimit(query, values)
    }

    return super.compileUpdate(query, values)
  }

  /**
   * Compile the columns for an update statement.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {Record<string, unknown>}  values
   * @return {string}
   */
  compileUpdateColumns (query, values) {
    return collect(values).map((value, key) => {
      const column = key.split('.').pop()

      if (this.isJsonSelector(key)) {
        return this.compileJsonUpdateColumn(column, value)
      }

      return this.wrap(column) + ' = ' + this.parameter(value)
    }).implode(', ')
  }

  /**
   * Compile an update from statement into SQL.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {Record<string, unknown>}  values
   * @return {string}
   */
  compileUpdateFrom (query, values) {
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
      const froms = collect(query.joins).map((join) => {
        return this.wrapTable(join.table)
      }).all()

      if (froms.length > 0) {
        from = ' from ' + froms.join(', ')
      }
    }

    const where = this.compileUpdateWheres(query)

    return `update ${table} set ${columns}${from} ${where}`.trim()
  }

  /**
   * Compile the "join" clause where clauses for an update.
   *
   * @param  {import('./../Builder.js').default}  query
   * @return {string}
   */
  compileUpdateJoinWheres (query) {
    const joinWheres = []

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
   * Compile the additional where clauses for updates with joins.
   *
   * @param  {import('./../Builder.js').default}  query
   * @return {string}
   */
  compileUpdateWheres (query) {
    const baseWheres = this.compileWheres(query)

    if (query.joins.length === 0) {
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
   * Compile an update statement with joins or limit into SQL.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {Record<string, unknown>}  values
   * @return {string}
   */
  compileUpdateWithJoinsOrLimit (query, values) {
    const table = this.wrapTable(query.fromProperty)

    const columns = this.compileUpdateColumns(query, values)

    const alias = query.fromProperty.split(/\s+as\s+/i).pop()

    const selectSql = this.compileSelect(query.select(alias + '.ctid'))

    return `update ${table} set ${columns} where ${this.wrap('ctid')} in (${selectSql})`
  }

  /**
   * Compile an "upsert" statement into SQL.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {Record<string, unknown>}  values
   * @param  {array}  uniqueBy
   * @param  {array}  update
   * @return {string}
   */
  compileUpsert (query, values, uniqueBy, update) {
    let sql = this.compileInsert(query, values)

    sql += ' on conflict (' + this.columnize(uniqueBy) + ') do update set '

    const columns = collect(update).map((value, key) => {
      return isNumeric(key)
        ? this.wrap(value) + ' = ' + this.wrapValue('excluded') + '.' + this.wrap(value)
        : this.wrap(key) + ' = ' + this.parameter(value)
    }).implode(', ')

    return sql + columns
  }

  /**
   * Compile a date based where clause.
   *
   * @param  {string}  type
   * @param  {import('./../Builder.js').default}  query
   * @param  {import('./../Builder.js').Where}  where
   * @return {string}
   */
  dateBasedWhere (type, query, where) {
    const value = this.parameter(where.value)

    return 'extract(' + type + ' from ' + this.wrap(where.column) + ') ' + where.operator + ' ' + value
  }

  /**
   * Parse the given JSON path attribute for array keys.
   *
   * @param  {string}  attribute
   * @return {array}
   */
  parseJsonPathArrayKeys (attribute) {
    const parts = attribute.match(/(\[[^\]]+\])+$/)

    if (parts) {
      const key = Str.beforeLast(attribute, parts[0])

      // const keys = Array.from(parts[0].matchAll(/\[([^\]]+)\]/g))
      // const keys = parts[0].match(/\[([^\]]+)\]/)
      const keys = pregMatchAll(parts[0], /\[([^\]]+)\]/g)

      return collect([key])
        .merge(keys[1])
        .diff('')
        .values()
        .all()
    }

    return [attribute]
  }

  /**
   * Prepare the bindings for an update statement.
   *
   * @param  {array}  bindings
   * @param  {Record<string, unknown>}  values
   * @return {array}
   */
  prepareBindingsForUpdate (bindings, values) {
    values = collect(values).map((value, column) => {
      return (Array.isArray(value) || isPlainObject(value)) || (this.isJsonSelector(column) && !this.isExpression(value))
        ? JSON.stringify(value)
        : value
    }).all()

    const cleanBindings = Arr.except(bindings, 'select')

    return [
      ...Object.values(values),
      ...Object.values(Arr.flatten(cleanBindings))
    ].flat()
  }

  /**
   * Prepare the bindings for an update statement.
   *
   * @param  {import('./../Builder.js').Bindings}  bindings
   * @param  {Record<string, unknown>}  values
   * @return {array}
   */
  prepareBindingsForUpdateFrom (bindings, values) {
    values = collect(values).map((value, column) => {
      return (Array.isArray(value) || isPlainObject(value)) || (this.isJsonSelector(column) && !this.isExpression(value))
        ? JSON.stringify(value)
        : value
    }).all()

    const bindingsWithoutWhere = Arr.except(bindings, ['select', 'where'])

    // return array_values(
    //   array_merge(values, bindings.where, Arr.flatten(bindingsWithoutWhere))
    // )
    return [
      ...Object.values(values),
      bindings.where,
      ...Object.values(Arr.flatten(bindingsWithoutWhere))
    ].flat()
  }

  /**
   * Substitute the given bindings into the given raw SQL query.
   *
   * @param  {string}  sql
   * @param  {import('./../Builder.js').Bindings}  bindings
   * @return {string}
   */
  substituteBindingsIntoRawSql (sql, bindings) {
    let query = super.substituteBindingsIntoRawSql(sql, bindings)

    for (const operator of this.operators) {
      if (operator.includes('?')) {
        query = query.replace(operator.replace('?', '??'), operator)
      }
    }

    return query
  }

  /**
   * Get an array of valid full text languages.
   *
   * @return {string[]}
   */
  validFullTextLanguages () {
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
   * {@inheritdoc}
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {import('./../Builder.js').Where}  where
   * @return {string}
   */
  whereBasic (query, where) {
    if (where.operator.toLowerCase().includes('like')) {
      return `${this.wrap(where.column)}::text ${where.operator} ${this.parameter(where.value)}`
    }

    return super.whereBasic(query, where)
  }

  /**
   * Compile a bitwise operator where clause.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {import('./../Builder.js').Where}  where
   * @return {string}
   */
  whereBitwise (query, where) {
    const value = this.parameter(where.value)

    const operator = where.operator.replace('?', '??')

    return '(' + this.wrap(where.column) + ' ' + operator + ' ' + value + ')::bool'
  }

  /**
   * Compile a "where date" clause.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {import('./../Builder.js').Where}  where
   * @return {string}
   */
  whereDate (query, where) {
    const value = this.parameter(where.value)

    return this.wrap(where.column) + '::date ' + where.operator + ' ' + value
  }

  /**
   * Compile a "where fulltext" clause.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {import('./../Builder.js').Where}  where
   * @return {string}
   */
  whereFulltext (query, where) {
    let language = where.options.language ?? 'english'

    if (!this.validFullTextLanguages().includes(language)) {
      language = 'english'
    }

    const columns = collect(where.columns).map((column) => {
      return `to_tsvector('${language}', ${this.wrap(column)})`
    }).implode(' || ')

    let mode = 'plainto_tsquery'

    if ((where.options.mode ?? []) === 'phrase') {
      mode = 'phraseto_tsquery'
    }

    if ((where.options.mode ?? []) === 'websearch') {
      mode = 'websearch_to_tsquery'
    }

    return `(${columns}) @@ ${mode}('${language}', ${this.parameter(where.value)})`
  }

  /**
   * Compile a "where time" clause.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {Where}  where
   * @return {string}
   */
  whereTime (query, where) {
    const value = this.parameter(where.value)

    return this.wrap(where.column) + '::time ' + where.operator + ' ' + value
  }

  /**
   * Wrap the given JSON selector for boolean values.
   *
   * @param  {string}  value
   * @return {string}
   */
  wrapJsonBooleanSelector (value) {
    const selector = this.wrapJsonSelector(value).replace('->>', '->')

    return '(' + selector + ')::jsonb'
  }

  /**
     * Wrap the given JSON boolean value.
     *
     * @param  {string}  value
     * @return {string}
     */
  wrapJsonBooleanValue (value) {
    return "'" + value + "'::jsonb"
  }

  /**
   * Wrap the attributes of the given JSON path.
   *
   * @param  {array}  path
   * @return {unknown[]}
   */
  wrapJsonPathAttributes (path) {
    const quote = arguments.length === 2 ? arguments[1] : "'"

    return collect(path).map((attribute) => {
      return this.parseJsonPathArrayKeys(attribute)
    }).collapse().map((attribute) => {
      return isNumeric(attribute)
        ? parseInt(attribute, 10)
        : quote + attribute + quote
    }).all()
  }

  /**
   * Wrap the given JSON selector.
   *
   * @param  {string}  value
   * @return {string}
   */
  wrapJsonSelector (value) {
    const path = value.split('->')

    const field = this.wrapSegments(path.shift().split('.'))

    const wrappedPath = this.wrapJsonPathAttributes(path)

    const attribute = wrappedPath.pop()

    if (wrappedPath.length > 0) {
      return field + '->' + wrappedPath.join('->') + '->>' + attribute
    }

    return field + '->>' + attribute
  }
}

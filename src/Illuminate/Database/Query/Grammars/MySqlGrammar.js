import { isBoolean, isNumeric, isPlainObject, isTruthy } from '@devnetic/utils'

import Grammar from './Grammar.js'
import { collect } from '../../../Collections/helpers.js'

export default class MySqlGrammar extends Grammar {
  constructor () {
    super(...arguments)

    /**
     * The grammar specific operators.
     *
     * @type {string[]}
     */
    this.operators = ['sounds like']
  }

  /**
   * Compile a delete query that does not use joins.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {string}  table
   * @param  {string}  where
   * @return {string}
   */
  compileDeleteWithoutJoins (query, table, where) {
    let sql = super.compileDeleteWithoutJoins(query, table, where)

    // When using MySQL, delete statements may contain order by statements and limits
    // so we will compile both of those here. Once we have finished compiling this
    // we will return the completed SQL statement so it will be executed for us.
    if (query.orders.length > 0) {
      sql += ' ' + this.compileOrders(query, query.orders)
    }

    if (query.limitProperty !== undefined) {
      sql += ' ' + this.compileLimit(query, query.limitProperty)
    }

    return sql
  }

  /**
   * Compile the index hints for the query.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {import('./../IndexHint.js').default}  indexHint
   * @return {string}
   */
  compileIndexHint (query, indexHint) {
    switch (indexHint.type) {
      case 'hint':
        return `use index (${indexHint.index})`
      case 'force':
        return `force index (${indexHint.index})`
      default:
        return `ignore index (${indexHint.index})`
    };
  }

  /**
   * Compile an insert statement into SQL.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {unknown[]}  values
   * @returns {string}
   */
  compileInsert (query, values) {
    if (values.length === 0) {
      values = [[]]
    }

    return super.compileInsert(query, values)
  }

  /**
   * Compile an insert ignore statement into SQL.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {Object.<string, any>}  values
   * @return {string}
   */
  compileInsertOrIgnore (query, values) {
    return this.compileInsert(query, values).replace('insert', 'insert ignore')
  }

  /**
   * Compile a "JSON contains" statement into SQL.
   *
   * @param  {string}  column
   * @param  {string}  value
   * @return {string}
   */
  compileJsonContains (column, value) {
    const [field, path] = this.wrapJsonFieldAndPath(column)

    return 'json_contains(' + field + ', ' + value + path + ')'
  }

  /**
   * Compile a "JSON contains key" statement into SQL.
   *
   * @param  {string}  column
   * @return {string}
   */
  compileJsonContainsKey (column) {
    const [field, path] = this.wrapJsonFieldAndPath(column)

    return 'ifnull(json_contains_path(' + field + ', \'one\'' + path + '), 0)'
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
    const [field, path] = this.wrapJsonFieldAndPath(column)

    return 'json_length(' + field + path + ') ' + operator + ' ' + value
  }

  /**
   * Prepare a JSON column being updated using the JSON_SET function.
   *
   * @param  {string}  key
   * @param  {unknown}  value
   * @return {string}
   */
  compileJsonUpdateColumn (key, value) {
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
   * Compile a "JSON value cast" statement into SQL.
   *
   * @param  {string}  value
   * @return {string}
   */
  compileJsonValueCast (value) {
    return 'cast(' + value + ' as json)'
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
      return value ? 'for update' : 'lock in share mode'
    }

    return value
  }

  /**
   * Compile the random statement into SQL.
   *
   * @param  {string|number}  seed
   * @return {string}
   */
  compileRandom (seed) {
    return 'RAND(' + seed + ')'
  }

  /**
   * Compile the columns for an update statement.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {unknown[]}  values //TODO: verify this type
   * @return {string}
   */
  compileUpdateColumns (query, values) {
    return collect(values).map((value, key) => {
      if (this.isJsonSelector(key)) {
        return this.compileJsonUpdateColumn(key, value)
      }

      return this.wrap(key) + ' = ' + this.parameter(value)
    }).implode(', ')
  }

  /**
   * Compile an update statement without joins into SQL.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {string}  table
   * @param  {string}  columns
   * @param  {string}  where
   * @return {string}
   */
  compileUpdateWithoutJoins (query, table, columns, where) {
    let sql = super.compileUpdateWithoutJoins(query, table, columns, where)

    if (query.orders.length > 0) {
      sql += ' ' + this.compileOrders(query, query.orders)
    }

    if (query.limitProperty !== undefined) {
      sql += ' ' + this.compileLimit(query, query.limitProperty)
    }

    return sql
  }

  /**
   * Compile an "upsert" statement into SQL.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {unknown[]}  values //TODO: verify this type
   * @param  {unknown[]}  uniqueBy //TODO: verify this type
   * @param  {unknown[]}  update //TODO: verify this type
   * @return {string}
   */
  compileUpsert (query, values, uniqueBy, update) {
    const useUpsertAlias = query.connection.getConfig('use_upsert_alias')

    let sql = this.compileInsert(query, values)

    if (useUpsertAlias) {
      sql += ' as lihtne_upsert_alias'
    }

    sql += ' on duplicate key update '

    const columns = collect(update).map((value, key) => {
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
   * Prepare the bindings for an update statement.
   *
   * Booleans, integers, and doubles are inserted into JSON updates as raw values.
   *
   * @param  {unknown[]}  bindings //TODO: verify this type
   * @param  {unknown[]}  values //TODO: verify this type
   * @return {unknown[]} //TODO: verify this type
   */
  prepareBindingsForUpdate (bindings, values) {
    // values = collect(values).reject(([column, value]) => {
    values = collect(values).reject((value, column) => {
      return this.isJsonSelector(column) && isBoolean(value)
    }).map((value) => {
      return (Array.isArray(value) || isPlainObject(value)) ? JSON.stringify(value) : value
    }).all()

    return super.prepareBindingsForUpdate(bindings, values)
  }

  /**
   * Compile a "where fulltext" clause.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {import('./../Builder.js').Where}  where
   * @return {string}
   */
  whereFulltext (query, where) {
    const columns = this.columnize(where.columns)

    const value = this.parameter(where.value)

    const mode = (where.options.mode ?? []) === 'boolean'
      ? ' in boolean mode'
      : ' in natural language mode'

    const expanded = (isTruthy(where.options.expanded) ?? {}) && (where.options.mode ?? {}) !== 'boolean'
      ? ' with query expansion'
      : ''

    return `match (${columns}) against (` + value + `${mode}${expanded})`
  }

  /**
   * Add a "where not null" clause to the query.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {import('./../Builder.js').Where}  where
   * @return {string}
   */
  whereNotNull (query, where) {
    const columnValue = this.getValue(where.column)

    if (this.isJsonSelector(columnValue)) {
      const [field, path] = this.wrapJsonFieldAndPath(columnValue)

      return '(json_extract(' + field + path + ') is not null AND json_type(json_extract(' + field + path + ')) != \'NULL\')'
    }

    return super.whereNotNull(query, where)
  }

  /**
   * Add a "where null" clause to the query.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {import('./../Builder.js').Where}  where
   * @return {string}
   */
  whereNull (query, where) {
    const columnValue = this.getValue(where.column)

    if (this.isJsonSelector(columnValue)) {
      const [field, path] = this.wrapJsonFieldAndPath(columnValue)

      return '(json_extract(' + field + path + ') is null OR json_type(json_extract(' + field + path + ')) = \'NULL\')'
    }

    return super.whereNull(query, where)
  }

  /**
   * Wrap the given JSON selector for boolean values.
   *
   * @param  {string}  value
   * @return {string}
   */
  wrapJsonBooleanSelector (value) {
    const [field, path] = this.wrapJsonFieldAndPath(value)

    return `json_extract(${field}${path})`
  }

  /**
   * Wrap the given JSON selector.
   *
   * @param  {string}  value
   * @return {string}
   */
  wrapJsonSelector (value) {
    const [field, path] = this.wrapJsonFieldAndPath(value)

    return 'json_unquote(json_extract(' + field + path + '))'
  }

  /**
   * Wrap a single string in keyword identifiers.
   *
   * @param  {string}  value
   * @return {string}
   */
  wrapValue (value) {
    return value === '*' ? value : '`' + value.replace('`', '``') + '`'
  }
}

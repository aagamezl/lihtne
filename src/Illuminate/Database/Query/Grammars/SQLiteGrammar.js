import { isNumeric, isPlainObject } from '@devnetic/utils'

import Grammar from './Grammar.js'
import { collect } from '../../../Collections/helpers.js'
import Arr from '../../../Collections/Arr.js'
import Str from '../../../Support/Str.js'

export default class SQLiteGrammar extends Grammar {
  constructor () {
    super(...arguments)

    /**
     * All of the available clause operators.
     *
     * @type {string[]}
     */
    this.operators = [
      '=', '<', '>', '<=', '>=', '<>', '!=',
      'like', 'not like', 'ilike',
      '&', '|', '<<', '>>'
    ]
  }

  /**
   * Compile a delete statement into SQL.
   *
   * @param  {import('./../Builder.js').default} query
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
   * @param  {import('./../Builder.js').default} query
   * @return {string}
   */
  compileDeleteWithJoinsOrLimit (query) {
    const table = this.wrapTable(query.fromProperty)

    const alias = query.fromProperty.split(/\s+as\s+/i).pop()

    const selectSql = this.compileSelect(query.select(`${alias}.rowid`))

    return `delete from ${table} where ${this.wrap('rowid')} in (${selectSql})`
  }

  /**
   * Compile a delete statement with joins or limit into SQL.
   *
   * @param  {import('./../Builder.js').default} query
   * @param  {import('./../IndexHint.js').default}  indexHint
   * @return {string}
   */
  compileIndexHint (query, indexHint) {
    return indexHint.type === 'force'
      ? `indexed by ${indexHint.index}`
      : ''
  }

  /**
   * Compile an insert ignore statement into SQL.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {Object.<string, unknown>}  values
   * @return {string}
   */
  compileInsertOrIgnore (query, values) {
    return this.compileInsert(query, values).replace('insert', 'insert or ignore')
  }

  /**
   * Compile a "JSON contains" statement into SQL.
   *
   * @param  {string}  column
   * @param  {unknown}  value
   * @return {string}
   */
  compileJsonContains (column, value) {
    const [field, path] = this.wrapJsonFieldAndPath(column)

    return 'exists (select 1 from json_each(' + field + path + ') where ' + this.wrap('json_each.value') + ' is ' + value + ')'
  }

  /**
   * Compile a "JSON contains key" statement into SQL.
   *
   * @param  {string}  column
   * @return {string}
   */
  compileJsonContainsKey (column) {
    const [field, path] = this.wrapJsonFieldAndPath(column)

    return 'json_type(' + field + path + ') is not null'
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

    return 'json_array_length(' + field + path + ') ' + operator + ' ' + value
  }

  /**
   * Compile a "JSON" patch statement into SQL.
   *
   * @param  {string}  column
   * @param  {unknown}  value
   * @return {string}
   */
  compileJsonPatch (column, value) {
    return `json_patch(ifnull(${this.wrap(column)}, json('{}')), json(${this.parameter(value)}))`
  }

  /**
   * Compile the lock into SQL.
   *
   * @param {mport('./../Builder.js').default query
   * @param {boolean|string} value
   * @return {string}
   */
  compileLock (query, value) {
    return ''
  }

  /**
   * Compile a truncate table statement into SQL.
   *
   * @param  {import('./../Builder.js').default}  $query
   * @return {Object.<string, unknown>}
   */
  compileTruncate (query) {
    return {
      'delete from sqlite_sequence where name = ?': [query.fromProperty],
      ['delete from ' + this.wrapTable(query.fromProperty)]: []
    }
  }

  /**
   * Compile an update statement into SQL.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {Object.<string, unknown>}  values
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
   * @param  {Object.<string, unknown>}  values
   * @return {string}
   */
  compileUpdateColumns (query, values) {
    const jsonGroups = this.groupJsonColumnsForUpdate(values)

    return collect(values).reject(([key, value]) => {
      return this.isJsonSelector(key)
    }).merge(jsonGroups).map((value, key) => {
      const column = key.split('.').pop()

      value = jsonGroups[key] !== undefined ? this.compileJsonPatch(column, value) : this.parameter(value)

      return this.wrap(column) + ' = ' + value
    }).implode(', ')
  }

  /**
   * Compile an update statement with joins or limit into SQL.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {Object.<string, unknown>}  values
   * @return {string}
   */
  compileUpdateWithJoinsOrLimit (query, values) {
    const table = this.wrapTable(query.fromProperty)

    const columns = this.compileUpdateColumns(query, values)

    const alias = query.fromProperty.split(/\s+as\s+/i).pop()

    const selectSql = this.compileSelect(query.select(`${alias}.rowid`))

    return `update ${table} set ${columns} where ${this.wrap('rowid')} in (${selectSql})`
  }

  /**
   * Compile an "upsert" statement into SQL.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {Object.<string, unknown>}  values
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
   * @param  {{import('./../Builder.js').default}}  query
   * @param  {import('./../Builder.js').Where}  where
   * @return {string}
   */
  dateBasedWhere (type, query, where) {
    const value = this.parameter(where.value)

    return `strftime('${type}', ${this.wrap(where.column)}) ${where.operator} cast(${value} as text)`
  }

  /**
   * Group the nested JSON columns.
   *
   * @param  {Object.<string, unknown>}  values
   * @return {Object.<string, unknown>}
   */
  groupJsonColumnsForUpdate (values) {
    const groups = []

    for (const [key, value] of Object.entries(values)) {
      if (this.isJsonSelector(key)) {
        Arr.set(groups, Str.after(key, '.').replace('->', '.'), value)
      }
    }

    return groups
  }

  /**
     * Prepare the binding for a "JSON contains" statement.
     *
     * @param  {unknown}  binding
     * @return {unknown}
     */
  prepareBindingForJsonContains (binding) {
    return binding
  }

  /**
     * Prepare the bindings for an update statement.
     *
     * @param  {array}  bindings
     * @param  {Object.<string, unknown>}  values
     * @return {array}
     */
  prepareBindingsForUpdate (bindings, values) {
    const groups = this.groupJsonColumnsForUpdate(values)

    values = collect(values).reject(([value, key]) => {
      return this.isJsonSelector(key)
    }).merge(groups).map((value) => {
      return (Array.isArray(value) || isPlainObject(value)) ? JSON.stringify(value) : value
    }).all()

    const cleanBindings = Arr.except(bindings, 'select')

    return [
      ...Object.values(values),
      ...Object.values(Arr.flatten(cleanBindings))
    ].flat()
  }

  /**
   * Compile a "where date" clause.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {import('./../Builder.js').Where}  where
   * @return {string}
   */
  whereDate (query, where) {
    return this.dateBasedWhere('%Y-%m-%d', query, where)
  }

  /**
   * Compile a "where day" clause.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {import('./../Builder.js').Where}  where
   * @return {string}
   */
  whereDay (query, where) {
    return this.dateBasedWhere('%d', query, where)
  }

  /**
   * Compile a "where month" clause.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {import('./../Builder.js').Where}  where
   * @return {string}
   */
  whereMonth (query, where) {
    return this.dateBasedWhere('%m', query, where)
  }

  /**
   * Compile a "where time" clause.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {import('./../Builder.js').Where}  where
   * @return {string}
   */
  whereTime (query, where) {
    return this.dateBasedWhere('%H:%M:%S', query, where)
  }

  /**
   * Compile a "where year" clause.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {import('./../Builder.js').Where}  where
   * @return {string}
   */
  whereYear (query, where) {
    return this.dateBasedWhere('%Y', query, where)
  }

  /**
     * Wrap the given JSON selector.
     *
     * @param  {string}  value
     * @return {string}
     */
  wrapJsonSelector (value) {
    const [field, path] = this.wrapJsonFieldAndPath(value)

    return 'json_extract(' + field + path + ')'
  }

  /**
   * Wrap a union subquery in parentheses.
   *
   * @param  {string}  sql
   * @return {string}
   */
  wrapUnion (sql) {
    return `select * from (${sql})`
  }
}

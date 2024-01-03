import { isNumeric } from '@devnetic/utils'

import Grammar from './Grammar.js'
import { collect } from '../../../Collections/helpers.js'

export default class SQLiteGrammar extends Grammar {
  constructor () {
    super(...arguments)

    /**
     * All of the available clause operators.
     *
     * @var string[]
     */
    this.operators = [
      '=', '<', '>', '<=', '>=', '<>', '!=',
      'like', 'not like', 'ilike',
      '&', '|', '<<', '>>'
    ]
  }

  /**
   * Compile an insert ignore statement into SQL.
   *
   * @param  {\Illuminate\Database\Query\Builder}  query
   * @param  {Record<string, any>}  values
   * @return {string}
   */
  compileInsertOrIgnore (query, values) {
    return this.compileInsert(query, values).replace('insert', 'insert or ignore')
  }

  /**
   * Compile an "upsert" statement into SQL.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {array}  values
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
   * @param  {{\Illuminate\Database\Query\Builder}}  query
   * @param  {Where}  where
   * @return {string}
   */
  dateBasedWhere (type, query, where) {
    const value = this.parameter(where.value)
    return `strftime('${type}', ${this.wrap(where.column)}) ${where.operator} cast(${value} as text)`
  }

  /**
   * Compile a "where date" clause.
   *
   * @param  {\Illuminate\Database\Query\Builder}  query
   * @param  {Where}  where
   * @return {string}
   */
  whereDate (query, where) {
    return this.dateBasedWhere('%Y-%m-%d', query, where)
  }

  /**
   * Compile a "where day" clause.
   *
   * @param  {\Illuminate\Database\Query\Builder}  query
   * @param  {Where}  where
   * @return {string}
   */
  whereDay (query, where) {
    return this.dateBasedWhere('%d', query, where)
  }

  /**
   * Compile a "where month" clause.
   *
   * @param  {\Illuminate\Database\Query\Builder}  query
   * @param  {Where}  where
   * @return {string}
   */
  whereMonth (query, where) {
    return this.dateBasedWhere('%m', query, where)
  }

  /**
   * Compile a "where time" clause.
   *
   * @param  {\Illuminate\Database\Query\Builder}  query
   * @param  {Where}  where
   * @return {string}
   */
  whereTime (query, where) {
    return this.dateBasedWhere('%H:%M:%S', query, where)
  }

  /**
   * Compile a "where year" clause.
   *
   * @param  {\Illuminate\Database\Query\Builder}  query
   * @param  {Where}  where
   * @return {string}
   */
  whereYear (query, where) {
    return this.dateBasedWhere('%Y', query, where)
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

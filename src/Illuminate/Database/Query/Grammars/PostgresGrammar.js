import { isNumeric, isTruthy } from '@devnetic/utils'

import Grammar from './Grammar.js'
import { collect } from '../../../Collections/helpers.js'

export default class PostgresGrammar extends Grammar {
  constructor () {
    super(...arguments)

    /**
     * All of the available clause operators.
     *
     * @var string[]
     */
    this.operators = [
      '=', '<', '>', '<=', '>=', '<>', '!=',
      'like', 'not like', 'between', 'ilike', 'not ilike',
      '~', '&', '|', '#', '<<', '>>', '<<=', '>>=',
      '&&', '@>', '<@', '?', '?|', '?&', '||', '-', '@?', '@@', '#-',
      'is distinct from', 'is not distinct from'
    ]
  }

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
   * Compile an insert and get ID statement into SQL.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {array}  values
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
   * @param  {Record<string, any>}  values
   * @return {string}
   */
  compileInsertOrIgnore (query, values) {
    return this.compileInsert(query, values) + ' on conflict do nothing'
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
   * @param  {import('./../Builder.js').default}  query
   * @param  {where}  where
   * @return {string}
   */
  dateBasedWhere (type, query, where) {
    const value = this.parameter(where.value)

    return 'extract(' + type + ' from ' + this.wrap(where.column) + ') ' + where.operator + ' ' + value
  }

  /**
   * {@inheritdoc}
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {Where}  where
   * @return {string}
   */
  whereBasic (query, where) {
    if (where.operator.toLowerCase().includes('like')) {
      return `${this.wrap(where.column)}::text ${where.operator} ${this.parameter(where.value)}`
    }

    return super.whereBasic(query, where)
  }

  /**
   * Compile a "where date" clause.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {Where}  where
   * @return {string}
   */
  whereDate (query, where) {
    const value = this.parameter(where.value)

    return this.wrap(where.column) + '::date ' + where.operator + ' ' + value
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
   * Compile a "where fulltext" clause.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {Where}  where
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
}

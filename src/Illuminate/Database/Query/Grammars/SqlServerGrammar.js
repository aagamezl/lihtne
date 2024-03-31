import { isNil, isNumeric, isString, isTruthy } from '@devnetic/utils'

import Arr from '../../../Collections/Arr.js'
import Grammar from './Grammar.js'
import Str from '../../../Support/Str.js'
import { clone } from '../../../Support/helpers.js'
import { collect, last, reset } from '../../../Collections/helpers.js'

export default class SqlServerGrammar extends Grammar {
  constructor () {
    super(...arguments)

    /**
     * All of the available clause operators.
     *
     * @member {string[]}
     */
    this.operators = [
      '=', '<', '>', '<=', '>=', '!<', '!>', '<>', '!=',
      'like', 'not like', 'ilike',
      '&', '&=', '|', '|=', '^', '^='
    ]

    /**
     * The components that make up a select clause.
     *
     * @type {import('./Grammar.js').SelectComponent[]}
     */
    this.selectComponents = [
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
  }

  /**
   * Compile the "select *" portion of the query.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {string[]}  columns
   * @return {string|undefined}
   */
  compileColumns (query, columns) {
    if (!isNil(query.aggregateProperty)) {
      return
    }

    let select = isTruthy(query.distinctProperty) ? 'select distinct ' : 'select '
    const limit = (query.limitProperty || 0) | 0
    const offset = (query.offsetProperty || 0) | 0

    // If there is a limit on the query, but not an offset, we will add the top
    // clause to the query, which serves as a "limit" type clause within the
    // SQL Server system similar to the limit keywords available in MySQL.
    if (isNumeric(query.limitProperty) && limit > 0 && offset <= 0) {
      select += `top ${limit} `
    }

    return select + this.columnize(columns)
  }

  /**
   * Compile a delete statement without joins into SQL.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {string}  table
   * @param  {string}  where
   * @return {string}
   */
  compileDeleteWithoutJoins (query, table, where) {
    const sql = super.compileDeleteWithoutJoins(query, table, where)

    return query.limitProperty !== undefined && query.limitProperty > 0 && (!query.offsetProperty || query.offsetProperty <= 0)
      ? Str.replaceFirst('delete', 'delete top (' + query.limitProperty + ')', sql)
      : sql
  }

  /**
   * Compile an exists statement into SQL.
   *
   * @param  {import('./../Builder.js').default} query
   * @return {string}
   */
  compileExists (query) {
    const existsQuery = clone(query)

    existsQuery.columns = []

    return this.compileSelect(existsQuery.selectRaw('1 [exists]').limit(1))
  }

  /**
   * Compile the "from" portion of the query.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {string}  table
   * @return {string}
   */
  compileFrom (query, table) {
    const from = super.compileFrom(query, table)

    if (isString(query.lockProperty)) {
      return from + ' ' + query.lockProperty
    }

    if (query.lockProperty !== undefined) {
      return from + ' with(rowlock,' + (query.lockProperty ? 'updlock,' : '') + 'holdlock)'
    }

    return from
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

    return '(' + column + ' ' + having.operator + ' ' + parameter + ') != 0'
  }

  /**
 * Compile the index hints for the query.
 *
 * @param  {import('./../Builder.js').default}  query
 * @param  {import('./../IndexHint.js').default}  indexHint
 * @return {string}
 */
  compileIndexHint (query, indexHint) {
    return indexHint.type === 'force'
      ? `with (index(${indexHint.index}))`
      : ''
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

    return value + ' in (select [value] from openjson(' + field + path + '))'
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

    let key
    const regex = /\[([0-9]+)\]$/
    const matches = regex.exec(lastSegment)
    if (matches !== null) {
      segments.push(Str.beforeLast(lastSegment, matches[0]))

      key = matches[1]
    } else {
      key = "'" + lastSegment.replace(/'/g, "''") + "'"
    }

    const [field, path] = this.wrapJsonFieldAndPath(segments.join('->'))

    return key + ' in (select [key] from openjson(' + field + path + '))'
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

    return '(select count(*) from openjson(' + field + path + ')) ' + operator + ' ' + value
  }

  /**
   * Compile a "JSON value cast" statement into SQL.
   *
   * @param  {string}  value
   * @return {string}
   */
  compileJsonValueCast (value) {
    return 'json_query(' + value + ')'
  }

  /**
   * Compile the "limit" portions of the query.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {number}  limit
   * @return {string}
   */
  compileLimit (query, limit) {
    limit = limit | 0

    if (limit && query.offsetProperty > 0) {
      return `fetch next ${limit} rows only`
    }

    return ''
  }

  /**
   * Compile the lock into SQL.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {boolean|string}  value
  * @return {string}
   */
  compileLock (query, value) {
    return ''
  }

  /**
   * Compile the "offset" portions of the query.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {number}  offset
   * @return {string}
   */
  compileOffset (query, offset) {
    offset = offset | 0

    if (offset) {
      return `offset ${offset} rows`
    }

    return ''
  }

  /**
   * Compile the over statement for a table expression.
   *
   * @param  {string}  orderings
   * @return {string}
   */
  compileOver (orderings) {
    return `, row_number() over (${orderings}) as row_num`
  }

  /**
   * Compile the random statement into SQL.
   *
   * @param  {string|int}  seed
   * @return {string}
   */
  compileRandom (seed) {
    return 'NEWID()'
  }

  /**
   * Compile the SQL statement to define a savepoint.
   *
   * @param  {string}  name
   * @return {string}
   */
  compileSavepoint (name) {
    return 'SAVE TRANSACTION ' + name
  }

  /**
   * Compile the SQL statement to execute a savepoint rollback.
   *
   * @param  {string}  name
   * @return {string}
   */
  compileSavepointRollBack (name) {
    return 'ROLLBACK TRANSACTION ' + name
  }

  /**
   * Compile a select query into SQL.
   *
   * @param  {import('./../Builder.js').default}  query
   * @return {string}
   */
  compileSelect (query) {
    // An order by clause is required for SQL Server offset to function...
    if (query.offsetProperty && query.orders.length === 0) {
      query.orders.push({ sql: '(SELECT 0)' })
    }

    return super.compileSelect(query)
  }

  /**
   * Compile an update statement with joins into SQL.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {string}  table
   * @param  {string}  columns
   * @param  {string}  where
   * @return {string}
   */
  compileUpdateWithJoins (query, table, columns, where) {
    const alias = last(table.split(' as '))

    const joins = this.compileJoins(query, query.joins)

    return `update ${alias} set ${columns} from ${table} ${joins} ${where}`
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
    const columns = this.columnize(Object.keys(reset(values)))

    let sql = 'merge ' + this.wrapTable(query.fromProperty) + ' '

    const parameters = collect(values).map((record) => {
      return '(' + this.parameterize(record) + ')'
    }).implode(', ')

    sql += 'using (values ' + parameters + ') ' + this.wrapTable('lihtne_source') + ' (' + columns + ') '

    const on = collect(uniqueBy).map((column) => {
      return this.wrap('lihtne_source.' + column) + ' = ' + this.wrap(query.fromProperty + '.' + column)
    }).implode(' and ')

    sql += 'on ' + on + ' '

    if (update) {
      update = collect(update).map((value, key) => {
        return isNumeric(key)
          ? this.wrap(value) + ' = ' + this.wrap('lihtne_source.' + value)
          : this.wrap(key) + ' = ' + this.parameter(value)
      }).implode(', ')

      sql += 'when matched then update set ' + update + ' '
    }

    sql += 'when not matched then insert (' + columns + ') values (' + columns + ');'

    return sql
  }

  /**
   * Get the format for database stored dates.
   *
   * @return {string}
   */
  getDateFormat () {
    return 'Y-m-d H:i:s.v'
  }

  /**
   * Prepare the binding for a "JSON contains" statement.
   *
   * @param  {unknown}  binding
   * @return {string}
   */
  prepareBindingForJsonContains (binding) {
    return typeof binding === 'boolean' ? JSON.stringify(binding) : binding
  }

  /**
   * Prepare the bindings for an update statement.
   *
   * @param  {array}  bindings
   * @param  {array}  values
   * @return {array}
   */
  prepareBindingsForUpdate (bindings, values) {
    const cleanBindings = Arr.except(bindings, 'select')

    return [
      ...Object.values(values),
      ...Object.values(Arr.flatten(cleanBindings))
    ].flat()
  }

  /**
   * {@inheritdoc}
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {import('./../Builder.js').Where}  where
   * @return {string}
   */
  whereBitwise (query, where) {
    const value = this.parameter(where.value)

    const operator = where.operator.replaceAll('?', '??')

    return '(' + this.wrap(where.column) + ' ' + operator + ' ' + value + ') != 0'
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

    return 'cast(' + this.wrap(where.column) + ' as date) ' + where.operator + ' ' + value
  }

  /**
   * Compile a "where date" clause.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {import('./../Builder.js').Where}  where
   * @return {string}
   */
  whereTime (query, where) {
    const value = this.parameter(where.value)

    return 'cast(' + this.wrap(where.column) + ' as time) ' + where.operator + ' ' + value
  }

  /**
   * Wrap the given JSON boolean value.
   *
   * @param  {string}  value
   * @return {string}
   */
  wrapJsonBooleanValue (value) {
    return "'" + value + "'"
  }

  /**
   * Wrap the given JSON selector.
   *
   * @param  {string}  value
   * @return {string}
   */
  wrapJsonSelector (value) {
    const [field, path] = this.wrapJsonFieldAndPath(value)

    return 'json_value(' + field + path + ')'
  }

  /**
   * Wrap a table in keyword identifiers.
   *
   * @param  {import('./../Expression.js').default|string}  table
   * @return {string}
   */
  wrapTable (table) {
    if (!this.isExpression(table)) {
      return this.wrapTableValuedFunction(super.wrapTable(table))
    }

    return this.getValue(table)
  }

  /**
   * Wrap a table in keyword identifiers.
   *
   * @param  {string}  table
   * @return {string}
   */
  wrapTableValuedFunction (table) {
    const matches = [...table.matchAll(/^(.+?)(\(.*?\))]/g)]

    if (matches.length > 0) {
      table = matches[0][1] + ']' + matches[0][2]
    }

    return table
  }

  /**
   * Wrap a union subquery in parentheses.
   *
   * @param  {string}  sql
   * @return {string}
   */
  wrapUnion (sql) {
    return 'select * from (' + sql + ') as ' + this.wrapTable('temp_table')
  }

  /**
   * Wrap a single string in keyword identifiers.
   *
   * @param  {string}  value
   * @return {string}
   */
  wrapValue (value) {
    return value === '*' ? value : '[' + value.replace(']', ']]') + ']'
  }
}

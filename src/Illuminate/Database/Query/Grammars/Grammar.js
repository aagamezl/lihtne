import { capitalize, isTruthy } from '@devnetic/utils'

import Arr from '../../../Collections/Arr.js'
import BaseGrammar from '../../Grammar.js'
import CompilesJsonPaths from '../../Concerns/CompilesJsonPaths.js'
import { JoinClause, JoinLateralClause } from './../internal.js'
import { mix } from '../../../Support/Traits/use.js'
import { collect, end, head, last, reset, value as getValue } from '../../../Collections/helpers.js'
import Expression from './../Expression.js'

/**
 * Array representing the select components for a query.
 *
 * @typedef {Object} SelectComponent
 * @property {string} name - The name of the select component.
 * @property {string} property - The property associated with the select component.
 */

/**
 * @typedef {Object} Aggregate
 * @property {Array<string | import('./../Expression.js').default>} columns
 * @property {string} function
 */

/** @typedef {import('./../Builder.js').default} Builder */
/** @typedef {import('./../Builder.js').Having} Having */
/** @typedef {import('./../Builder.js').Order} Order */
/** @typedef {import('./../Builder.js').Union} Union */
/** @typedef {import('./../Builder.js').Where} Where */

export default class Grammar extends mix(BaseGrammar).use(CompilesJsonPaths) {
  /**
   * The grammar specific operators.
   *
   * @type {string[]}
   */
  operators = []

  /**
   * The grammar specific bitwise operators.
   *
   * @type {string[]}
   */
  bitwiseOperators = []

  /**
   * The components that make up a select clause.
   *
   * @type {SelectComponent[]}
   */
  selectComponents = [
    { name: 'aggregate', property: 'aggregateProperty' },
    { name: 'columns', property: 'columns' },
    { name: 'from', property: 'fromProperty' },
    { name: 'indexHint', property: 'indexHint' },
    { name: 'joins', property: 'joins' },
    { name: 'wheres', property: 'wheres' },
    { name: 'groups', property: 'groups' },
    { name: 'havings', property: 'havings' },
    { name: 'orders', property: 'orders' },
    { name: 'limit', property: 'limitProperty' },
    { name: 'offset', property: 'offsetProperty' },
    { name: 'lock', property: 'lockProperty' }
  ]

  // constructor () {
  //   super()

  //   // use(this.constructor, [CompilesJsonPaths])
  //   // use(Grammar, [CompilesJsonPaths])
  // }

  /**
   * Compile an aggregated select clause.
   *
   * @protected
   * @param  {import('./../Builder.js').default}  query
   * @param  {Aggregate}  aggregate
   * @return {string}
   */
  compileAggregate (query, aggregate) {
    let column = this.columnize(aggregate.columns)

    // If the query has a "distinct" constraint and we're not asking for all columns
    // we need to prepend "distinct" onto the column name so that the query takes
    // it into account when it performs the aggregating operations on the data.
    if (Array.isArray(query.distinctProperty)) {
      column = 'distinct ' + this.columnize(query.distinctProperty)
    } else if (isTruthy(query.distinctProperty) && column !== '*') {
      column = 'distinct ' + column
    }

    return 'select ' + aggregate.function + '(' + column + ') as aggregate'
  }

  /**
   * Compile a basic having clause.
   *
   * @param  {Having}  having
   * @return {string}
   */
  compileBasicHaving (having) {
    const column = this.wrap(having.column)

    const parameter = this.parameter(having.value)

    return column + ' ' + having.operator + ' ' + parameter
  }

  /**
   * Compile the "select *" portion of the query.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {(string | import('./../Expression.js').default)[]}  columns
   * @return {string|undefined}
   */
  compileColumns (query, columns) {
    // If the query is actually performing an aggregating select, we will let that
    // compiler handle the building of the select clauses, as it will need some
    // more syntax that is best handled by that function to keep things neat.
    if (query.aggregateProperty !== undefined) {
      return ''
    }

    const select = query.distinctProperty !== false ? 'select distinct ' : 'select '

    return select + this.columnize(columns)
  }

  /**
   * Compile the components necessary for a select clause.
   *
   * @param  {import('./../Builder.js').default}  query
   * @return {Record<string, string>}
   */
  compileComponents (query) {
    /** @type {Record<string, string>} */
    const sql = {}

    for (const { name, property } of this.selectComponents) {
      if (this.isExecutable(query, property)) {
        const method = 'compile' + capitalize(name)

        sql[name] = this[method](query, query[property])
      }
    }

    return sql
  }

  /**
   * Compile a delete statement into SQL.
   *
   * @param  {import('./../Builder.js').default}  query
   * @return {string}
   */
  compileDelete (query) {
    const table = this.wrapTable(query.fromProperty)

    const where = this.compileWheres(query)

    return (
      query.joins.length > 0
        ? this.compileDeleteWithJoins(query, table, where)
        : this.compileDeleteWithoutJoins(query, table, where)
    ).trim()
  }

  /**
   * Compile a delete statement with joins into SQL.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {string}  table
   * @param  {string}  where
   * @return {string}
   */
  compileDeleteWithJoins (query, table, where) {
    const alias = table.split(' as ').at(-1)

    const joins = this.compileJoins(query, query.joins)

    return `delete ${alias} from ${table} ${joins} ${where}`
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
    return `delete from ${table} ${where}`
  }

  /**
   * Compile an exists statement into SQL.
   *
   * @param  {import('./../Builder.js').default}  query
   * @return {string}
   */
  compileExists (query) {
    const select = this.compileSelect(query)

    return `select exists(${select}) as ${this.wrap('exists')}`
  }

  /**
   * Compile the "from" portion of the query.
   *
   * @protected
   * @param  {import('./../Builder.js').default}  query
   * @param  {string}  table
   * @return {string}
   */
  compileFrom (query, table) {
    return 'from ' + this.wrapTable(table)
  }

  /**
   * Compile the "group by" portions of the query.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {string[]}  groups
   * @return {string}
   */
  compileGroups (query, groups) {
    return `group by ${this.columnize(groups)}`
  }

  /**
   * Compile a single having clause.
   *
   * @param  {Having}  having
   * @return {string}
   */
  compileHaving (having) {
    // If the having clause is "raw", we can just return the clause straight away
    // without doing any more processing on it. Otherwise, we will compile the
    // clause into SQL based on the components that make it up from builder.
    switch (having.type) {
      case 'Raw':
        return having.sql
      case 'between':
        return this.compileHavingBetween(having)
      case 'Null':
        return this.compileHavingNull(having)
      case 'NotNull':
        return this.compileHavingNotNull(having)
      case 'bit':
        return this.compileHavingBit(having)
      case 'Expression':
        return this.compileHavingExpression(having)
      case 'Nested':
        return this.compileNestedHavings(having)
      default:
        return this.compileBasicHaving(having)
    }
  }

  /**
   * Compile a "between" having clause.
   *
   * @param  {Having}  having
   * @return {string}
   */
  compileHavingBetween (having) {
    const between = having.not ? 'not between' : 'between'

    const column = this.wrap(having.column)

    const min = this.parameter(head(having.values))

    const max = this.parameter(last(having.values))

    return column + ' ' + between + ' ' + min + ' and ' + max
  }

  /**
   * Compile a having clause involving a bit operator.
   *
   * @param  {Having}  having
   * @return {string}
   */
  compileHavingBit (having) {
    const column = this.wrap(having.column)

    const parameter = this.parameter(having.value)

    return '(' + column + ' ' + having.operator + ' ' + parameter + ') != 0'
  }

  /**
 * Compile a having clause involving an expression.
 *
 * @param  {Having}  having
 * @return {string}
 */
  compileHavingExpression (having) {
    return having.column.getValue(this)
  }

  /**
   * Compile a having not null clause.
   *
   * @param  {Having}  having
   * @return {string}
   */
  compileHavingNotNull (having) {
    const column = this.wrap(having.column)

    return column + ' is not null'
  }

  /**
   * Compile a having null clause.
   *
   * @param  {Having}  having
   * @return {string}
   */
  compileHavingNull (having) {
    const column = this.wrap(having.column)

    return column + ' is null'
  }

  /**
 * Compile the "having" portions of the query.
 *
 * @param  {import('./../Builder.js').default}  query
 * @return {string}
 */
  compileHavings (query) {
    return 'having ' + this.removeLeadingBoolean(collect(query.havings).map((/** @type {Having} */having) => {
      return having.boolean + ' ' + this.compileHaving(having)
    }).implode(' '))
  }

  /**
   * Compile an insert statement into SQL.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {Object.<string, unknown>|unknown[]}  values //@TODO: verify this type
   * @return {string}
   */
  compileInsert (query, values) {
    // Essentially we will force every insert to be treated as a batch insert which
    // simply makes creating the SQL easier for us since we can utilize the same
    // basic routine regardless of an amount of records given to us to insert.
    const table = this.wrapTable(query.fromProperty)

    if (values.length === 0) {
      return `insert into ${table} default values`
    }

    if (!Array.isArray(values) && !Array.isArray(reset(values))/*  && !isPlainObject(values) */) {
      values = [values]
    }

    // const columns = this.columnize(Object.keys(values[0]))
    const columns = this.columnize(Object.keys(reset(values)))

    // We need to build a list of parameter place-holders of values that are bound
    // to the query. Each insert should have the exact same amount of parameter
    // bindings so we will loop through the record and parameterize them all.
    const parameters = collect(values).map((record) => {
      return '(' + this.parameterize(record) + ')'
    }).implode(', ')

    return `insert into ${table} (${columns}) values ${parameters}`
  }

  /**
   * Compile an insert and get ID statement into SQL.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {Object.<string, unknown>|unknown[]}  values
   * @param  {string}  [sequence]
   * @return {string}
   */
  compileInsertGetId (query, values, sequence) {
    return this.compileInsert(query, values)
  }

  /**
   * Compile an insert ignore statement into SQL.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {Object.<string, unknown>}  values
   * @return {string}
   *
   * @throws{ \RuntimeException}
   */
  compileInsertOrIgnore (query, values) {
    throw new Error('RuntimeException: This database engine does not support inserting while ignoring errors.')
  }

  /**
   * Compile an insert ignore statement using a subquery into SQL.
   *
   * @param  {Builder}  query
   * @param  {array}  columns
   * @param  {string}  sql
   * @return {string}
   *
   * @throws {Error}
   */
  compileInsertOrIgnoreUsing (query, columns, sql) {
    throw new Error('RuntimeException: This database engine does not support inserting while ignoring errors.')
  }

  /**
   * Compile an insert statement using a subquery into SQL.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {any[]}  columns
   * @param  {string}  sql
   * @return {string}
   */
  compileInsertUsing (query, columns, sql) {
    const table = this.wrapTable(query.fromProperty)

    if (columns.length === 0 || columns[0] === '*') {
      return `insert into ${table} ${sql}`
    }

    return `insert into ${table} (${this.columnize(columns)}) ${sql}`
  }

  /**
   * Compile a "lateral join" clause.
   *
   * @param  {JoinLateralClause}  join
   * @param  {string}  expression
   * @return {string}
   *
   * @throws Error
   */
  compileJoinLateral (join, expression) {
    throw new Error('RuntimeException: This database engine does not support lateral joins.')
  }

  /**
   * Compile the "join" portions of the query.
   *
   * @param  {Builder}  query
   * @param  {Builder[]}  joins //TODO: verify this type
   * @return {string}
   */
  compileJoins (query, joins) {
    return collect(joins).map((/** @type {Builder} */join) => {
      const table = this.wrapTable(join.table)

      const nestedJoins = join.joins.length === 0 ? '' : ' ' + this.compileJoins(query, join.joins)

      const tableAndNestedJoins = join.joins.length === 0 ? table : '(' + table + nestedJoins + ')'

      if (join instanceof JoinLateralClause) {
        return this.compileJoinLateral(join, tableAndNestedJoins)
      }

      return `${join.type} join ${tableAndNestedJoins} ${this.compileWheres(join)}`.trim()
    }).implode(' ')
  }

  /**
   * Compile a "JSON contains" statement into SQL.
   *
   * @param  {string}  column
   * @param  {string}  value
   * @return {string}
   *
   * @throws \RuntimeException
   */
  compileJsonContains (column, value) {
    throw new Error('RuntimeException: This database engine does not support JSON contains operations.')
  }

  /**
   * Compile a "JSON contains key" statement into SQL.
   *
   * @param  {string}  column
   * @return {string}
   *
   * @throws \RuntimeException
   */
  compileJsonContainsKey (column) {
    throw new Error('RuntimeException: This database engine does not support JSON contains key operations.')
  }

  /**
   * Compile a "JSON length" statement into SQL.
   *
   * @param  {string}  column
   * @param  {string}  operator
   * @param  {string}  value
   * @return {string}
   *
   * @throws \RuntimeException
   */
  compileJsonLength (column, operator, value) {
    throw new Error('RuntimeException: This database engine does not support JSON length operations.')
  }

  /**
   * Compile a "JSON value cast" statement into SQL.
   *
   * @param  {string}  value
   * @return {string}
   */
  compileJsonValueCast (value) {
    return value
  }

  /**
   * Compile the "limit" portions of the query.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {number}  limit
   * @return {string}
   */
  compileLimit (query, limit) {
    return `limit ${parseInt(limit, 10)}`
  }

  /**
   * Compile the lock into SQL.
   *
   * @param  {Builder}  query
   * @param  {boolean|string}  value
   * @return {string}
   */
  compileLock (query, value) {
    return typeof value === 'string' ? value : ''
  }

  /**
   * Compile a nested having clause.
   *
   * @param  {Having}  having
   * @return {string}
   */
  compileNestedHavings (having) {
    return '(' + this.compileHavings(having.query).substring(7) + ')'
  }

  /**
   * Compile the "offset" portions of the query.
   *
   * @param  {Builder}  query
   * @param  {number}  offset
   * @return {string}
   */
  compileOffset (query, offset) {
    return `offset ${parseInt(offset, 10)}`
  }

  /**
   * Compile the "order by" portions of the query.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {unknown[]}  orders // TODO: Verify this type
   * @return {string}
   */
  compileOrders (query, orders) {
    if (orders.length > 0) {
      return 'order by ' + this.compileOrdersToArray(query, orders).join(', ')
    }

    return ''
  }

  /**
   * Compile the query orders to an array.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {Orders[]}  orders
   * @return {unknown[]}
   */
  compileOrdersToArray (query, orders) {
    return orders.map((/** @type {Order} */order) => {
      return order.sql ?? this.wrap(order.column) + ' ' + String(order.direction)
    })
  }

  /**
   * Compile the random statement into SQL.
   *
   * @param  {string|number}  seed
   * @return {string}
   */
  compileRandom (seed) {
    return 'RANDOM()'
  }

  /**
   * Compile the SQL statement to define a savepoint.
   *
   * @param  {string}  name
   * @return {string}
   */
  compileSavepoint (name) {
    return 'SAVEPOINT ' + name
  }

  /**
   * Compile the SQL statement to execute a savepoint rollback.
   *
   * @param  {string}  name
   * @return {string}
   */
  compileSavepointRollBack (name) {
    return 'ROLLBACK TO SAVEPOINT ' + name
  }

  /**
   * Compile a select query into SQL.
   *
   * @param  {import('./../Builder.js').default}  query
   * @return {string}
   */
  compileSelect (query) {
    if ((query.unions.length > 0 || query.havings.length > 0) && query.aggregateProperty !== undefined) {
      return this.compileUnionAggregate(query)
    }

    // If the query does not have any columns set, we'll set the columns to the
    // * character to just get all of the columns from the database. Then we
    // can build the query and concatenate all the pieces together as one.
    const original = query.columns

    if (query.columns.length === 0) {
      query.columns = ['*']
    }

    // To compile the query, we'll spin through each component of the query and
    // see if that component exists. If it does we'll just call the compiler
    // function for the component which is responsible for making the SQL.
    let sql = this.concatenate(this.compileComponents(query)).trim()

    if (query.unions.length > 0) {
      sql = this.wrapUnion(sql) + ' ' + this.compileUnions(query)
    }

    query.columns = original

    return sql
  }

  /**
   * Compile a truncate table statement into SQL.
   *
   * @param  {import('./../Builder.js').default}  query
   * @return {Record<string, unknown[]>}
   */
  compileTruncate (query) {
    return { ['truncate table ' + this.wrapTable(query.fromProperty)]: [] }
  }

  /**
   * Compile a single union statement.
   *
   * @param  {Union}  union
   * @return {string}
   */
  compileUnion (union) {
    const conjunction = union.all ? ' union all ' : ' union '

    return conjunction + this.wrapUnion(union.query.toSql())
  }

  /**
   * Compile an update statement into SQL.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {Record<string, unknown>}  values
   * @return {string}
   */
  compileUpdate (query, values) {
    const table = this.wrapTable(query.fromProperty)

    const columns = this.compileUpdateColumns(query, values)

    const where = this.compileWheres(query)

    return (
      query.joins.length > 0
        ? this.compileUpdateWithJoins(query, table, columns, where)
        : this.compileUpdateWithoutJoins(query, table, columns, where)
    ).trim()
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
      return this.wrap(key) + ' = ' + this.parameter(value)
    }).implode(', ')
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
    const joins = this.compileJoins(query, query.joins)

    return `update ${table} ${joins} set ${columns} ${where}`
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
    return `update ${table} set ${columns} ${where}`
  }

  /**
   * Compile an "upsert" statement into SQL.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {array}  values
   * @param  {array}  uniqueBy
   * @param  {array}  update
   * @return {string}
   *
   * @throws {Error<RuntimeException>}
   */
  compileUpsert (query, values, uniqueBy, update) {
    throw new Error('RuntimeException: This database engine does not support upserts.')
  }

  /**
   * Compile a union aggregate query into SQL.
   *
   * @param  {import('./../Builder.js').default}  query
   * @return {string}
   */
  compileUnionAggregate (query) {
    const sql = this.compileAggregate(query, query.aggregateProperty)

    query.aggregateProperty = undefined

    return sql + ' from (' + this.compileSelect(query) + ') as ' + this.wrapTable('temp_table')
  }

  /**
   * Compile the "union" queries attached to the main query.
   *
   * @param  {Builder}  query
   * @return {string}
   */
  compileUnions (query) {
    let sql = ''

    for (const union of query.unions) {
      sql += this.compileUnion(union)
    }

    if (query.unionOrders.length > 0) {
      sql += ' ' + this.compileOrders(query, query.unionOrders)
    }

    if (query.unionLimit !== undefined) {
      sql += ' ' + this.compileLimit(query, query.unionLimit)
    }

    if (query.unionOffset !== undefined) {
      sql += ' ' + this.compileOffset(query, query.unionOffset)
    }

    return sql.trimStart()
  }

  /**
   * Compile the "where" portions of the query.
   *
   * @param  {Builder}  query
   * @return {string}
   */
  compileWheres (query) {
    // Each type of where clauses has its own compiler function which is responsible
    // for actually creating the where clauses SQL. This helps keep the code nice
    // and maintainable since each clause has a very small method that it uses.
    if (query.wheres.length === 0) {
      return ''
    }

    // If we actually have some where clauses, we will strip off the first boolean
    // operator, which is added by the query builders for convenience so we can
    // avoid checking for the first clauses in each of the compilers methods.
    const sql = this.compileWheresToArray(query)

    if (sql.length > 0) {
      return this.concatenateWhereClauses(query, sql)
    }

    return ''
  }

  /**
   * Get an array of all the where clauses for the query.
   *
   * @param  {import('./../Builder.js').default}  query
   * @return {string[]}
   */
  compileWheresToArray (query) {
    return collect(query.wheres).map((where) => {
      return where.boolean + ' ' + this['where' + where.type](query, where)
    }).all()
  }

  /**
   * Concatenate an array of segments, removing empties.
   *
   * @param  {Record<string, string>}  segments
   * @return {string}
   */
  concatenate (segments) {
    return Object.values(segments).filter((value) => {
      return value !== ''
    }).join(' ')
  }

  /**
   * Format the where clause statements into one string.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {string[]}  sql
   * @return {string}
   */
  concatenateWhereClauses (query, sql) {
    const conjunction = query instanceof JoinClause ? 'on' : 'where'

    return conjunction + ' ' + this.removeLeadingBoolean(sql.join(' '))
  }

  /**
   * Compile a date based where clause.
   *
   * @param  {string}  type
   * @param  {import('./../Builder.js').default}  query
   * @param  {Where}  where
   * @return {string}
   */
  dateBasedWhere (type, query, where) {
    const value = this.parameter(where.value)

    return type + '(' + this.wrap(where.column) + ') ' + where.operator + ' ' + value
  }

  /**
   * Get the grammar specific bitwise operators.
   *
   * @return {string[]}
   */
  getBitwiseOperators () {
    return this.bitwiseOperators
  }

  /**
   * Get the grammar specific operators.
   *
   * @return {string[]}
   */
  getOperators () {
    return this.operators
  }

  isExecutable (query, property) {
    const subject = query[property]

    if (subject === undefined || subject === '') {
      return false
    }

    if (Array.isArray(subject) && subject.length === 0) {
      return false
    }

    return true
  }

  /**
   * Prepare the binding for a "JSON contains" statement.
   *
   * @param  {unknown}  binding
   * @return {string}
   */
  prepareBindingForJsonContains (binding) {
    return JSON.stringify(binding)
  }

  /**
   * Prepare the bindings for a delete statement.
   *
   * @param  {import('./../Builder.js').Bindings}  bindings
   * @return {array}
   */
  prepareBindingsForDelete (bindings) {
    return Arr.flatten(
      Arr.except(bindings, 'select')
    )
  }

  /**
   * Prepare the bindings for an update statement.
   *
   * @param  {import('./../Builder.js').Bindings}  bindings
   * @param  {unknown[]}  values // TODO: verify this type
   * @return {unknown[]} // TODO: verify this type
   */
  prepareBindingsForUpdate (bindings, values) {
    // const cleanBindings = Arr.except(bindings, ['select', 'join'])

    // return [
    //   ...Object.values(bindings.join),
    //   ...Object.values(values),
    //   ...Object.values(Arr.flatten(cleanBindings))
    // ].flat()

    const cleanBindings = Arr.except(bindings, ['select', 'join'])

    values = Arr.flatten(Object.values(values).map((value) => getValue(value)))

    return Object.values([
      ...Object.values(bindings.join),
      ...Object.values(values),
      ...Object.values(Arr.flatten(cleanBindings))
    ])
  }

  /**
   * Remove the leading boolean from a statement.
   *
   * @param  {string}  value
   * @return {string}
   */
  removeLeadingBoolean (value) {
    return value.replace(/(and |or )+/i, '')
  }

  /**
   * Substitute the given bindings into the given raw SQL query.
   *
   * @param  {string}  sql
   * @param  {import('./../Builder.js').Bindings}  bindings
   * @return {string}
   */
  substituteBindingsIntoRawSql (sql, bindings) {
    bindings = bindings.map((value) => this.escape(value))

    let query = ''

    let isStringLiteral = false

    for (let i = 0; i < sql.length; i++) {
      const char = sql[i]
      const nextChar = sql[i + 1] ?? null

      // Single quotes can be escaped as '' according to the SQL standard while
      // MySQL uses \'. Postgres has operators like ?| that must get encoded
      // in PHP like ??|. We should skip over the escaped characters here.
      if (["\\'", "''", '??'].includes(char + nextChar)) {
        query += char + nextChar
        i += 1
      } else if (char === "'") { // Starting / leaving string literal...
        query += char
        isStringLiteral = !isStringLiteral
      } else if (char === '?' && !isStringLiteral) { // Substitutable binding...
        query += bindings.shift() ?? '?'
      } else { // Normal character...
        query += char
      }
    }

    return query
  }

  /**
   * Determine if the grammar supports savepoints.
   *
   * @return {boolean}
   */
  supportsSavepoints () {
    return true
  }

  /**
   * Compile a basic where clause.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {Where}  where
   * @return {string}
   */
  whereBasic (query, where) {
    const value = this.parameter(where.value)

    const operator = where.operator.replace('?', '??')

    return this.wrap(where.column) + ' ' + operator + ' ' + value
  }

  /**
   * Compile a "between" where clause.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {Where}  where
   * @return {string}
   */
  whereBetween (query, where) {
    const between = where.not ? 'not between' : 'between'

    const min = this.parameter(Array.isArray(where.values) ? reset(where.values) : where.values[0])

    const max = this.parameter(Array.isArray(where.values) ? end(where.values) : where.values[1])

    return this.wrap(where.column) + ' ' + between + ' ' + min + ' and ' + max
  }

  /**
   * Compile a "between" where clause.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {Where}  where
   * @return {string}
   */
  whereBetweenColumns (query, where) {
    const between = where.not ? 'not between' : 'between'

    const min = this.wrap(Array.isArray(where.values) ? reset(where.values) : where.values[0])

    const max = this.wrap(Array.isArray(where.values) ? end(where.values) : where.values[1])

    return this.wrap(where.column) + ' ' + between + ' ' + min + ' and ' + max
  }

  /**
   * Compile a bitwise operator where clause.
   *
   * @param  {Builder}  query
   * @param  {Where}  where
   * @return {string}
   */
  whereBitwise (query, where) {
    return this.whereBasic(query, where)
  }

  /**
   * Compile a where clause comparing two columns.
   *
   * @param  {Builder}  query
   * @param  {Where}  where
   * @return {string}
   */
  whereColumn (query, where) {
    return this.wrap(where.first) + ' ' + where.operator + ' ' + this.wrap(where.second)
  }

  /**
   * Compile a "where date" clause.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {Where}  where
   * @return {string}
   */
  whereDate (query, where) {
    return this.dateBasedWhere('date', query, where)
  }

  /**
   * Compile a "where day" clause.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {Where}  where
   * @return {string}
   */
  whereDay (query, where) {
    return this.dateBasedWhere('day', query, where)
  }

  /**
   * Compile a where exists clause.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {Where}  where
   * @return {string}
   */
  whereExists (query, where) {
    return 'exists (' + this.compileSelect(where.query) + ')'
  }

  /**
   * Compile a clause based on an expression.
   *
   * @param  {Builder}  query
   * @param  {Where}  where
   * @return {string}
   */
  whereExpression (query, where) {
    return where.column.getValue(this)
  }

  /**
   * Compile a "where fulltext" clause.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {Where}  where
   * @return {string}
   */
  whereFulltext (query, where) {
    throw new Error('RuntimeException: This database engine does not support fulltext search operations.')
  }

  /**
   * Compile a "where in" clause.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {Where}  where
   * @return {string}
   */
  whereIn (query, where) {
    if (where.values?.length > 0) {
      return this.wrap(where.column) + ' in (' + this.parameterize(where.values) + ')'
    }

    return '0 = 1'
  }

  /**
   * Compile a "where in raw" clause.
   *
   * For safety, whereIntegerInRaw ensures this method is only used with integer values.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {Where}  where
   * @return {string}
   */
  whereInRaw (query, where) {
    if (where.values?.length > 0) {
      return this.wrap(where.column) + ' in (' + where.values.join(', ') + ')'
    }

    return '0 = 1'
  }

  /**
   * Compile a "where JSON boolean" clause.
   *
   * @param  {Builder}  query
   * @param  {Where}  where
   * @return {string}
   */
  whereJsonBoolean (query, where) {
    const column = this.wrapJsonBooleanSelector(where.column)

    const value = this.wrapJsonBooleanValue(
      this.parameter(where.value)
    )

    return column + ' ' + where.operator + ' ' + value
  }

  /**
   * Compile a "where JSON contains" clause.
   *
   * @param  {Builder}  query
   * @param  {Where}  where
   * @return {string}
   */
  whereJsonContains (query, where) {
    const not = where.not ? 'not ' : ''

    return not + this.compileJsonContains(
      where.column,
      this.parameter(where.value)
    )
  }

  /**
   * Compile a "where JSON contains key" clause.
   *
   * @param  {Builder}  query
   * @param  {import('./../Builder.js').Where}  where
   * @return {string}
   */
  whereJsonContainsKey (query, where) {
    const not = where.not ? 'not ' : ''

    return not + this.compileJsonContainsKey(
      where.column
    )
  }

  /**
   * Compile a "where JSON length" clause.
   *
   * @param  {Builder}  query
   * @param  {Where}  where
   * @return {string}
   */
  whereJsonLength (query, where) {
    return this.compileJsonLength(
      where.column,
      where.operator,
      this.parameter(where.value)
    )
  }

  /**
   * Compile a "where month" clause.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {Where}  where
   * @return {string}
   */
  whereMonth (query, where) {
    return this.dateBasedWhere('month', query, where)
  }

  /**
   * Compile a nested where clause.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {Where}  where
   * @return {string}
   */
  whereNested (query, where) {
    // Here we will calculate what portion of the string we need to remove. If this
    // is a join clause query, we need to remove the "on" portion of the SQL and
    // if it is a normal query we need to take the leading "where" of queries.
    const offset = where.query instanceof JoinClause ? 3 : 6

    return '(' + this.compileWheres(where.query).substring(offset) + ')'
  }

  /**
   * Compile a where exists clause.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {Where}  where
   * @return {string}
   */
  whereNotExists (query, where) {
    return 'not exists (' + this.compileSelect(where.query) + ')'
  }

  /**
   * Compile a "where not in" clause.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {Where}  where
   * @return {string}
   */
  whereNotIn (query, where) {
    if (where.values.length > 0) {
      return this.wrap(where.column) + ' not in (' + this.parameterize(where.values) + ')'
    }

    return '1 = 1'
  }

  /**
   * Compile a "where not in raw" clause.
   *
   * For safety, whereIntegerInRaw ensures this method is only used with integer values.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {Where}  Where
   * @return {string}
   */
  whereNotInRaw (query, where) {
    if (where.values?.length > 0) {
      return this.wrap(where.column) + ' not in (' + where.values.join(', ') + ')'
    }

    return '1 = 1'
  }

  /**
   * Compile a "where not null" clause.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {Where}  where
   * @return {string}
   */
  whereNotNull (query, where) {
    return this.wrap(where.column) + ' is not null'
  }

  /**
   * Compile a "where null" clause.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {Where}  where
   * @return {string}
   */
  whereNull (query, where) {
    return this.wrap(where.column) + ' is null'
  }

  /**
   * Compile a raw where clause.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {Where}  where
   * @return {string}
   */
  whereRaw (query, where) {
    return where.sql instanceof Expression ? where.sql.getValue(this) : where.sql
  }

  /**
   * Compile a where row values condition.
   *
   * @param  {Builder}  query
   * @param  {Where}  where
   * @return {string}
   */
  whereRowValues (query, where) {
    const columns = this.columnize(where.columns)

    const values = this.parameterize(where.values)

    return '(' + columns + ') ' + where.operator + ' (' + values + ')'
  }

  /**
   * Compile a where condition with a sub-select.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {Where}  where
   * @return {string}
   */
  whereSub (query, where) {
    const select = this.compileSelect(where.query)

    return this.wrap(where.column) + ' ' + where.operator + ` (${select})`
  }

  /**
   * Compile a "where time" clause.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {Where}  where
   * @return {string}
   */
  whereTime (query, where) {
    return this.dateBasedWhere('time', query, where)
  }

  /**
   * Compile a "where year" clause.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {Where}  where
   * @return {string}
   */
  whereYear (query, where) {
    return this.dateBasedWhere('year', query, where)
  }

  /**
   * Wrap the given JSON selector for boolean values.
   *
   * @param  {string}  value
   * @return {string}
   */
  wrapJsonBooleanSelector (value) {
    return this.wrapJsonSelector(value)
  }

  /**
   * Wrap the given JSON boolean value.
   *
   * @param  {string}  value
   * @return {string}
   */
  wrapJsonBooleanValue (value) {
    return value
  }

  /**
   * Wrap a union subquery in parentheses.
   *
   * @param  {string}  sql
   * @return {string}
   */
  wrapUnion (sql) {
    return `(${sql})`
  }
}

import {
  clone, dateFormat,
  isInteger, isNil, isPlainObject, isString
} from '@devnetic/utils'

import Arr from '../../Collections/Arr.js'
import EloquentBuilder from '../Eloquent/Builder.js'
import BuildsQueries from '../Concerns/BuildsQueries.js'
import Expression from './Expression.js'
import JoinClause from './JoinClause.js'
import Macroable from '../../Macroable/Traits/Macroable.js'
import Relation from '../Eloquent/Relations/Relation.js'
import { collect, head, last, reset } from '../../Collections/helpers.js'
import { castArray, changeKeyCase, isBoolean, isFalsy, isTruthy, tap } from '../../Support/index.js'
import use from '../../Support/Traits/use.js'

export default class Builder {
  /**
   * Create a new query builder instance.
   *
   * @constructor
   * @param  {import('./../Connection.js').default}  connection
   * @param  {import('./Grammars/Grammar.js').default}  [grammar]
   * @param  {import('./Processors/Processor.js').default}  [processor]
   * @return {void}
   */
  constructor (connection, grammar, processor) {
    use(Builder, [Macroable, BuildsQueries])

    /**
     * An aggregate function and column to be run.
     *
     * @member {object}
     */
    this.aggregateProperty = undefined

    /**
     * The current query value bindings.
     *
     * @member {Bindings}
     */
    this.bindings = {
      select: [],
      from: [],
      join: [],
      where: [],
      groupBy: [],
      having: [],
      order: [],
      union: [],
      unionOrder: []
    }

    /**
     * All of the available bitwise operators.
     *
     * @var string[]
     */
    this.bitwiseOperators = [
      '&', '|', '^', '<<', '>>', '&~'
    ]

    /**
     * The callbacks that should be invoked before the query is executed.
     *
     * @member {Array}
     */
    this.beforeQueryCallbacks = []

    /**
     * The columns that should be returned.
     *
     * @var unknown[]
     */
    this.columns = []

    /**
     * Indicates if the query returns distinct results.
     *
     * Occasionally contains the columns that should be distinct.
     *
     * @member {boolean|Array}
     */
    this.distinctProperty = false

    /**
     * The table which the query is targeting.
     *
     * @var string
     */
    this.fromProperty = ''

    /**
     * The groupings for the query.
     *
     * @member {Array}
     */
    this.groups = []

    /**
     * The having constraints for the query.
     *
     * @member {Array}
     */
    this.havings = []

    /**
     * The table joins for the query.
     *
     * @var array
     */
    this.joins = []

    /**
     * All of the available clause operators.
     *
     * @member {string[]}
     */
    this.operators = [
      '=', '<', '>', '<=', '>=', '<>', '!=', '<=>',
      'like', 'like binary', 'not like', 'ilike',
      '&', '|', '^', '<<', '>>',
      'rlike', 'not rlike', 'regexp', 'not regexp',
      '~', '~*', '!~', '!~*', 'similar to',
      'not similar to', 'not ilike', '~~*', '!~~*'
    ]

    /**
     * The orderings for the query.
     *
     * @member {string[]}
     */
    this.orders = []

    /**
     * The maximum number of union records to return.
     *
     * @member number
     */
    this.unionLimit = undefined

    /**
     * The number of union records to skip.
     *
     * @member number
     */
    this.unionOffset = undefined

    /**
     * The orderings for the union query.
     *
     * @member {Array}
     */
    this.unionOrders = []

    /**
     * The query union statements.
     *
     * @member {Array}
     */
    this.unions = []

    /**
     * The where constraints for the query.
     *
     * @var array
     */
    this.wheres = [] // TODO: verify the correct type

    /** @type {import('./../Connection.js').default} */
    this.connection = connection

    this.grammar = grammar ?? connection.getQueryGrammar()

    this.processor = processor ?? connection.getPostProcessor()
    // return proxy
  }

  /**
   * Add an array of where clauses to the query.
   *
   * @param  {any}  column
   * @param  {string}  boolean
   * @param  {string}  method
   * @return {this}
   */
  addArrayOfWheres (column, boolean, method = 'where') {
    return this.whereNested((query) => {
      for (const [key, value] of Object.entries(column)) {
        if (isInteger(parseInt(key, 10)) && Array.isArray(value)) {
          query[method](...value)
        } else {
          query[method](key, '=', value, boolean)
        }
      }
    }, boolean)
  }

  /**
   * Add a binding to the query.
   *
   * @param  {any}  value
   * @param  {string}  type
   * @return {this}
   *
   * @throws {\InvalidArgumentException}
   */
  addBinding (value, type = 'where') {
    if (this.bindings[type] === undefined) {
      throw new Error(`InvalidArgumentException: Invalid binding type: ${type}.`)
    }
    if (Array.isArray(value)) {
      this.bindings[type] = Array.from(Object.values([...this.bindings[type], ...value]))
    } else {
      this.bindings[type].push(value)
    }
    return this
  }

  /**
   * Add a date based (year, month, day, time) statement to the query.
   *
   * @param  {string}  type
   * @param  {string}  column
   * @param  {string}  operator
   * @param  {unknown}  value
   * @param  {string}  boolean
   * @return {this}
   */
  addDateBasedWhere (type, column, operator, value, boolean = 'and') {
    this.wheres.push({ column, type, boolean, operator, value })
    if (!(value instanceof Expression)) {
      this.addBinding(value, 'where')
    }
    return this
  }

  /**
   * Add another query builder as a nested having to the query builder.
   *
   * @param  {\Illuminate\Database\Query\Builder}  query
   * @param  {string}  boolean
   * @return {this}
   */
  addNestedHavingQuery (query, boolean = 'and') {
    if (query.havings.length > 0) {
      const type = 'Nested'
      this.havings.push({ type, query, boolean })
      this.addBinding(query.getRawBindings().having, 'having')
    }
    return this
  }

  /**
   * Add another query builder as a nested where to the query builder.
   *
   * @param  {\Illuminate\Database\Query\Builder}  query
   * @param  {string}  [boolean=and]
   * @return {this}
   */
  addNestedWhereQuery (query, boolean = 'and') {
    if (query.wheres.length > 0) {
      const type = 'Nested'
      this.wheres.push({ type, query, boolean })
      this.addBinding(query.getRawBindings().where, 'where')
    }
    return this
  }

  /**
   * Add a new select column to the query.
   *
   * @param  {array|any}  column
   * @return {this}
   */
  addSelect (column) {
    const columns = Array.isArray(column) ? column : [...arguments]
    for (const [as, column] of Arr.iterable(columns)) {
      if (isString(as) && this.isQueryable(column)) {
        if (this.columns.length > 0) {
          this.select(this.fromProperty + '.*')
        }
        this.selectSub(column, as)
      } else {
        this.columns.push(column)
      }
    }
    return this
  }

  /**
   * Add an exists clause to the query.
   *
   * @param  {\Illuminate\Database\Query\Builder}  query
   * @param  {string}  boolean
   * @param  {boolean}  not
   * @return {this}
   */
  addWhereExistsQuery (query, boolean = 'and', not = false) {
    const type = not ? 'NotExists' : 'Exists'
    this.wheres.push({ type, query, boolean })
    this.addBinding(query.getBindings(), 'where')
    return this
  }

  /**
   * Execute an aggregate function on the database.
   *
   * @param  {string}  functionName
   * @param  {any[]}  columns
   * @return {*}
   */
  async aggregate (functionName, columns = ['*']) {
    // We need to save the original bindings, because the cloneWithoutBindings
    // method delete them from the builder object
    const bindings = clone(this.bindings)
    const results = await this.cloneWithout(this.unions.length > 0 || this.havings.length > 0 ? [] : ['columns'])
      .cloneWithoutBindings(this.unions.length > 0 || this.havings.length > 0 ? [] : ['select'])
      .setAggregate(functionName, columns)
      .get(columns)
    this.bindings = bindings
    if (!results.isEmpty()) {
      return results.all()[0].aggregate
    }
  }

  /**
   * Invoke the "before query" modification callbacks.
   *
   * @return {void}
   */
  applyBeforeQueryCallbacks () {
    for (const queryCallback of this.beforeQueryCallbacks) {
      queryCallback(this)
    }
    this.beforeQueryCallbacks = []
  }

  /**
   * Remove all of the expressions from a list of bindings.
   *
   * @param  {Array}  bindings
   * @return {Array}
   */
  cleanBindings (bindings) {
    return Arr.values(bindings.filter((binding) => {
      return !(binding instanceof Expression)
    }))
  }

  /**
   * Clone the query.
   *
   * @return {Builder}
   */
  clone () {
    const cloned = Object.assign({}, this)
    Object.setPrototypeOf(cloned, Object.getPrototypeOf(this))
    // The cloning process needs to run through Arrays and Maps to ensure that
    // these structured are cloned correctly like new values and not references.
    for (const propertyName of Object.getOwnPropertyNames(cloned)) {
      const property = Reflect.get(cloned, propertyName)
      if (Array.isArray(property) || property instanceof Map) {
        Reflect.set(cloned, propertyName, clone(property))
      }
    }
    return cloned
  }

  /**
   * Clone the existing query instance for usage in a pagination subquery.
   *
   * @return {this}
   */
  cloneForPaginationCount () {
    return this.cloneWithout(['orders', 'limitProperty', 'offsetProperty'])
      .cloneWithoutBindings(['order'])
  }

  /**
   * Clone the query without the given properties.
   *
   * @param  {Array}  properties
   * @return {this}
   */
  cloneWithout (properties) {
    return tap(this.clone(), (clone) => {
      for (const property of properties) {
        if (Array.isArray(clone[property])) {
          clone[property] = []
        } else {
          clone[property] = undefined
        }
      }
    })
  }

  /**
   * Clone the query without the given bindings.
   *
   * @param  {Array}  except
   * @return {Builder}
   */
  cloneWithoutBindings (except) {
    return tap(this.clone(), (clone) => {
      for (const type of except) {
        clone.bindings[type] = []
      }
    })
  }

  /**
   * Retrieve the "count" result of the query.
   *
   * @param  {string}  [columns=*]
   * @return {number}
   */
  async count (columns = '*') {
    return await this.aggregate('count', Arr.wrap(columns))
  }

  /**
   * Creates a subquery and parse it.
   *
   * @param  {Function|\Illuminate\Database\Query\Builder|EloquentBuilder|string}  query
   * @return {Array}
   */
  createSub (query) {
    // If the given query is a Closure, we will execute it while passing in a new
    // query instance to the Closure. This will give the developer a chance to
    // format and work with the query before we cast it to a raw SQL string.
    if (query instanceof Function) {
      const callback = query
      query = this.forSubQuery()
      callback(query)
    }
    return this.parseSub(query)
  }

  /**
   * Add a "cross join" clause to the query.
   *
   * @param  {string}  table
   * @param  {Function|string}  {first}
   * @param  {string}  [operator=undefined]
   * @param  {string}  [second=undefined]
   * @return {this}
   */
  crossJoin (table, first, operator, second) {
    if (isTruthy(first)) {
      return this.join(table, first, operator, second, 'cross')
    }
    this.joins.push(this.newJoinClause(this, 'cross', table))
    return this
  }

  /**
   * Force the query to only return distinct results.
   *
   * @param  {string[]}  columns
   * @return {this}
   */
  distinct (...columns) {
    if (columns.length > 0) {
      this.distinctProperty = Array.isArray(columns[0]) || typeof columns[0] === 'boolean' ? columns[0] : columns
    } else {
      this.distinctProperty = true
    }
    return this
  }

  /**
   * Determine if no rows exist for the current query.
   *
   * @return {Promise<boolean>}
   */
  async doesntExist () {
    const result = await this.exists()
    return !result
  }

  /**
   * Execute the given callback if rows exist for the current query.
   *
   * @param  {Function}  callback
   * @return {*}
   */
  async doesntExistOr (callback) {
    return await this.doesntExist() ? true : callback()
  }

  /**
   * Determine if any rows exist for the current query.
   *
   * @return {Promise<boolean>}
   */
  async exists () {
    this.applyBeforeQueryCallbacks()
    let results = await this.connection.select(this.grammar.compileExists(this), this.getBindings())
    // If the results has rows, we will get the row and see if the exists column is a
    // boolean true. If there is no results for this query we will return false as
    // there are no rows for this query at all and we can return that info here.
    if (results[0] !== undefined) {
      results = results[0]
      return Boolean(results.exists)
    }
    return false
  }

  /**
   * Execute the given callback if no rows exist for the current query.
   *
   * @param  {Function}  callback
   * @return {*}
   */
  async existsOr (callback) {
    return await this.exists() ? true : callback()
  }

  /**
   * Execute a query for a single record by ID.
   *
   * @param  {number|string}  id
   * @param  {string[]}  columns
   * @return {*|this}
   */
  find (id, columns = ['*']) {
    return this.where('id', '=', id).first(columns)
  }

  /**
   * Get a scalar type value from an unknown type of input.
   *
   * @param  {any}  value
   * @return {any}
   */
  flattenValue (value) {
    return Array.isArray(value) ? head(Arr.flatten(value)) : value
  }

  /**
   * Create a new query instance for nested where condition.
   *
   * @return {\Illuminate\Database\Query\Builder}
   */
  forNestedWhere () {
    return this.newQuery().from(this.fromProperty)
  }

  /**
   * Set the limit and offset for a given page.
   *
   * @param  {number}  page
   * @param  {number}  [perPage=15]
   * @return {this}
   */
  forPage (page, perPage = 15) {
    return this.offset((page - 1) * perPage).limit(perPage)
  }

  /**
   * Create a new query instance for a sub-query.
   *
   * @return {\Illuminate\Database\Query\Builder}
   */
  forSubQuery () {
    return this.newQuery()
  }

  /**
   * Set the table which the query is targeting.
   *
   * @param  {Function|\Illuminate\Database\Query\Builder|string}  table
   * @param  {string|undefined}  as
   * @return {this}
   * @memberof Builder
   */
  from (table, as) {
    if (this.isQueryable(table)) {
      return this.fromSub(table, as)
    }

    this.fromProperty = as !== undefined ? `${String(table)} as ${as}` : String(table)

    return this
  }

  /**
   * Add a raw from clause to the query.
   *
   * @param  {string}  expression
   * @param  {unknown}  [bindings=[]]
   * @return {this}
   */
  fromRaw (expression, bindings = []) {
    this.fromProperty = new Expression(expression)
    this.addBinding(bindings, 'from')
    return this
  }

  /**
   * Makes "from" fetch from a subquery.
   *
   * @param  {Function|\Illuminate\Database\Query\Builder|string}  query
   * @param  {string}  as
   * @return {this}
   *
   * @throws {\InvalidArgumentException}
   */
  fromSub (query, as) {
    let bindings;
    [query, bindings] = this.createSub(query)
    return this.fromRaw(`(${query}) as ${this.grammar.wrapTable(as)}`, bindings)
  }

  /**
   * Execute the query as a "select" statement.
   *
   * @param  {Array|string}  columns
   * @return {\Illuminate\Support\Collection}
   */
  async get (columns = ['*']) {
    return collect(await this.onceWithColumns(Arr.wrap(columns), () => {
      return this.processor.processSelect(this, this.runSelect())
    }))
  }

  /**
   * Get the current query value bindings in a flattened array.
   *
   * @return {any[]}
   */
  getBindings () {
    return Arr.flatten(this.bindings)
  }

  /**
   * Get the database connection instance.
   *
   * @return {import('./../Connection.js').default}
   */
  getConnection () {
    return this.connection
  }

  /**
   * Get the count of the total records for the paginator.
   *
   * @param  {unknown[]}  [columns=[*]]
   * @return {Promise<number>}
   */
  async getCountForPagination (columns = ['*']) {
    const results = await this.runPaginationCountQuery(columns)
    // Once we have run the pagination count query, we will get the resulting count and
    // take into account what type of query it was. When there is a group by we will
    // just return the count of the entire results set since that will be correct.
    if (isFalsy(results[0])) {
      return 0
    } else if (isPlainObject(results[0])) {
      return Number(results[0]?.aggregate)
    }
    return Number(changeKeyCase(results[0]).aggregate)
  }

  /**
   * Get the query grammar instance.
   *
   * @return {\Illuminate\Database\Query\Grammars\Grammar}
   */
  getGrammar () {
    return this.grammar
  }

  /**
   * Get the database query processor instance.
   *
   * @return {import('./Processors/Processor.js').default}
   */
  getProcessor () {
    return this.processor
  }

  /**
   * Get the raw array of bindings.
   *
   * @return {Bindings}
   */
  getRawBindings () {
    return this.bindings
  }

  /**
   * Add a "group by" clause to the query.
   *
   * @param  {string|string[]}  groups
   * @return {this}
   */
  groupBy (...groups) {
    for (const group of groups) {
      this.groups = [
        ...this.groups,
        ...Arr.wrap(group)
      ]
    }
    return this
  }

  /**
   * Add a raw groupBy clause to the query.
   *
   * @param  {string}  sql
   * @param  {string[]}  [bindings=[]]
   * @return {this}
   */
  groupByRaw (sql, bindings = []) {
    this.groups.push(new Expression(sql))
    this.addBinding(bindings, 'groupBy')
    return this
  }

  /**
   * Add a "having" clause to the query.
   *
   * @param  {Function | string}  column
   * @param  {string}  [operator]
   * @param  {string}  [value]
   * @param  {string}  [boolean]
   * @return {this}
   */
  having (column, operator, value, boolean = 'and') {
    // Here we will make some assumptions about the operator. If only 2 values are
    // passed to the method, we will assume that the operator is an equals sign
    // and keep going. Otherwise, we'll require the operator to be passed in.
    [value, operator] = this.prepareValueAndOperator(value, operator, arguments.length === 2)
    let type = 'Basic'
    if (column instanceof Function && operator === undefined) {
      return this.havingNested(column, boolean)
    }
    // If the given operator is not found in the list of valid operators we will
    // assume that the developer is just short-cutting the '=' operators and
    // we will set the operators to '=' and set the values appropriately.
    if (this.invalidOperator(operator)) {
      [value, operator] = [operator, '=']
    }
    if (this.isBitwiseOperator(operator)) {
      type = 'Bitwise'
    }
    this.havings.push({ type, column, operator, value, boolean })
    if (!(value instanceof Expression)) {
      this.addBinding(this.flattenValue(value), 'having')
    }
    return this
  }

  /**
   * Add a "having between " clause to the query.
   *
   * @param  {string}  column
   * @param  {any[]}  values
   * @param  {string}  [boolean=and]
   * @param  {boolean}  [not=and]
   * @return {this}
   */
  havingBetween (column, values, boolean = 'and', not = false) {
    const type = 'between'
    this.havings.push({ type, column, values, boolean, not })
    this.addBinding(this.cleanBindings(Arr.flatten(values)).slice(0, 2), 'having')
    return this
  }

  /**
   * Add a nested having statement to the query.
   *
   * @param  {Function}  callback
   * @param  {string}  [boolean=and]
   * @return {this}
   */
  havingNested (callback, boolean = 'and') {
    const query = this.forNestedWhere()
    callback(query)
    return this.addNestedHavingQuery(query, boolean)
  }

  /**
   * Add a "having not null" clause to the query.
   *
   * @param  {string|any[]}  columns
   * @param  {string}  boolean
   * @return {this}
   */
  havingNotNull (columns, boolean = 'and') {
    return this.havingNull(columns, boolean, true)
  }

  /**
   * Add a "having null" clause to the query.
   *
   * @param  {string | any[]}  columns
   * @param  {string}  boolean
   * @param  {boolean}  not
   * @return {this}
   */
  havingNull (columns, boolean = 'and', not = false) {
    const type = not ? 'NotNull' : 'Null'
    for (const column of Arr.wrap(columns)) {
      this.havings.push({ type, column, boolean })
    }
    return this
  }

  /**
   * Add a raw having clause to the query.
   *
   * @param  {string}  sql
   * @param  {string[]}  [bindings=[]]
   * @param  {string}  [boolean='and']
   * @return {Builder}
   */
  havingRaw (sql, bindings = [], boolean = 'and') {
    const type = 'Raw'
    this.havings.push({ type, sql, boolean })
    this.addBinding(bindings, 'having')
    return this
  }

  /**
   * Concatenate values of a given column as a string.
   *
   * @param  {string}  column
   * @param  {string}  [glue='']
   * @return {string}
   */
  async implode (column, glue = '') {
    const result = await this.pluck(column)
    return result.implode(glue)
  }

  /**
   * Insert new records into the database.
   *
   * @param  {Array}  values
   * @return {boolean}
   */
  async insert (values) {
    // Since every insert gets treated like a batch insert, we will make sure the
    // bindings are structured in a way that is convenient when building these
    // inserts statements by verifying these elements are actually an array.
    if (Object.keys(values).length === 0 || values.length === 0) {
      return true
    }

    if (!Array.isArray(reset(values)) && !isPlainObject(reset(values)) && !isPlainObject(values)) {
      values = [values]
    }

    this.applyBeforeQueryCallbacks()

    // Finally, we will run this query against the database connection and return
    // the results. We will need to also flatten these bindings before running
    // the query so they are all in one huge, flattened array for execution.
    return await this.connection.insert(this.grammar.compileInsert(this, values), this.cleanBindings(Arr.flatten(values, 1)))
  }

  /**
   * Insert a new record and get the value of the primary key.
   *
   * @param  {Array}  values
   * @param  {string|undefined}  [sequence]
   * @return number
   */
  async insertGetId (values, sequence) {
    this.applyBeforeQueryCallbacks()

    // if (!Array.isArray(reset(values)) && !isPlainObject(values)) {
    if (!Array.isArray(values) && !Array.isArray(reset(values)) && !isPlainObject(values)) {
      values = [values]
    }

    const sql = this.grammar.compileInsertGetId(this, values, sequence)

    values = this.cleanBindings(Arr.flatten(values, 1))

    return this.processor.processInsertGetId(this, sql, values, sequence)
  }

  /**
   * Insert new records into the database while ignoring errors.
   *
   * @param  {Array}  values
   * @return {number}
   */
  async insertOrIgnore (values) {
    if (values.length === 0 || Object.keys(values).length === 0) {
      return 0
    }
    if (!Array.isArray(reset(values)) && !isPlainObject(values)) {
      values = [values]
    }
    this.applyBeforeQueryCallbacks()
    return await this.connection.affectingStatement(this.grammar.compileInsertOrIgnore(this, values), this.cleanBindings(Arr.flatten(values, 1)))
  }

  /**
   * Insert new records into the table using a subquery.
   *
   * @param  {Array}  columns
   * @param  {Function|\Illuminate\Database\Query\Builder|string}  query
   * @return {Promise<number>}
   */
  async insertUsing (columns, query) {
    this.applyBeforeQueryCallbacks()
    const [sql, bindings] = this.createSub(query)
    return await this.connection.affectingStatement(this.grammar.compileInsertUsing(this, columns, sql), this.cleanBindings(bindings))
  }

  /**
   * Determine if the given operator is supported.
   *
   * @param  {string}  operator
   * @return {boolean}
   */
  invalidOperator (operator) {
    return !this.operators.includes(String(operator).toLowerCase()) &&
      !this.grammar.getOperators().includes(String(operator).toLowerCase())
  }

  /**
   * Determine if the given operator and value combination is legal.
   *
   * Prevents using Null values with invalid operators.
   *
   * @param  {string}  operator
   * @param  {any}  value
   * @return {boolean}
   */
  invalidOperatorAndValue (operator, value) {
    return isNil(value) && this.operators.includes(operator) &&
      !['=', '<>', '!='].includes(operator)
  }

  /**
   * Determine if the operator is a bitwise operator.
   *
   * @param  {string}  operator
   * @return {boolean}
   */
  isBitwiseOperator (operator) {
    return this.bitwiseOperators.includes(operator.toLowerCase()) ||
      this.grammar.getBitwiseOperators().includes(operator.toLowerCase())
  }

  /**
   * Determine if the value is a query builder instance or a Closure.
   *
   * @param  {any}  value
   * @return {boolean}
   */
  isQueryable (value) {
    return (value instanceof Builder ||
      value instanceof EloquentBuilder ||
      value instanceof Relation ||
      value instanceof Function)
  }

  /**
   * Add a join clause to the query.
   *
   * @param  {string}  table
   * @param  {Function|string}  first
   * @param  {string|undefined}  [operator]
   * @param  {string|undefined}  [second]
   * @param  {string}  [type=inner]
   * @param  {boolean}  [where=false]
   * @return {this}
   */
  join (table, first, operator, second, type = 'inner', where = false) {
    const join = this.newJoinClause(this, type, table)
    // If the first "column" of the join is really a Closure instance the developer
    // is trying to build a join with a complex "on" clause containing more than
    // one condition, so we'll add the join and call a Closure with the query.
    if (first instanceof Function) {
      first(join)
      this.joins.push(join)
      this.addBinding(join.getBindings(), 'join')
    } else {
      // If the column is simply a string, we can assume the join simply has a basic
      // "on" clause with a single condition. So we will just build the join with
      // this simple join clauses attached to it. There is not a join callback.
      const method = where ? 'where' : 'on'
      this.joins.push(join[method](first, operator, second))
      this.addBinding(join.getBindings(), 'join')
    }
    return this
  }

  /**
   * Add a subquery join clause to the query.
   *
   * @param  {Function|\Illuminate\Database\Query\Builder|\Illuminate\Database\Eloquent\Builder|string}  query
   * @param  {string}  as
   * @param  {Function|string}  first
   * @param  {string|undefined}  operator
   * @param  {string|undefined}  second
   * @param  {string}  [type=inner]
   * @param  {boolean}  [where=false]
   * @return {this}
   *
   * @throws \InvalidArgumentException
   */
  joinSub (query, as, first, operator, second, type = 'inner', where = false) {
    let bindings;
    [query, bindings] = this.createSub(query)
    const expression = '(' + String(query) + ') as ' + this.grammar.wrapTable(as)
    this.addBinding(bindings, 'join')
    return this.join(new Expression(expression), first, operator, second, type, where)
  }

  /**
   * Add a "join where" clause to the query.
   *
   * @param  {string}  table
   * @param  {Function|string}  first
   * @param  {string}  operator
   * @param  {string}  second
   * @param  {string}  [type=inner]
   * @return {this}
   */
  joinWhere (table, first, operator, second, type = 'inner') {
    return this.join(table, first, operator, second, type, true)
  }

  /**
   * Set the "limit" value of the query.
   *
   * @param  {number}  value
   * @return {this}
   */
  limit (value) {
    const property = this.unions.length > 0 ? 'unionLimit' : 'limitProperty'
    if (value >= 0) {
      this[property] = value
    }
    return this
  }

  /**
   * Add a left join to the query.
   *
   * @param  {string}  table
   * @param  {Function|string}  first
   * @param  {string}  [operator]
   * @param  {string}  [second]
   * @return {this}
   */
  leftJoin (table, first, operator, second) {
    return this.join(table, first, operator, second, 'left')
  }

  /**
   * Add a subquery left join to the query.
   *
   * @param  {Function|\Illuminate\Database\Query\Builder|\Illuminate\Database\Eloquent\Builder|string}  query
   * @param  {string}  as
   * @param  {Function|string}  first
   * @param  {string}  operator
   * @param  {string}  {second}
   * @return {this}
   */
  leftJoinSub (query, as, first, operator, second) {
    return this.joinSub(query, as, first, operator, second, 'left')
  }

  /**
   * Add a "join where" clause to the query.
   *
   * @param  {string}  table
   * @param  {Function|string}  first
   * @param  {string}  operator
   * @param  {string}  second
   * @return {this}
   */
  leftJoinWhere (table, first, operator, second) {
    return this.joinWhere(table, first, operator, second, 'left')
  }

  /**
   * Retrieve the maximum value of a given column.
   *
   * @param  {string}  column
   * @return {*}
   */
  max (column) {
    return this.aggregate('max', [column])
  }

  /**
   * Merge an array of bindings into our bindings.
   *
   * @param  {\Illuminate\Database\Query\Builder}  query
   * @return {this}
   */
  mergeBindings (query) {
    for (const [key, value] of Object.entries(query.bindings)) {
      this.bindings[key] = this.bindings[key].concat(value)
    }
    return this
  }

  /**
   * Retrieve the minimum value of a given column.
   *
   * @param  {string}  column
   * @return {*}
   */
  min (column) {
    return this.aggregate('min', [column])
  }

  /**
   * Get a new join clause.
   *
   * @param  {\Illuminate\Database\Query\Builder}  parentQuery
   * @param  {string}  type
   * @param  {string}  table
   * @return {\Illuminate\Database\Query\JoinClause}
   */
  newJoinClause (parentQuery, type, table) {
    return new JoinClause(parentQuery, type, table)
  }

  /**
   * Get a new instance of the query builder.
   *
   * @return {\Illuminate\Database\Query\Builder}
   */
  newQuery () {
    return new Builder(this.connection, this.grammar, this.processor)
  }

  /**
   * Set the "offset" value of the query.
   *
   * @param  {number}  value
   * @return {this}
   */
  offset (value) {
    const property = this.unions.length > 0 ? 'unionOffset' : 'offsetProperty'
    this[property] = Math.max(0, value)
    return this
  }

  /**
   * Execute the given callback while selecting the given columns.
   *
   * After running the callback, the columns are reset to the original value.
   *
   * @param  {Array<string | Expression>}  columns
   * @param  {Function}  callback
   * @return {any}
   */
  async onceWithColumns (columns, callback) {
    const original = this.columns

    if (original.length === 0) {
      this.columns = columns
    }

    const result = await callback()

    this.columns = original

    return result
  }

  /**
   * Add an "order by" clause to the query.
   *
   * @param  {Function|\Illuminate\Database\Query\Builder|\Illuminate\Database\Query\Expression|string}  column
   * @param  {string}  [direction=asc]
   * @return {this}
   *
   * @throws {\InvalidArgumentException}
   */
  orderBy (column, direction = 'asc') {
    if (this.isQueryable(column)) {
      const [query, bindings] = this.createSub(column)
      column = new Expression('(' + query + ')')
      this.addBinding(bindings, this.unions?.length > 0 ? 'unionOrder' : 'order')
    }
    direction = direction.toLowerCase()
    if (!['asc', 'desc'].includes(direction)) {
      throw new Error('InvalidArgumentException: Order direction must be "asc" or "desc".')
    }
    this[this.unions.length > 0 ? 'unionOrders' : 'orders'].push({
      column,
      direction
    })
    return this
  }

  /**
   * Add a descending "order by" clause to the query.
   *
   * @param  {Function|\Illuminate\Database\Query\Builder|\Illuminate\Database\Query\Expression|string}  column
   * @return {this}
   */
  orderByDesc (column) {
    return this.orderBy(column, 'desc')
  }

  /**
   * Add a raw "order by" clause to the query.
   *
   * @param  {string}  sql
   * @param  {Array}  bindings
   * @return {this}
   */
  orderByRaw (sql, bindings = []) {
    const type = 'Raw'
    this[this.unions.length > 0 ? 'unionOrders' : 'orders'].push({ type, sql })
    this.addBinding(bindings, this.unions.length > 0 ? 'unionOrder' : 'order')
    return this
  }

  /**
   * Add an "or having" clause to the query.
   *
   * @param  {Function | string}  column
   * @param  {string}  [operator]
   * @param  {string}  [value]
   * @return {this}
   */
  orHaving (column, operator, value) {
    [value, operator] = this.prepareValueAndOperator(value, operator, arguments.length === 2)
    return this.having(column, operator, value, 'or')
  }

  /**
   * Add an "or having not null" clause to the query.
   *
   * @param  {string}  column
   * @return {this}
   */
  orHavingNotNull (column) {
    return this.havingNotNull(column, 'or')
  }

  /**
   * Add an "or having null" clause to the query.
   *
   * @param  {string}  column
   * @return {this}
   */
  orHavingNull (column) {
    return this.havingNull(column, 'or')
  }

  /**
   * Add a raw or having clause to the query.
   *
   * @param  {string}  sql
   * @param  {any}  [bindings=[]]
   * @return {this}
   */
  orHavingRaw (sql, bindings = []) {
    return this.havingRaw(sql, bindings, 'or')
  }

  /**
   * Add an "or where" clause to the query.
   *
   * @param  {Function|string|Array}  column
   * @param  {any}  operator
   * @param  {any}  value
   * @return {this}
   */
  orWhere (column, operator, value) {
    [value, operator] = this.prepareValueAndOperator(value, operator, arguments.length === 2)
    return this.where(column, operator, value, 'or')
  }

  /**
   * Add an "or where" clause comparing two columns to the query.
   *
   * @param  {string|string[]}  first
   * @param  {string}  [operator]
   * @param  {string}  [second]
   * @return {this}
   */
  orWhereColumn (first, operator, second) {
    return this.whereColumn(first, operator, second, 'or')
  }

  /**
   * Add an "or where date" statement to the query.
   *
   * @param  {string}  column
   * @param  {any}  operator
   * @param  {Date|string|undefined}  value
   * @return {this}
   */
  orWhereDate (column, operator, value) {
    [value, operator] = this.prepareValueAndOperator(value, operator, arguments.length === 2)
    return this.whereDate(column, operator, value, 'or')
  }

  /**
   * Add an "or where day" statement to the query.
   *
   * @param  {string}  column
   * @param  {string}  operator
   * @param {Date|unknown} [value]
   * @return {this}
   * @memberof Builder
   */
  orWhereDay (column, operator, value) {
    [value, operator] = this.prepareValueAndOperator(value, operator, arguments.length === 2)
    return this.whereDay(column, operator, value, 'or')
  }

  /**
   * Add an or exists clause to the query.
   *
   * @param  {Function}  callback
   * @param  {boolean}  [not=false]
   * @return {this}
   */
  orWhereExists (callback, not = false) {
    return this.whereExists(callback, 'or', not)
  }

  /**
   * Add an "or where in" clause to the query.
   *
   * @param  {string}  column
   * @param  {any}  values
   * @return {this}
   */
  orWhereIn (column, values) {
    return this.whereIn(column, values, 'or')
  }

  /**
   * Add an "or where in raw" clause for integer values to the query.
   *
   * @param  {string}  column
   * @param  {any}  values
   * @return {this}
   */
  orWhereIntegerInRaw (column, values) {
    return this.whereIntegerInRaw(column, values, 'or')
  }

  /**
   * Add an "or where not in raw" clause for integer values to the query.
   *
   * @param  {string}  column
   * @param  {any}  values
   * @return {this}
   */
  orWhereIntegerNotInRaw (column, values) {
    return this.whereIntegerNotInRaw(column, values, 'or')
  }

  /**
   * Add an "or where month" statement to the query.
   *
   * @param  {string}  column
   * @param  {any}  operator
   * @param  {Date|unknown}  [value]
   * @return {this}
   */
  orWhereMonth (column, operator, value) {
    [value, operator] = this.prepareValueAndOperator(value, operator, arguments.length === 2)
    return this.whereMonth(column, operator, value, 'or')
  }

  /**
   * Add an "or where not" clause to the query.
   *
   * @param  {Function|string|any[]}  column
   * @param  {any}  operator
   * @param  {any}  value
   * @return {this}
   */
  orWhereNot (column, operator, value) {
    return this.whereNot(column, operator, value, 'or')
  }

  /**
   * Add a where not exists clause to the query.
   *
   * @param  {Function}  callback
   * @return {this}
   */
  orWhereNotExists (callback) {
    return this.orWhereExists(callback, true)
  }

  /**
   * Add an "or where not in" clause to the query.
   *
   * @param  {string}  column
   * @param  {any}  values
   * @return {this}
   */
  orWhereNotIn (column, values) {
    return this.whereNotIn(column, values, 'or')
  }

  /**
   * Add an "or where not null" clause to the query.
   *
   * @param  {string} column
   * @return {this}
   */
  orWhereNotNull (column) {
    return this.whereNotNull(column, 'or')
  }

  /**
   * Add an "or where null" clause to the query.
   *
   * @param  {string}  column
   * @return {this}
   */
  orWhereNull (column) {
    return this.whereNull(column, 'or')
  }

  /**
   * Add a raw or where clause to the query.
   *
   * @param  {string}  sql
   * @param  {any}  bindings
   * @return {this}
   */
  orWhereRaw (sql, bindings = []) {
    return this.whereRaw(sql, bindings, 'or')
  }

  /**
   * Add an "or where year" statement to the query.
   *
   * @param  {string}  column
   * @param  {string}  operator
   * @param  {Date|string|number}  [value]
   * @return {Builder}
   */
  orWhereYear (column, operator, value) {
    [value, operator] = this.prepareValueAndOperator(value, operator, arguments.length === 2)
    return this.whereYear(column, operator, value, 'or')
  }

  /**
   * Parse the subquery into SQL and bindings.
   *
   * @param  {any}  query
   * @return {Array}
   *
   * @throws {\InvalidArgumentException}
   */
  parseSub (query) {
    if (query instanceof Builder ||
      query instanceof this.constructor ||
      query instanceof EloquentBuilder ||
      query instanceof Relation) {
      query = this.prependDatabaseNameIfCrossDatabaseQuery(query)
      return [query.toSql(), query.getBindings()]
    } else if (typeof query === 'string') {
      return [query, []]
    } else {
      throw new Error('InvalidArgumentException: A subquery must be a query builder instance, a Closure, or a string.')
    }
  }

  /**
   * Get an array with the values of a given column.
   *
   * @param  {string}  column
   * @param  {string|undefined}  key
   * @return {\Illuminate\Support\Collection}
   */
  async pluck (column, key) {
    // First, we will need to select the results of the query accounting for the
    // given columns / key. Once we have the results, we will be able to take
    // the results and get the exact data that was requested for the query.
    const queryResult = await this.onceWithColumns(isFalsy(key) ? [column] : [column, key], () => {
      return this.processor.processSelect(this, this.runSelect())
    })
    if (queryResult.length === 0) {
      return collect()
    }
    // If the columns are qualified with a table or have an alias, we cannot use
    // those directly in the "pluck" operations since the results from the DB
    // are only keyed by the column itself. We'll strip the table out here.
    column = this.stripTableForPluck(column)
    key = this.stripTableForPluck(key)
    return this.pluckFromObjectColumn(queryResult, column, key)
  }

  /**
   * Retrieve column values from rows represented as objects.
   *
   * @param  {any[]}  queryResult
   * @param  {string}  column
   * @param  {string}  key
   * @return {\Illuminate\Support\Collection}
   */
  pluckFromObjectColumn (queryResult, column, key) {
    let results
    if (isFalsy(key)) {
      results = []
      for (const row of queryResult) {
        results.push(row[column])
      }
    } else {
      results = {}
      for (const row of queryResult) {
        results[row[key]] = row[column]
      }
    }
    return collect(results)
  }

  /**
   * Prepare the value and operator for a where clause.
   *
   * @param  {Date|string|number|undefined}  value
   * @param  {string}  operator
   * @param  {boolean}  useDefault
   * @return {Array}
   *
   * @throws {\InvalidArgumentException}
   */
  prepareValueAndOperator (value, operator, useDefault = false) {
    if (useDefault) {
      return [operator, '=']
    } else if (this.invalidOperatorAndValue(operator, value)) {
      throw new TypeError('InvalidArgumentException: Illegal operator and value combination.')
    }
    return [value, operator]
  }

  /**
   * Prepend the database name if the given query is on another database.
   *
   * @param  {any}  query
   * @return {any}
   */
  prependDatabaseNameIfCrossDatabaseQuery (query) {
    if (query.getConnection().getDatabaseName() !== this.getConnection().getDatabaseName()) {
      const databaseName = query.getConnection().getDatabaseName()
      if (query.fromProperty.startsWith(databaseName) === false && query.fromProperty.includes('.') === false) {
        query.from(databaseName + '.' + query.fromProperty)
      }
    }
    return query
  }

  /**
   * Remove all existing orders and optionally add a new order.
   *
   * @param  {string}  [column]
   * @param  {string}  [direction=asc]
   * @return {this}
   */
  reorder (column = '', direction = 'asc') {
    this.orders = []
    this.unionOrders = []
    this.bindings.order = []
    this.bindings.unionOrder = []
    if (isTruthy(column)) {
      return this.orderBy(column, direction)
    }
    return this
  }

  /**
   * Add a subquery right join to the query.
   *
   * @param  {Function|\Illuminate\Database\Query\Builder|\Illuminate\Database\Eloquent\Builder|string}  query
   * @param  {string}  as
   * @param  {Function|string}  first
   * @param  {string|undefined}  [operator=undefined]
   * @param  {string|undefined}  [second=undefined]
   * @return {this}
   */
  rightJoinSub (query, as, first, operator, second) {
    return this.joinSub(query, as, first, operator, second, 'right')
  }

  /**
   * Run a pagination count query.
   *
   * @param  {Array}  columns
   * @return {Array}
   */
  async runPaginationCountQuery (columns = ['*']) {
    // We need to save the original bindings, because the cloneWithoutBindings
    // method delete them from the builder object
    const bindings = clone(this.bindings)
    if (this.groups.length > 0 || this.havings.length > 0) {
      const clone = this.cloneForPaginationCount()
      if (clone.columns.length === 0 && this.joins.length > 0) {
        clone.select(String(this.fromProperty) + '.*')
      }
      const result = await this.newQuery()
        .from(new Expression('(' + clone.toSql() + ') as ' + this.grammar.wrap('aggregate_table')))
        .mergeBindings(clone)
        .setAggregate('count', this.withoutSelectAliases(columns))
        .get()
      this.bindings = bindings
      return result.all()
    }
    const without = this.unions.length > 0
      ? ['orders', 'limitProperty', 'offsetProperty']
      : ['columns', 'orders', 'limitProperty', 'offsetProperty']
    const result = await this.cloneWithout(without)
      .cloneWithoutBindings(this.unions.length > 0 ? ['order'] : ['select', 'order'])
      .setAggregate('count', this.withoutSelectAliases(columns))
      .get()
    this.bindings = bindings
    return result.all()
  }

  /**
   * Run the query as a "select" statement against the connection.
   *
   * @return {Array}
   */
  runSelect () {
    return this.connection.select(this.toSql(), this.getBindings())
  }

  /**
   * Set the columns to be selected.
   *
   * @param {Array|any} columns
   * @return {this}
   * @memberof Builder
   */
  select (...columns) {
    columns = columns.length === 0 ? ['*'] : columns
    this.columns = []
    this.bindings.select = []
    for (const [as, column] of Arr.iterable(columns)) {
      if (isString(as) && this.isQueryable(column)) {
        this.selectSub(column, as)
      } else {
        this.columns.push(column)
      }
    }
    return this
  }

  /**
 * Add a new "raw" select expression to the query.
 *
 * @param  {string}  expression
 * @param  {array}  bindings
 * @return {this}
 */
  selectRaw (expression, bindings = []) {
    this.addSelect(new Expression(expression))
    if (bindings.length > 0) {
      this.addBinding(bindings, 'select')
    }
    return this
  }

  /**
   * Add a subselect expression to the query.
   *
   * @param {Function|\Illuminate\Database\Query\Builder|\Illuminate\Database\Eloquent\Builder|string}  query
   * @param {string}  as
   * @return {this}
   *
   * @throws {\InvalidArgumentException}
   */
  selectSub (query, as) {
    const [querySub, bindings] = this.createSub(query)
    return this.selectRaw('(' + querySub + ') as ' + this.grammar.wrap(as), bindings)
  }

  /**
   * Set the aggregate property without running the query.
   *
   * @param  {string}  functionName
   * @param  {Array}  columns
   * @return {this}
   */
  setAggregate (functionName, columns) {
    this.aggregateProperty = { function: functionName, columns }
    if (this.groups.length === 0) {
      this.orders = []
      this.bindings.order = []
    }
    return this
  }

  /**
   * Alias to set the "offset" value of the query.
   *
   * @param  {number}  value
   * @return {Builder}
   */
  skip (value) {
    return this.offset(value)
  }

  /**
   * Strip off the table name or alias from a column identifier.
   *
   * @param  {string}  column
   * @return {string|undefined}
   */
  stripTableForPluck (column) {
    if (isFalsy(column)) {
      return column
    }
    const separator = String(column).toLowerCase().includes(' as ') ? ' as ' : '\\.'
    return last(String(column).split('~' + separator + '~i'))
  }

  /**
   * Retrieve the sum of the values of a given column.
   *
   * @param  {string}  column
   * @return {*}
   */
  async sum (column) {
    const result = await this.aggregate('sum', [column])
    return result ?? 0
  }

  /**
   * Alias to set the "limit" value of the query.
   *
   * @param  {number}  value
   * @return {Builder}
   */
  take (value) {
    return this.limit(value)
  }

  /**
   * Get the SQL representation of the query.
   *
   * @return {string}
   */
  toSql () {
    this.applyBeforeQueryCallbacks()
    return this.grammar.compileSelect(this)
  }

  /**
   * Add a union statement to the query.
   *
   * @param  {\Illuminate\Database\Query\Builder|Function}  query
   * @param  {boolean}  [all=false]
   * @return {this}
   */
  union (query, all = false) {
    if (query instanceof Function) {
      const callback = query
      query = this.newQuery()
      callback(query)
    }
    this.unions.push({ query, all })
    this.addBinding(query.getBindings(), 'union')
    return this
  }

  /**
   * Add a union all statement to the query.
   *
   * @param  {\Illuminate\Database\Query\Builder|Function}  query
   * @return {this}
   */
  unionAll (query) {
    return this.union(query, true)
  }

  /**
   * Get a single column's value from the first result of a query.
   *
   * @param  {string}  column
   * @return {*}
   */
  async value (column) {
    const result = await this.first([column])
    return result.length > 0 || Object.keys(result).length > 0 ? reset(result) : undefined
  }

  /**
   * Add a basic where clause to the query.
   *
   * @param  {Function|string|Expression|any[]|Record<string, unknown>}  column
   * @param  {any}  [operator]
   * @param  {any}  [value]
   * @param  {string}  boolean
   * @return {this}
   */
  where (column, operator, value, boolean = 'and') {
    // If the column is an array, we will assume it is an array of key-value pairs
    // and can add them each as a where clause. We will maintain the boolean we
    // received when the method was called and pass it into the nested where.
    if (Array.isArray(column) || isPlainObject(column)) {
      return this.addArrayOfWheres(column, boolean)
    }
    // Here we will make some assumptions about the operator. If only 2 values are
    // passed to the method, we will assume that the operator is an equals sign
    // and keep going. Otherwise, we'll require the operator to be passed in.
    [value, operator] = this.prepareValueAndOperator(value, operator, arguments.length === 2)
    // If the columns is actually a Closure instance, we will assume the developer
    // wants to begin a nested where statement which is wrapped in parenthesis.
    // We'll add that Closure to the query then return back out immediately.
    if (column instanceof Function && isFalsy(operator)) {
      return this.whereNested(column, boolean)
    }
    // If the column is a Closure instance and there is an operator value, we will
    // assume the developer wants to run a subquery and then compare the result
    // of that subquery with the given value that was provided to the method.
    if (this.isQueryable(column) && isTruthy(operator)) {
      const [sub, bindings] = this.createSub(column)
      return this.addBinding(bindings, 'where')
        .where(new Expression('(' + sub + ')'), operator, value, boolean)
    }
    // If the given operator is not found in the list of valid operators we will
    // assume that the developer is just short-cutting the '=' operators and
    // we will set the operators to '=' and set the values appropriately.
    if (this.invalidOperator(operator)) {
      [value, operator] = [operator, '=']
    }
    // If the value is a Closure, it means the developer is performing an entire
    // sub-select within the query and we will need to compile the sub-select
    // within the where clause to get the appropriate query record results.
    if (value instanceof Function) {
      return this.whereSub(column, operator, value, boolean)
    }
    // If the value is "null", we will just assume the developer wants to add a
    // where null clause to the query. So, we will allow a short-cut here to
    // that method for convenience so the developer doesn't have to check.
    if (value === null) {
      return this.whereNull(column, boolean, operator !== '=')
    }
    let type = 'Basic'
    // If the column is making a JSON reference we'll check to see if the value
    // is a boolean. If it is, we'll add the raw boolean string as an actual
    // value to the query to ensure this is properly handled by the query.
    if (String(column).includes('->') && isBoolean(value)) {
      value = new Expression(isTruthy(value) ? 'true' : 'false')
      if (isString(column)) {
        type = 'JsonBoolean'
      }
    }
    // Now that we are working with just a simple query we can put the elements
    // in our array and add the query binding to our array of bindings that
    // will be bound to each SQL statements when it is finally executed.
    this.wheres.push({
      type, column, operator, value, boolean
    })
    if (!(value instanceof Expression)) {
      this.addBinding(this.flattenValue(value), 'where')
    }
    return this
  }

  /**
   * Add a where between statement to the query.
   *
   * @param  {\Illuminate\Database\Query\Expression|string}  column
   * @param  {any[]}  values
   * @param  {string}  boolean
   * @param  {boolean}  not
   * @return {this}
   */
  whereBetween (column, values, boolean = 'and', not = false) {
    const type = 'Between'
    this.wheres.push({ type, column, values, boolean, not })
    const flatten = Arr.flatten(values)
    this.addBinding(this.cleanBindings(flatten).slice(0, 2), 'where')
    return this
  }

  /**
   * Add a where between statement using columns to the query.
   *
   * @param  {string}  column
   * @param  {any[]}  values
   * @param  {string}  boolean
   * @param  {boolean}  not
   * @return {this}
   */
  whereBetweenColumns (column, values, boolean = 'and', not = false) {
    const type = 'BetweenColumns'
    this.wheres.push({ type, column, values, boolean, not })
    return this
  }

  /**
   * Add a "where" clause comparing two columns to the query.
   *
   * @param  {string|array}  first
   * @param  {string}  [operator]
   * @param  {string}  [second]
   * @param  {string}  [boolean=and]
   * @return {this}
   */
  whereColumn (first, operator, second, boolean = 'and') {
    // If the column is an array, we will assume it is an array of key-value pairs
    // and can add them each as a where clause. We will maintain the boolean we
    // received when the method was called and pass it into the nested where.
    if (Array.isArray(first)) {
      return this.addArrayOfWheres(first, boolean, 'whereColumn')
    }
    // If the given operator is not found in the list of valid operators we will
    // assume that the developer is just short-cutting the '=' operators and
    // we will set the operators to '=' and set the values appropriately.
    if (this.invalidOperator(operator)) {
      [second, operator] = [operator, '=']
    }
    // Finally, we will add this where clause into this array of clauses that we
    // are building for the query. All of them will be compiled via a grammar
    // once the query is about to be executed and run against the database.
    const type = 'Column'
    this.wheres.push({
      type, first, operator, second, boolean
    })
    return this
  }

  /**
   * Add a "where date" statement to the query.
   *
   * @param  {string}  column
   * @param  {any}  operator
   * @param  {Date|unknown}  [value]
   * @param  {string}  [boolean]
   * @return {this}
   */
  whereDate (column, operator, value, boolean = 'and') {
    [value, operator] = this.prepareValueAndOperator(value, operator, arguments.length === 2)
    value = this.flattenValue(value)
    if (value instanceof Date) {
      value = dateFormat(value, 'YYYY-MM-dd')
    }
    return this.addDateBasedWhere('Date', column, operator, value, boolean)
  }

  /**
   * Add a "where day" statement to the query.
   *
   * @param  {string}  column
   * @param  {any}  operator
   * @param  {Date|unknown}  value
   * @param  {string}  boolean
   * @return {this}
   * @memberof Builder
   */
  whereDay (column, operator, value, boolean = 'and') {
    [value, operator] = this.prepareValueAndOperator(value, operator, arguments.length === 2)
    value = this.flattenValue(value)
    if (value instanceof Date) {
      value = dateFormat(value, 'dd')
    }
    return this.addDateBasedWhere('Day', column, operator, value, boolean)
  }

  /**
   * Add an exists clause to the query.
   *
   * @param  {Function}  callback
   * @param  {string}  [boolean=and]
   * @param  {boolean}  [not=false]
   * @return {this}
   */
  whereExists (callback, boolean = 'and', not = false) {
    const query = this.forSubQuery()
    // Similar to the sub-select clause, we will create a new query instance so
    // the developer may cleanly specify the entire exists query and we will
    // compile the whole thing in the grammar and insert it into the SQL.
    callback(query)
    return this.addWhereExistsQuery(query, boolean, not)
  }

  /**
   * Add a "where fulltext" clause to the query.
   *
   * @param  {string|string[]}  columns
   * @param  {string}  value
   * @param  {any[]}  options
   * @param  {string}  boolean
   * @return {this}
   */
  whereFulltext (columns, value, options = {}, boolean = 'and') {
    const type = 'Fulltext'
    columns = castArray(columns)
    this.wheres.push({ type, columns, value, options, boolean })
    this.addBinding(value)
    return this
  }

  /**
   * Add a "where in" clause to the query.
   * @param  {string}  column
   * @param  {any}  values
   * @param  {string}  boolean
   * @param  {boolean}  [not=false]
   * @return {this}
   */
  whereIn (column, values, boolean = 'and', not = false) {
    const type = not ? 'NotIn' : 'In'
    // If the value is a query builder instance we will assume the developer wants to
    // look for any values that exists within this given query. So we will add the
    // query accordingly so that this query is properly executed when it is run.
    if (this.isQueryable(values)) {
      const [query, bindings] = this.createSub(values)
      values = [new Expression(query)]
      this.addBinding(bindings, 'where')
    }
    this.wheres.push({ type, column, values, boolean })
    // Finally we'll add a binding for each values unless that value is an expression
    // in which case we will just skip over it since it will be the query as a raw
    // string and not as a parameterized place-holder to be replaced by the PDO.
    this.addBinding(this.cleanBindings(values), 'where')
    return this
  }

  /**
   * Add a "where in raw" clause for integer values to the query.
   *
   * @param  {string}  column
   * @param  {Array}  values
   * @param  {string}  [boolean=and]
   * @param  {boolean}  [not=false]
   * @return {this}
   */
  whereIntegerInRaw (column, values, boolean = 'and', not = false) {
    const type = not ? 'NotInRaw' : 'InRaw'
    values = values.map(value => parseInt(value, 10))
    this.wheres.push({ type, column, values, boolean })
    return this
  }

  /**
   * Add a "where not in raw" clause for integer values to the query.
   *
   * @param  {string}  column
   * @param  {Array}  values
   * @param  {string}  boolean
   * @return {this}
   */
  whereIntegerNotInRaw (column, values, boolean = 'and') {
    return this.whereIntegerInRaw(column, values, boolean, true)
  }

  /**
   * Add a "where month" statement to the query.
   *
   * @param  {string}  column
   * @param  {any}  operator
   * @param  {Date|unknown}  [value]
   * @param  {string}  boolean
   * @return {this}
   */
  whereMonth (column, operator, value, boolean = 'and') {
    [value, operator] = this.prepareValueAndOperator(value, operator, arguments.length === 2)
    value = this.flattenValue(value)
    if (value instanceof Date) {
      value = dateFormat(value, 'MM')
    }
    if (!(value instanceof Expression)) {
      value = String(value).padStart(2, '0')
    }
    return this.addDateBasedWhere('Month', column, operator, value, boolean)
  }

  /**
   * Add a nested where statement to the query.
   *
   * @param  {Function}  callback
   * @param  {string}  [boolean='and']
   * @return {this}
   */
  whereNested (callback, boolean = 'and') {
    const query = this.forNestedWhere()
    callback(query)
    return this.addNestedWhereQuery(query, boolean)
  }

  /**
   * Add a basic "where not" clause to the query.
   *
   * @param  {Function|string|any[]}  column
   * @param  {any}  operator
   * @param  {any}  value
   * @param  {string}  boolean
   * @return {this}
   */
  whereNot (column, operator, value, boolean = 'and') {
    return this.where(column, operator, value, boolean + ' not')
  }

  /**
   * Add a where not between statement to the query.
   *
   * @param  {string}  column
   * @param  {any[]}  values
   * @param  {string}  boolean
   * @return {this}
   */
  whereNotBetween (column, values, boolean = 'and') {
    return this.whereBetween(column, values, boolean, true)
  }

  /**
   * Add a where not between statement using columns to the query.
   *
   * @param  {string}  column
   * @param  {any[]}  values
   * @param  {string}  boolean
   * @return {this}
   */
  whereNotBetweenColumns (column, values, boolean = 'and') {
    return this.whereBetweenColumns(column, values, boolean, true)
  }

  /**
   * Add a where not exists clause to the query.
   *
   * @param  {Function}  callback
   * @param  {string}  [boolean=and]
   * @return {this}
   */
  whereNotExists (callback, boolean = 'and') {
    return this.whereExists(callback, boolean, true)
  }

  /**
   * Add a "where not in" clause to the query.
   *
   * @param  {string}  column
   * @param  {any}  values
   * @param  {string}  boolean
   * @return {this}
   */
  whereNotIn (column, values, boolean = 'and') {
    return this.whereIn(column, values, boolean, true)
  }

  /**
   * Add a "where not null" clause to the query.
   *
   * @param  {string|Array}  columns
   * @param  {string}  [boolean=and]
   * @return {this}
   */
  whereNotNull (columns, boolean = 'and') {
    return this.whereNull(columns, boolean, true)
  }

  /**
   * Add a "where null" clause to the query.
   *
   * @param  {string|Array}  columns
   * @param  {string}  [boolean=and]
   * @param  {boolean}  [not=false]
   * @return {this}
   */
  whereNull (columns, boolean = 'and', not = false) {
    const type = not ? 'NotNull' : 'Null'
    for (const column of Arr.wrap(columns)) {
      this.wheres.push({ type, column, boolean })
    }
    return this
  }

  /**
   * Add a raw where clause to the query.
   *
   * @param  {string}  sql
   * @param  {any}  bindings
   * @param  {string}  boolean
   * @return {this}
   */
  whereRaw (sql, bindings = [], boolean = 'and') {
    this.wheres.push({ type: 'Raw', sql, boolean })
    this.addBinding(bindings, 'where')
    return this
  }

  /**
   * Add a full sub-select to the query.
   *
   * @param  {string}  column
   * @param  {string}  operator
   * @param  {Function}  callback
   * @param  {string}  boolean
   * @return {this}
   */
  whereSub (column, operator, callback, boolean) {
    const type = 'Sub'
    // Once we have the query instance we can simply execute it so it can add all
    // of the sub-select's conditions to itself, and then we can cache it off
    // in the array of where clauses for the "main" parent query instance.
    const query = this.forSubQuery()
    callback(query)
    this.wheres.push({
      type, column, operator, query, boolean
    })
    this.addBinding(query.getBindings(), 'where')
    return this
  }

  /**
   * Add a "where time" statement to the query.
   *
   * @param  {string}  column
   * @param  {string}  operator
   * @param  {Date|string}  [value]
   * @param  {string}  [boolean=and]
   * @return {this}
   */
  whereTime (column, operator, value, boolean = 'and') {
    [value, operator] = this.prepareValueAndOperator(value, operator, arguments.length === 2)
    value = this.flattenValue(value)
    if (value instanceof Date) {
      value = dateFormat(value, 'HH:mm:ss')
    }
    return this.addDateBasedWhere('Time', column, operator, value, boolean)
  }

  /**
   * Add a "where year" statement to the query.
   *
   * @param  {string}  column
   * @param  {string}  operator
   * @param  {Date|unknown}  value
   * @param  {string}  boolean
   * @return {this}
   */
  whereYear (column, operator, value, boolean = 'and') {
    [value, operator] = this.prepareValueAndOperator(value, operator, arguments.length === 2)
    value = this.flattenValue(value)
    if (value instanceof Date) {
      value = dateFormat(value, 'YYYY')
    }
    return this.addDateBasedWhere('Year', column, operator, value, boolean)
  }

  /**
   * Remove the column aliases since they will break count queries.
   *
   * @param  {any[]}  columns
   * @return {any[]}
   */
  withoutSelectAliases (columns) {
    return columns.map((column) => {
      const aliasPosition = column.toLowerCase().indexOf(' as ')
      return isString(column) && aliasPosition !== -1
        ? column.substr(0, aliasPosition)
        : column
    })
  }
}

import { clone, isFalsy, isNil, isTruthy, merge } from '@devnetic/utils'

import { collect } from '../../Collections/helpers.js'
import { instanceProxy } from '../../Support/Proxies/InstanceProxy.js'
import ForwardsCalls from '../../Support/Traits/ForwardsCalls.js'
import use from '../../Support/Traits/use.js'
import BuildsQueries from '../Concerns/BuildsQueries.js'
import Scope from './Scope.js'

export default class Builder {
  /**
   * All of the globally registered builder macros.
   *
   * @var Record<string, any>
   */
  static { this.macros = {} }

  /**
   * Create a new Eloquent query builder instance.
   *
   * @param  {\Illuminate\Database\Query\Builder}  query
   * @return {void}
   */
  constructor (query) {
    use(this.constructor, [BuildsQueries, ForwardsCalls])

    /**
     * All of the locally registered builder macros.
     *
     * @var Record<string, any>
     */
    this.localMacros = {}

    /**
     * The model being queried.
     *
     * @var \Illuminate\Database\Eloquent\Model
     */

    this.model = null

    /**
     * The methods that should be returned from query builder.
     *
     * @var string[]
     */
    this.passthru = [
      'aggregate',
      'average',
      'avg',
      'count',
      'dd',
      'doesntExist',
      'dump',
      'exists',
      'explain',
      'getBindings',
      'getConnection',
      'getGrammar',
      'insert',
      'insertGetId',
      'insertOrIgnore',
      'insertUsing',
      'max',
      'min',
      'raw',
      'sum',
      'toSql'
    ]

    /**
     * Applied global scopes.
     *
     * @var Record<string, any>
     */
    this.scopes = {}

    this.query = query

    return instanceProxy(this)
  }

  /**
   * Dynamically handle calls into the query instance.
   *
   * @param  {string}  method
   * @param  {any[]}  parameters
   * @return {any}
   */
  __call (method, ...parameters) {
    if (method === 'macro') {
      this.localMacros[parameters[0]] = parameters[1]
      return
    }

    if (this.hasMacro(method)) {
      parameters.unshift(this)
      return this.localMacros[method](...parameters)
    }

    if (Builder.hasGlobalMacro(method)) {
      let callable = Builder.macros[method]
      if (callable instanceof Function) {
        callable = callable.bindTo(this, this.constructor)
      }
      return callable(...parameters)
    }

    if (this.hasNamedScope(method)) {
      return this.callNamedScope(method, parameters)
    }

    if (this.passthru.includes(method)) {
      return this.toBase()[method](...parameters)
    }

    this.forwardCallTo(this.query, method, parameters)

    return this
  }

  /**
   * Nest where conditions by slicing them at the given where count.
   *
   * @param  {\Illuminate\Database\Query\Builder}  query
   * @param  {number}  originalWhereCount
   * @return {void}
   */
  addNewWheresWithinGroup (query, originalWhereCount) {
    // Here, we totally remove all of the where clauses since we are going to
    // rebuild them as nested queries by slicing the groups of wheres into
    // their own sections. This is to prevent any confusing logic order.
    const allWheres = query.wheres

    query.wheres = []

    this.groupWhereSliceForScope(query, allWheres.slice(0, originalWhereCount))

    this.groupWhereSliceForScope(query, allWheres.slice(originalWhereCount))
  }

  /**
    * Apply the scopes to the Eloquent builder instance and return it.
    *
    * @return {static}
    */
  applyScopes () {
    if (Object.keys(this.scopes).length === 0) {
      return this
    }

    const builder = clone(this)
    for (const [identifier, scope] of Object.entries(this.scopes)) {
      if (isFalsy(builder.scopes[identifier])) {
        continue
      }

      builder.callScope((builder) => {
        // If the scope is a Closure we will just go ahead and call the scope with the
        // builder instance. The "callScope" method will properly group the clauses
        // that are added to this query so "where" clauses maintain proper logic.
        if (scope instanceof Function) {
          scope(builder)
        }

        // If the scope is a scope object, we will call the apply method on this scope
        // passing in the builder and the model instance. After we run all of these
        // scopes we will return back the builder instance to the outside caller.
        if (scope instanceof Scope) {
          scope.apply(builder, this.getModel())
        }
      })
    }

    return builder
  }

  /**
   * Apply the given named scope on the current builder instance.
   *
   * @param  {string}  scope
   * @param  {any[]}  parameters
   * @return {any}
   */
  callNamedScope (scope, parameters = []) {
    return this.callScope((...parameters) => {
      return this.model?.callNamedScope(scope, parameters)
    }, parameters)
  }

  /**
   * Apply the given scope on the current builder instance.
   *
   * @param  {Function}  scope
   * @param  {any[]}  parameters
   * @return {any}
   */
  callScope (scope, ...parameters) {
    parameters.unshift(this)

    const query = this.getQuery()

    // We will keep track of how many wheres are on the query before running the
    // scope so that we can properly group the added scope constraints in the
    // query as their own isolated nested where statement and avoid issues.
    const originalWhereCount = isNil(query.wheres)
      ? 0
      : query.wheres.length

    const result = scope(...parameters) ?? this

    if (query.wheres.length > originalWhereCount) {
      this.addNewWheresWithinGroup(query, originalWhereCount)
    }

    return result
  }

  /**
   * Create a where array with nested where conditions.
   *
   * @param  {Where[]}  whereSlice
   * @param  {string}  boolean
   * @return {array}
   */
  createNestedWhere (whereSlice, boolean = 'and') {
    const whereGroup = this.getQuery().forNestedWhere()

    whereGroup.wheres = whereSlice

    return { type: 'Nested', query: whereGroup, boolean }
  }

  /**
   * Get the model instance being queried.
   *
   * @return {\Illuminate\Database\Eloquent\Model|static}
   */
  getModel () {
    return this.model
  }

  /**
   * Get the underlying query builder instance.
   *
   * @return {\Illuminate\Database\Query\Builder}
   */
  getQuery () {
    return this.query
  }

  /**
   * Slice where conditions at the given offset and add them to the query as a nested condition.
   *
   * @param  {\Illuminate\Database\Query\Builder}  query
   * @param  {Where[]}  whereSlice
   * @return {void}
   */
  groupWhereSliceForScope (query, whereSlice) {
    const whereBooleans = collect(whereSlice).pluck('boolean')

    // Here we'll check if the given subset of where clauses contains any "or"
    // booleans and in this case create a nested where expression. That way
    // we don't add any unnecessary nesting thus keeping the query clean.
    if (whereBooleans.contains('or')) {
      query.wheres.push(this.createNestedWhere(whereSlice, whereBooleans.first()))
    } else {
      query.wheres = merge(query.wheres, whereSlice)
    }
  }

  /**
   * Checks if a global macro is registered.
   *
   * @param  {string}  name
   * @return {boolean}
   */
  static hasGlobalMacro (name) {
    return isTruthy(Builder.macros[name])
  }

  /**
   * Checks if a macro is registered.
   *
   * @param  {string}  name
   * @return {boolean}
   */
  hasMacro (name) {
    return isTruthy(this.localMacros[name])
  }

  /**
   * Determine if the given model has a scope.
   *
   * @param  {string}  scope
   * @return {boolean}
   */
  hasNamedScope (scope) {
    return isTruthy(this.model) && this.model?.hasNamedScope(scope)
  }

  /**
   * Get a base query builder instance.
   *
   * @return {\Illuminate\Database\Query\Builder}
   */
  toBase () {
    return this.applyScopes().getQuery()
  }
}

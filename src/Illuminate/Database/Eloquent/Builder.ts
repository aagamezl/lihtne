import type { Builder as BuilderContract } from '../../Contracts/Database/Eloquent/Builder'
import type { Builder as QueryBuilder } from '../Query/Builder'

import { instanceProxy } from '../../Support/Proxies/InstanceProxy'

/**
 * @mixin \Illuminate\Database\Query\Builder
 */
export interface Builder extends QueryBuilder { }

export class Builder implements BuilderContract {
  query: QueryBuilder

  protected passthru: string[] = [
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
 * All of the globally registered builder macros.
 *
 * @var array
 */
  protected static macros = []

  /**
   * The model being queried.
   *
   * @var TModel
   */
  protected model

  /**
   * All of the locally registered builder macros.
   *
   * @var array
   */
  protected localMacros = []

  constructor (query: QueryBuilder) {
    this.query = query

    return instanceProxy(this)
  }

  /**
   * Checks if a macro is registered.
   *
   * @param  string  $name
   * @return bool
   */
  public hasMacro (name: string): boolean {
    return this.localMacros[name] !== undefined
  }

  /**
   * Checks if a global macro is registered.
   *
   * @param  string  $name
   * @return bool
   */
  public static hasGlobalMacro (name: string): boolean {
    return Builder.macros[name] !== undefined
  }

  /**
   * Determine if the given model has a scope.
   *
   * @param  string  $scope
   * @return bool
   */
  public hasNamedScope (scope: string): boolean {
    return this.model && this.model.hasNamedScope(scope)
  }

  __call (method: string, ...parameters: unknown[]) {
    // if (!this.passthru.includes(method)) {
    //   return
    // }

    // const query = this.toBase()
    // const forwarded = query[method as keyof QueryBuilder]

    // if (typeof forwarded === 'function') {
    //   return (forwarded as (...args: unknown[]) => unknown).apply(query, parameters)
    // }

    // return forwarded

    // const builder = this as any
    // const localMacros = builder.localMacros ?? (builder.localMacros = {})

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
        callable = callable.bind(this)
      }

      return callable(...parameters)
    }

    if (this.hasNamedScope(method)) {
      return this.callNamedScope(method, parameters)
    }

    if (this.passthru.includes(method.toLowerCase())) {
      return this.toBase()[method](...parameters)
    }

    this.query[method](...parameters)

    return this
  }

  toBase () {
    return this.getQuery()
  }

  getQuery () {
    return this.query
  }

  /**
   * Create a collection of models from plain arrays.
   *
   * @param  array  $items
   * @return \Illuminate\Database\Eloquent\Collection<int, TModel>
   */
  public hydrate (items: unknown[]) {
    const instance = this.newModelInstance()

    return instance.newCollection(items.map((item: Builder) => {
      const model = instance.newFromBuilder(item)

      if (items.length > 1) {
        model.preventsLazyLoading = Model.preventsLazyLoading()
      }

      return model
    }))
  }

  /**
   * Create a collection of models from a raw query.
   *
   * @param  string  $query
   * @param  array  $bindings
   * @return \Illuminate\Database\Eloquent\Collection<int, TModel>
   */
  public fromQuery (query: string, bindings = []) {
    // return this.hydrate(
    this.query.getConnection().select(query, bindings)
    // );
  }
}

import type { Builder as BuilderContract } from '../../Contracts/Database/Eloquent/Builder'
import type { Builder as QueryBuilder } from '../Query/Builder'

import { instanceProxy } from '../../Support/Proxies/InstanceProxy'

const isMacro = (value: unknown): value is (...args: unknown[]) => unknown => {
  return typeof value === 'function'
}

/**
 * @mixin \Illuminate\Database\Query\Builder
 */
// Merges query-builder members onto this class. The interface adds no fields of its own.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unsafe-declaration-merging
export interface Builder extends QueryBuilder {}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
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
  protected static macros: Record<string, (...args: unknown[]) => unknown> = {}

  /**
   * The model being queried.
   *
   * @var TModel
   */
  protected model: { hasNamedScope (scope: string): boolean } | undefined

  /**
   * All of the locally registered builder macros.
   *
   * @var array
   */
  protected localMacros: Record<string, (...args: unknown[]) => unknown> = {}

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
    return this.model?.hasNamedScope(scope) === true
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
      const name = parameters[0]
      const macro = parameters[1]

      if (typeof name === 'string' && isMacro(macro)) {
        this.localMacros[name] = macro
      }

      return
    }

    const localMacro = this.localMacros[method]

    if (localMacro !== undefined) {
      return localMacro(this, ...parameters)
    }

    const globalMacro = Builder.macros[method]

    if (globalMacro !== undefined) {
      return globalMacro.apply(this, parameters)
    }

    if (this.hasNamedScope(method)) {
      return this.callNamedScope(method, parameters)
    }

    if (this.passthru.includes(method.toLowerCase())) {
      const forwarded = Reflect.get(this.toBase(), method)

      if (typeof forwarded === 'function') {
        return forwarded.apply(this.toBase(), parameters)
      }
    }

    const queryMethod = Reflect.get(this.query, method)

    if (typeof queryMethod === 'function') {
      queryMethod.apply(this.query, parameters)
    }

    return this
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- required by the base callNamedScope signature
  public callNamedScope (method: string, parameters: unknown[]): this {
    return this
  }

  public newModelInstance (): {
    newCollection: (items: unknown[]) => unknown
    newFromBuilder: (item: unknown) => { preventsLazyLoading?: boolean }
  } {
    throw new Error('newModelInstance() is not implemented.')
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

    return instance.newCollection(
      items.map((item: unknown) => {
        return instance.newFromBuilder(item)
      })
    )
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

import { type Builder as BuilderContract } from '../../Contracts/Database/Eloquent/Builder'
import { instanceProxy } from '../../Support/Proxies/InstanceProxy'
import { type Builder as QueryBuilder } from '../Query/Builder'

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

  constructor (query: QueryBuilder) {
    this.query = query

    return instanceProxy(this)
  }

  __call (method: string, ...parameters: unknown[]) {
    if (!this.passthru.includes(method)) {
      return
    }

    const query = this.toBase()
    const forwarded = query[method as keyof QueryBuilder]

    if (typeof forwarded === 'function') {
      return (forwarded as (...args: unknown[]) => unknown).apply(query, parameters)
    }

    return forwarded
  }

  toBase () {
    return this.getQuery()
  }

  getQuery () {
    return this.query
  }
}

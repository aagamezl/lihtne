import type { Builder as EloquentBuilder } from '../Builder'

import { type Builder as BuilderContract } from '../../../Contracts'

export abstract class Relation implements BuilderContract {
  /**
   * The Eloquent query builder instance.
   *
   * @var \Illuminate\Database\Eloquent\Builder<*>
   */
  protected query!: EloquentBuilder

  /**
   * Get the underlying query for the relation.
   *
   * @return \Illuminate\Database\Eloquent\Builder<*>
   */
  public getQuery () {
    return this.query
  }

  /**
   * Get a base query builder instance.
   *
   * @return \Illuminate\Database\Query\Builder
   */
  public toBase () {
    return this.getQuery().toBase()
  }
}

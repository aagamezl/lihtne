import type { Cursor } from './Cursor'

import { Collection } from '../Collections/Collection'
import { AbstractCursorPaginator, type Options } from './AbstractCursorPaginator'

export class CursorPaginator<
  TKey extends PropertyKey = PropertyKey,
  TValue = unknown
> extends AbstractCursorPaginator<TKey, TValue> {
  /**
   * Indicates whether there are more items in the data source.
   *
   * @var bool
   */
  protected hasMore: boolean | undefined

  constructor (
    items: Collection<TKey, TValue> | TValue[] | undefined = undefined,
    perPage: number,
    cursor: Cursor | undefined = undefined,
    options: Options = {}
  ) {
    super()

    this.options = options

    for (const [key, value] of Object.entries(options)) {
      this[key] = value
    }

    this.perPage = perPage
    this.cursor = cursor
    this.path = this.path !== '/' ? this.path.replace(/\/$/, '') : this.path

    this.setItems(items)
  }

  protected setItems (items: Collection<TKey, TValue> | TValue[] | undefined): void {
    this.items = items instanceof Collection ? items : new Collection(items)

    this.hasMore = this.items.count() > this.perPage

    this.items = this.items.slice(0, this.perPage)

    if (this.cursor && this.cursor.pointsToPreviousItems()) {
      this.items = this.items.reverse()
    }

    this.items = this.items.values()
  }
}

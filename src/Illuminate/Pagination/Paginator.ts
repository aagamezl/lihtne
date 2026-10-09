import type { Arrayable } from '../Collections/types'

import { Collection } from '../Collections/Collection'
import { AbstractPaginator } from './AbstractPaginator'

/**
 * Minimal port of Laravel's AbstractPaginator static helpers.
 */
export class Paginator extends AbstractPaginator {
  /**
 * Indicates if there are more items in the data source.
 *
 * @var bool
 */
  protected hasMore: boolean

  /**
 * Create a new paginator instance.
 *
 * @param  Collection<TKey, TValue>|Arrayable<TKey, TValue>|iterable<TKey, TValue>  items
 * @param  int  perPage
 * @param  int|null  currentPage
 * @param  array  options  (path, query, fragment, pageName)
 */
  public constructor (items: Collection<TKey, TValue> | Arrayable<TKey, TValue> | iterable<TKey, TValue>, perPage: number, currentPage: number | undefined = undefined, options: Record<string, unknown> = {}) {
    super()

    this.options = options

    for (const [key, value] of Object.entries(options)) {
      this[key] = value
    }

    this.perPage = perPage
    this.currentPage = this.setCurrentPage(currentPage)
    this.path = this.path !== '/' ? this.path.replace(/\/$/, '') : this.path

    this.setItems(items)
  }

  /**
 * Get the current page for the request.
 *
 * @param  int  $currentPage
 * @return int
 */
  protected setCurrentPage (currentPage: number | undefined): number {
    currentPage = currentPage ?? AbstractPaginator.resolveCurrentPage()

    return this.isValidPageNumber(currentPage) ? currentPage : 1
  }

  /**
* Set the items for the paginator.
*
* @param  Collection<TKey, TValue>|Arrayable<TKey, TValue>|iterable<TKey, TValue>|null  $items
* @return void
*/
  protected setItems (items: Collection<PropertyKey, unknown>): void {
    this.items = items instanceof Collection ? items : new Collection(items)

    this.hasMore = this.items.count() > this.perPage

    this.items = this.items.slice(0, this.perPage)
  }
}

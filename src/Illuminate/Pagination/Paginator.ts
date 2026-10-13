import type { Arrayable } from '../Collections/types'

import { Collection } from '../Collections/Collection'
import { AbstractPaginator } from './AbstractPaginator'

function arrayableItems<TValue> (
  items: Arrayable<TValue> | Iterable<TValue>
): TValue[] | Record<string, TValue>
function arrayableItems<TValue> (
  items: Arrayable<TValue> | Iterable<TValue>
): Arrayable<TValue> | Iterable<TValue> | TValue[] | Record<string, TValue> {
  return items
}

/**
 * Minimal port of Laravel's AbstractPaginator static helpers.
 */
export class Paginator<
  TKey extends PropertyKey = PropertyKey,
  TValue = unknown
> extends AbstractPaginator<TKey, TValue> {
  /**
 * Indicates if there are more items in the data source.
 *
 * @var bool
 */
  protected hasMore: boolean = false

  /**
 * Create a new paginator instance.
 *
 * @param  Collection<TKey, TValue>|Arrayable<TKey, TValue>|iterable<TKey, TValue>  items
 * @param  int  perPage
 * @param  int|null  currentPage
 * @param  array  options  (path, query, fragment, pageName)
 */
  public constructor (
    items: Collection<TKey, TValue> | Arrayable<TValue> | Iterable<TValue>,
    perPage: number,
    currentPage: number | undefined = undefined,
    options: Record<string, unknown> = {}
  ) {
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
  protected setItems (items: Collection<TKey, TValue> | Arrayable<TValue> | Iterable<TValue>): void {
    this.items = items instanceof Collection ? items : new Collection<TKey, TValue>(arrayableItems(items))

    this.hasMore = this.items.count() > (this.perPage ?? 0)

    this.items = this.items.slice(0, this.perPage)
  }
}

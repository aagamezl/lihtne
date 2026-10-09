import { Collection } from '../Collections/Collection'
import { AbstractPaginator } from './AbstractPaginator'

export class LengthAwarePaginator<
  TKey extends PropertyKey = PropertyKey,
  TValue = unknown
> extends AbstractPaginator {
  protected totalCount: number

  /**
   * The last available page.
   *
   * @var int
   */
  protected lastPage: number

  constructor (
    items: Collection<TKey, TValue> | TValue[] | null,
    total: number,
    perPage: number,
    currentPage?: number,
    options: { path?: string; pageName?: string } = {}
  ) {
    super()

    this.options = options

    for (const [key, value] of Object.entries(options)) {
      this[key] = value
    }

    this.totalCount = total
    this.perPage = Number(perPage)
    this.lastPage = Math.max(Math.ceil(total / Math.max(this.perPage, 1)), 1)
    this.path = this.path !== '/' ? this.path.replace(/\/$/, '') : this.path
    this.currentPage = this.setCurrentPage(currentPage, this.pageName)
    this.items = items instanceof Collection ? items : new Collection<TKey, TValue>(items ?? [])
  }

  public total (): number {
    return this.totalCount
  }

  public itemsCollection (): Collection<TKey, TValue> {
    return this.items
  }

  /**
 * Get the current page for the request.
 *
 * @param  int  $currentPage
 * @param  string  $pageName
 * @return int
 */
  protected setCurrentPage (currentPage: number, pageName: string): number {
    currentPage = currentPage ?? this.resolveCurrentPage(pageName)

    return this.isValidPageNumber(currentPage) ? Number(currentPage) : 1
  }
}

import type { Collection } from '../Collections/Collection'

export abstract class AbstractPaginator<TKey extends PropertyKey = PropertyKey, TValue = unknown> {
  /**
   * The current page resolver callback.
   *
   * @var \Closure
   */
  protected static currentPageResolverCallback:
    | ((pageName: string) => number) |
    undefined

  /**
   * The current path resolver callback.
   *
   * @var \Closure
   */
  protected static currentPathResolverCallback: () => string

  /**
   * All of the items being paginated.
   *
   * @var \Illuminate\Support\Collection<TKey, TValue>
   */
  protected items: Collection<TKey, TValue> | TValue[] | undefined

  /**
   * The number of items to be shown per page.
   *
   * @var int
   */
  protected perPage: number | undefined

  /**
   * The paginator options.
   *
   * @var array
   */
  protected options: Record<string, unknown> = {}

  /**
   * The current page being "viewed".
   *
   * @var int
   */
  protected currentPage: number | undefined

  /**
   * The base path to assign to all URLs.
   *
   * @var string
   */
  protected path = '/'

  /**
   * The query parameters to add to all URLs.
   *
   * @var array
   */
  protected query = []

  /**
   * The URL fragment to add to all URLs.
   *
   * @var string|undefined
   */
  protected fragment: string | undefined

  /**
   * The query string variable used to store the page.
   *
   * @var string
   */
  protected pageName = 'page'

  public static resolveCurrentPage (
    pageName: string = 'page',
    defaultPage: number = 1
  ): number {
    if (this.currentPageResolverCallback) {
      return this.currentPageResolverCallback(pageName)
    }

    return defaultPage
  }

  public static currentPageResolver (
    resolver: (pageName: string) => number
  ): void {
    this.currentPageResolverCallback = resolver
  }

  public static resolveCurrentPath (defaultPath: string = '/'): string {
    if (this.currentPathResolverCallback) {
      return this.currentPathResolverCallback()
    }

    return defaultPath
  }

  /**
   * Set the current request path resolver callback.
   *
   * @param  \Closure  $resolver
   * @return void
   */
  public static currentPathResolver (resolver: () => string): void {
    this.currentPathResolverCallback = resolver
  }

  /**
 * Determine if the given value is a valid page number.
 *
 * @param  int  $page
 * @return bool
 */
  protected isValidPageNumber (page: number): boolean {
    return page >= 1 && !Number.isNaN(page) && Number.isInteger(page)
  }
}

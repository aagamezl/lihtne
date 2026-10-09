import type { Collection } from '../Collections'
import type { Cursor } from './Cursor'

export type Options = {
  path?: string
  cursorName?: string
  parameters?: Array<string>
  pageName?: string
}

export abstract class AbstractCursorPaginator<TKey extends PropertyKey = PropertyKey, TValue = unknown> {
  /**
   * All of the items being paginated.
   *
   * @var \Illuminate\Support\Collection<TKey, TValue>
   */
  protected items: Collection<TKey, TValue> | undefined

  /**
   * The number of items to be shown per page.
   *
   * @var int
   */
  protected perPage: number | undefined

  /**
   * The base path to assign to all URLs.
   *
   * @var string
   */
  protected path: string = '/'

  /**
   * The query parameters to add to all URLs.
   *
   * @var array
   */
  protected query: string[] | undefined

  /**
   * The URL fragment to add to all URLs.
   *
   * @var string|null
   */
  protected fragment: string | undefined

  /**
   * The cursor string variable used to store the page.
   *
   * @var string
   */
  protected cursorName: string = 'cursor'

  /**
   * The current cursor.
   *
   * @var \Illuminate\Pagination\Cursor|null
   */
  protected cursor: Cursor | undefined

  /**
   * The paginator parameters for the cursor.
   *
   * @var array
   */
  protected parameters: Record<string, unknown> = {}

  /**
   * The paginator options.
   *
   * @var array
   */
  protected options: Options = {}

  /**
   * The current cursor resolver callback.
   *
   * @var \Closure
   */
  protected static currentCursorResolverCallback: ((cursor: Cursor) => void) | undefined

  /**
 * Set the current cursor resolver callback.
 *
 * @param  \Closure  $resolver
 * @return void
 */
  public static currentCursorResolver (resolver: (cursor: Cursor) => void): void {
    this.currentCursorResolverCallback = resolver
  }

  /**
 * Resolve the current cursor or return the default value.
 *
 * @param  string  $cursorName
 * @param  \Illuminate\Pagination\Cursor|null  $default
 * @return \Illuminate\Pagination\Cursor|null
 */
  public static resolveCurrentCursor (
    cursorName: string = 'cursor',
    defaultValue: Cursor | undefined = undefined
  ): Cursor | undefined {
    if (this.currentCursorResolverCallback) {
      return this.currentCursorResolverCallback(cursorName) ?? defaultValue
    }

    return defaultValue
  }
}

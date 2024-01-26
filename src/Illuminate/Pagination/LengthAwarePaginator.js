/** @type {import('../Collections/Collection').default} Collection */

export default class LengthAwarePaginator {
  /**
   * All of the items being paginated.
   *
   * @protected
   * @type {Collection}
   */
  items

  /**
   * The number of items to be shown per page.
   *
   * @protected
   * @type {number}
   */
  perPage

  /**
   * The current page being "viewed".
   *
   * @protected
   * @type {number}
   */
  currentPage

  /**
   * The total number of items before slicing.
   *
   * @protected
   * @type {number}
   */
  totalProperty

  /**
   * Create a new paginator instance.
   *
   * @param  {Collection}  items
   * @param  {number}  total
   * @param  {number}  perPage
   * @param  {number}  [currentPage]
   * @returns {void}
   */
  constructor (items, total, perPage, currentPage) {
    this.items = items
    this.perPage = perPage
    this.totalProperty = total
    this.currentPage = currentPage
  }

  /**
   * Get the total number of items being paginated.
   *
   * @returns {number}
   */
  total () {
    return this.totalProperty
  }
}

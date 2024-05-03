import Collection from '../Collections/Collection.js'

export default class CursorPaginator {
  /**
   * Indicates whether there are more items in the data source.
   *
   * @type {boolean}
   */
  hasMore = false

  /**
   * Create a new paginator instance.
   *
   * @param {Array|Collection} items
   * @param {number} perPage
   * @param {Cursor|null} cursor
   * @param {Object} options (path, query, fragment, pageName)
   */
  constructor (items, perPage, cursor = null, options = {}) {
    this.options = options

    for (const [key, value] of Object.entries(options)) {
      this[key] = value
    }

    this.perPage = parseInt(perPage)
    this.cursor = cursor
    this.path = this.path !== '/' ? this.path.replace(/\/$/, '') : this.path

    this.setItems(items)
  }

  /**
   * Set the items for the paginator.
   *
   * @param {Array|Collection} items
   */
  setItems (items) {
    this.items = items instanceof Collection ? items : Collection.make(items)

    this.hasMore = this.items.length > this.perPage

    this.items = this.items.slice(0, this.perPage)

    if (this.cursor && this.cursor.pointsToPreviousItems()) {
      this.items = this.items.reverse().values()
    }
  }

  /**
   * Determine if there are more items in the data source.
   *
   * @returns {boolean}
   */
  hasMorePages () {
    return (
      (this.cursor === null && this.hasMore) ||
      (this.cursor !== null && this.cursor.pointsToNextItems() && this.hasMore) ||
      (this.cursor !== null && this.cursor.pointsToPreviousItems())
    )
  }
}

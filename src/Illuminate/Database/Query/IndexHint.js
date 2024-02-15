export default class IndexHint {
  /**
   * Create a new index hint instance.
   *
   * @param {string} type
   * @param {string} index
   */
  constructor (type, index) {
    /**
     * The type of query hint.
     *
     * @type {string}
     */
    this.type = type

    /**
     * The name of the index.
     *
     * @type {string}
     */
    this.index = index
  }
}

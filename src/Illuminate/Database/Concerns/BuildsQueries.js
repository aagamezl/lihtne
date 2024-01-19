import Conditionable from '../../Conditionable/Traits/Conditionable.js'
import use from '../../Support/Traits/use.js'

export default class BuildsQueries {
  /**
   * Chunk the results of the query.
   *
   * @param  {number}  count
   * @param  {Function}  callback
   * @return {boolean}
   */
  async chunk (count, callback) {
    this.enforceOrderBy()

    let page = 1
    let countResults

    do {
      // We'll execute the query for the given page and get the results. If there are
      // no results we can just break and return from here. When there are results
      // we will call the callback with the current chunk of these results here.
      const results = await this.forPage(page, count).get()

      countResults = results.count()

      if (countResults === 0) {
        break
      }

      // On each chunk result set, we will pass them to the callback and then let the
      // developer take care of everything within the callback, which allows us to
      // keep the memory low for spinning through large result sets for working.
      if (callback(results, page) === false) {
        return false
      }

      // unset(results);

      page++
    } while (countResults === count)

    return true
  }

  /**
   * Execute the query and get the first result.
   *
   * @param  {Array|string}  columns
   * @return {\Illuminate\Database\Eloquent\Model|object|static|undefined}
   */
  async first (columns = ['*']) {
    const result = await this.take(1).get(columns)

    return result.first()
  }

  /**
   * Pass the query to a given callback.
   *
   * @param  {Function}  callback
   * @return {this}
   */
  tap (callbackFunc) {
    callbackFunc(this)

    return this
  }
}

use(BuildsQueries, [Conditionable])

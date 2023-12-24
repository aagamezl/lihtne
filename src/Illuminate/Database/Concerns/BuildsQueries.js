import Conditionable from '../../Conditionable/Traits/Conditionable.js'
import use from '../../Support/Traits/use.js'

export default class BuildsQueries {
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

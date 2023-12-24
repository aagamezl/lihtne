import { isFunction, isPlainObject, isString } from '@devnetic/utils'

import Collection from '../Collection.js'
import { dataGet } from '../helpers.js'

// export const EnumeratesValues = {
export class EnumeratesValues {
  /**
   * Results array of items from Collection or Arrayable.
   *
   * @param  {unknown}  items
   * @return {object[]}
   */
  getArrayableItems (items) {
    if (Array.isArray(items) || items instanceof Map) {
      return items
    } else if (items instanceof Collection) {
      return items.all()
    } else if (isPlainObject(items)) {
      return [items]
    } else if (items === undefined) {
      return []
    }

    return [items]
  }

  /**
   * Determine if the given value is callable, but not a string.
   *
   * @param  {*}  value
   * @return {boolean}
   */
  useAsCallable (value) {
    return !isString(value) && isFunction(value)
  }

  /**
   * Get a value retrieving callback.
   *
   * @param  {Function|string}  [value]
   * @return {Function}
   */
  valueRetriever (value) {
    if (this.useAsCallable(value)) {
      return value
    }
    return (item) => {
      return dataGet(item, value)
    }
  }
}

import { isFunction, isPlainObject, isString } from '@devnetic/utils'

import Collection from '../Collection.js'
import { dataGet } from '../helpers.js'

// export const EnumeratesValues = {
export class EnumeratesValues {
  /**
   * Results array of items from Collection or Arrayable.
   *
   * @param  {any}  items
   * @return {any}
   */
  getArrayableItems (items) {
    if (Array.isArray(items) || items instanceof Map) {
      return items
    } else if (items instanceof Collection) {
      return items.all()
    } else if (isPlainObject(items)) {
      this.entries = true
      return Object.entries(items)
    } else if (items === undefined) {
      return []
    }

    return [items]
  }

  /**
   * Create a collection of all elements that do not pass a given truth test.
   *
   * @param  {((value: unknown, key: unknown) => boolean) | boolean}  [callback=true]
   * @return {Collection}
   */
  reject (callback = true) {
    const useAsCallable = this.useAsCallable(callback)

    return this.filter((value, key) => {
      [key, value] = Array.isArray(value) && value.length > 1 ? value : [key, value]

      return useAsCallable
        ? !callback(value, key)
        : value !== callback
    })
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

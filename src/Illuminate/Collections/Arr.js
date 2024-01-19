import { isAlphanumeric, isFalsy, isObject, isPlainObject } from '@devnetic/utils'

import Collection from './Collection.js'
import { dataGet, value as getValue } from './helpers.js'

export default class Arr {
  /**
   * Determine whether the given value is array accessible.
   *
   * @param  {unknown}  value
   * @return {boolean}
   */
  static accessible (value) {
    return Array.isArray(value)
  }

  /**
   * Collapse an array of arrays into a single array.
   *
   * @param  {iterable}  array
   * @return [array]
   */
  static collapse (array) {
    const results = []

    for (let values of Object.values(array)) {
      if (values instanceof Collection) {
        values = values.all()
      } else if (!Array.isArray(values)) {
        continue
      }

      results.push(values)
    }

    return [...[], ...results].flat()
  }

  /**
   * Get all of the given array except for a specified array of keys.
   *
   * @param  {array}  array
   * @param  {array|string|number}  keys
   * @return {array}
   */
  static except (array, keys) {
    const cloned = structuredClone(array)

    this.forget(cloned, keys)

    return cloned
  }

  /**
   * Determine if the given key exists in the provided array.
   *
   * @param  {ArrayAccess|array}  array
   * @param  {string|number}  key
   * @return {boolean}
   */
  static exists (array, key) {
    return array[key] !== undefined
  }

  /**
   * Explode the "value" and "key" arguments passed to "pluck".
   *
   * @param  {string|Array}  value
   * @param  {string|Array}  [key]
   * @return {Array}
   */
  static explodePluckParameters (value, key) {
    value = Array.isArray(value) ? value : String(key).split('.')
    key = (key === undefined || Array.isArray(key)) ? key : String(key).split('.')
    return [value, key]
  }

  /**
   * Return the first element in an array passing a given truth test.
   *
   * @param  {Array}  array
   * @param  {Function}  [callback]
   * @param  {unknown}  [defaultValue]
   * @return {unknown}
   */
  static first (array, callback, defaultValue) {
    if (callback === undefined) {
      if (array.length === 0) {
        return getValue(defaultValue)
      }
      return array[0]
    }
    for (const [key, value] of array.entries()) {
      const isTruthy = Boolean(callback(value, key))
      if (isTruthy) {
        return value
      }
    }
    return getValue(defaultValue)
  }

  /**
   * Flatten a multi-dimensional array into a single level.
   *
   * @param  {Array}  array
   * @param  {number}  depth
   * @return {Array}
   */
  static flatten (array, depth = Number.POSITIVE_INFINITY) {
    const result = []
    const entries = array instanceof Map ? array.entries() : Object.entries(array)

    for (let [, item] of entries) {
      item = item instanceof Collection ? item.all() : item

      if (!Array.isArray(item) && !isPlainObject(item)) {
        result.push(item)
      } else {
        const values = depth === 1
          ? Object.values(item)
          : this.flatten(item, depth - 1)

        for (const value of values) {
          result.push(value)
        }
      }
    }
    return result
  }

  /**
     * Remove one or many array items from a given array using "dot" notation.
     *
     * @param  {Object} array
     * @param  {Array|string|number} keys
     * @return {void}
     */
  static forget (array, keys) {
    const original = structuredClone(array)

    keys = Array.isArray(keys) ? keys : [keys]

    if (keys.length === 0) {
      return
    }

    for (const key of keys) {
      // if the exact key exists in the top-level, remove it
      if (Arr.exists(array, key)) {
        delete array[key]
        continue
      }

      const parts = key.split('.')

      // clean up before each pass
      array = original

      while (parts.length > 1) {
        const part = parts.shift()

        if (array[part] !== undefined && Arr.accessible(array[part])) {
          array = array[part]
        } else {
          continue
        }
      }

      delete array[parts.shift()]
    }
  }

  /**
   * Get an item from an array using "dot" notation.
   *
   * @param  {object|Array}  array
   * @param  {string|number|undefined}  key
   * @param  {any}  default
   * @return {any}
   */
  static get (array, key, defaultValue) {
    if (key === undefined) {
      return array
    }
    if (Object.values(array).includes(key)) {
      return array[key]
    }
    return dataGet(array, key, defaultValue)
  }

  /**
   *
   *
   * @public static
   * @param {Array | object} value
   * @returns {Array}
   * @memberof Arr
   */
  static iterable (value) {
    value = Array.isArray(value) ? value : [value]
    return value.reduce((result, column, index) => {
      if (isPlainObject(column)) {
        result.push(...Object.entries(column))
      } else {
        if (Array.isArray(column)) {
          result.push(...this.iterable(column))
        } else {
          result.push([index, column])
        }
      }
      return result
    }, [])
  }

  /**
   * Return the last element in an array passing a given truth test.
   *
   * @param  {Array}  array
   * @param  {Function|undefined}  callback
   * @param  {*}  defaultValue
   * @return {*}
   */
  static last (array, callback, defaultValue) {
    if (callback === undefined) {
      return array.length === 0 ? getValue(defaultValue) : array[array.length - 1]
    }
    return this.first(array.reverse(), callback, defaultValue)
  }

  /**
   * Run a map over each of the items in the array.
   *
   * @param  {unknown[]}  array
   * @param  {Function}  callback
   * @return {unknown[]}
   */
  static map (array, callback) {
    const keys = Object.keys(array)

    let items

    try {
      items = keys.map(key => {
        return callback(array[key], isAlphanumeric(key) ? Number(key) : key)
      })
    } catch (error) {
      if (error instanceof TypeError) {
        items = Object.values(array).map(callback)
      } else {
        throw error
      }
    }

    // return Object.fromEntries(keys.map((key, index) => [key, items[index]]))
    return keys.map((key, index) => [key, items[index]])
  }

  /**
   * Pluck an array of values from an array.
   *
   * @param  {Array}   array
   * @param  {string|Array|number|undefined}  [value]
   * @param  {string|Array|undefined}  [key]
   * @return {Array}
   */
  static pluck (array, value, key) {
    const results = []
    const [pluckValue, pluckKey] = this.explodePluckParameters(value, key)
    for (const item of array) {
      const itemValue = dataGet(item, pluckValue)
      // If the key is "null", we will just append the value to the array and keep
      // looping. Otherwise we will key the array using the value of the key we
      // received from the developer. Then we'll return the final array form.
      if (pluckKey === undefined) {
        results.push(itemValue)
      } else {
        let itemKey = dataGet(item, pluckKey)
        if (isObject(itemKey) && itemKey.toString !== undefined) {
          itemKey = itemKey.toString()
        }
        Reflect.set(results, itemKey, itemValue)
      }
    }
    return results
  }

  /**
   * Shuffle the given array and return the result.
   *
   * @param  {Array}  array
   * @return {Array}
   */
  static shuffle (array) {
    return array.sort((a, b) => a.localeCompare(b))
  }

  /**
   * Set an array item to a given value using "dot" notation.
   *
   * If no key is given to the method, the entire array will be replaced.
   *
   * @param  {unknown[]}  array
   * @param  {string|number|undefined}  key
   * @param  {unknown}  value
   * @return {unknown[]}
   */
  static set (array, key, value, separator = '.') {
    let current = array

    if (key === undefined) {
      array = value

      return array
    }

    const keys = key.split(separator)

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i]

      // if (i === keys.length) {
      //   break
      // }

      // If the key doesn't exist at this depth, we will just create an empty array
      // to hold the next value, allowing us to create the arrays to hold final
      // values at the correct depth. Then we'll keep digging into the array.
      if (current[key] === undefined || typeof current[key] !== 'object') {
        current[key] = {}
      }

      current = current[key]
    }

    current[keys.pop()] = value

    return current
  }

  /**
   * Sort the array using the given callback or "dot" notation.
   *
   * @param  {Record<string, any>}  array
   * @param  {Function|Array|string}  callback
   * @return {any[]}
   */
  static sort (target, callback) {
    return Collection.make(target).sortBy(callback).all()
  }

  static values (target) {
    return Object.values(target).reduce((result, value) => {
      result.push(value)
      return result
    }, [])
  }

  /**
   * Filter the array using the given callback.
   *
   * @param  {unknown[]}  array
   * @param  {Function}  callback
   * @return {unknown[]}
   */
  static where (array, callback) {
    return array.filter(callback)
  }

  /**
   * If the given value is not an array and not null, wrap it in one.
   *
   * @param  {unknown}  value
   * @return {Array}
   */
  static wrap (value) {
    if (isFalsy(value)) {
      return []
    }
    return Array.isArray(value) ? value : [value]
  }
}

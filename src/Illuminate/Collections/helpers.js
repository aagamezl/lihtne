import { isObject } from '@devnetic/utils'

import Arr from './Arr.js'
import Collection from './Collection.js'

/**
 * Create a collection from the given value.
 *
 * @template TKey
 * @template TValue
 *
 * @returns {import('./Collection.js').CollectionWithTraits}
 */
export const collect = (value) => {
  return new Collection(value)
}

/**
 * Get an item from an array or object using "dot" notation.
 *
 * @param  {unknown}   target
 * @param  {string|Array|number}  key
 * @param  {unknown}   [defaultValue]
 * @return {unknown}
 */
export const dataGet = (target, key, defaultValue) => {
  if (key === undefined) {
    return target
  }

  key = Array.isArray(key) ? key : String(key).split('.')

  for (const [i, segment] of key.entries()) {
    key[i] = undefined

    if (segment === undefined) {
      return target
    }

    if (segment === '*') {
      if (target instanceof Collection) {
        target = target.all()
      } else if (!Array.isArray(target)) {
        return value(defaultValue)
      }

      const result = []

      for (const item of Object.values(target)) {
        result.push(dataGet(item, key))
      }

      return key.includes('*') ? Arr.collapse(result) : result
    }

    if (Arr.accessible(target) && Arr.exists(target, segment)) {
      target = target[segment]
    } else if (isObject(target) && target[segment] !== undefined) {
      target = target[segment]
    } else {
      return value(defaultValue)
    }
  }

  return target
}

/**
 * Get the last element of an array. Useful for method chaining.
 *
 * @param  {any}  array
 * @return {any}
 */
export const end = (array) => {
  return array[array.length - 1]
}

/**
 * Get the first element of an array. Useful for method chaining.
 *
 * @param  {any}  value
 * @return {unknown}
 */
export const head = (value) => {
  return Array.isArray(value) ? value[0] : Array.from(Object.values(value))[0]
}

/**
 * Get the last element from an array.
 *
 * @param  {Array}  array
 * @return {*}
 */
export const last = (array) => {
  return end(array)
}

/**
 * Get the first element of an array. Useful for method chaining.
 *
 * @param  {any}  array
 * @return {any}
 */
export const reset = (array) => {
  return head(array)
}

/**
 * Return the default value of the given value.
 *
 * @param  {unknown}  target
 * @param {Array} args
 * @return {unknown}
 */
export const value = (target, ...args) => {
  return target instanceof Function ? target(...args) : target
}

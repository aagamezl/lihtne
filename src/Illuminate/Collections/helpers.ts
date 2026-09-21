import { isNil } from 'es-toolkit'

import { isObject, isSet, value } from '../Support'
import { Arr } from './Arr'
import { Collection } from './Collection'

/**
    /**
     * Get an item from an array or object using "dot" notation.
     *
     * @param  mixed  $target
     * @param  string|array|int|null  $key
     * @param  mixed  $default
     * @return mixed
     */
export const dataGet = (
  target: unknown,
  key?: string | Iterable<unknown> | number | null,
  defaultValue?: unknown
): unknown => {
  if (isNil(key)) {
    return target
  }

  const explodedKey = Array.isArray(key)
    ? key
    : (typeof key === 'string'
      ? key.split('.')
      : [String(key)])

  for (let segment of explodedKey) {
    if (segment === '*') {
      let values: Iterable<unknown> | Collection

      if (target instanceof Collection) {
        values = target.all()
      } else if (isIterable(target)) {
        values = target
      } else {
        return value(defaultValue)
      }

      return explodedKey.includes('*') ? Arr.collapse(values) : values
    }

    // Refactored as a TypeScript switch statement with correct segment transformation logic:
    switch (segment) {
      case '\\*':
        segment = '*'
        break
      case '\\{first}':
        segment = '{first}'
        break
      case '{first}':
        // Use Arr.from and get the first key (array_key_first in PHP)
        segment = Object.keys(Arr.from(target))[0]
        break
      case '\\{last}':
        segment = '{last}'
        break
      case '{last}':
        // Use Arr.from and get the last key (array_key_last in PHP)
        {
          const keys = Object.keys(Arr.from(target))
          segment = keys[keys.length - 1]
        }
        break
      default:
        // No transformation needed
        // segment remains unchanged
        break
    }

    if (typeof segment !== 'string' && typeof segment !== 'number') {
      return value(defaultValue)
    }

    if (Arr.accessible(target) && Arr.exists(target, segment)) {
      target = Reflect.get(target, segment)
    } else if (isObject(target) && isSet(target[segment])) {
      target = target[segment]
    } else {
      return value(defaultValue)
    }
  }

  return target
}

const isIterable = (value: unknown): value is Iterable<unknown> => {
  // Accepts arrays or objects implementing iterable protocol (like Traversable in PHP).
  return Array.isArray(value) || (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as any)[Symbol.iterator] === 'function'
  )
}

/**
 * Get the first element of an array. Useful for method chaining.
 *
 * @param  {any}  value
 * @return {unknown}
 */
export const head = (value: unknown[] | Record<string, unknown>): unknown => {
  return Array.isArray(value) ? value[0] : Array.from(Object.values(value))[0]
}

/**
 * Get the last element from an array.
 *
 * @param  {Array}  array
 * @return {*}
 */
export const last = (array: unknown[]): unknown => {
  return end(array)
}

/**
 * Get the last element of an array. Useful for method chaining.
 *
 * @param  {any}  array
 * @return {any}
 */
export const end = (array: unknown[]): unknown => {
  return array[array.length - 1]
}

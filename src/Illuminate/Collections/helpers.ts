import { isNil } from 'es-toolkit'

import type { ArrayableInput } from './types'

import { getValue, isObject, isSet } from '../Support'
import { Arr } from './Arr'
import { Collection } from './Collection'

/**
 * Create a collection from the given value.
 *
 * @template TKey of array-key
 * @template TValue
 *
 * @param  \Illuminate\Contracts\Support\Arrayable<TKey, TValue>|iterable<TKey, TValue>|null  $value
 * @return \Illuminate\Support\Collection<TKey, TValue>
 */
export const collect = <TKey extends PropertyKey, TValue>(
  value?: ArrayableInput<TValue> | undefined
): Collection<TKey, TValue> => {
  return new Collection(value)
}

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
    : typeof key === 'string'
      ? key.split('.')
      : [String(key)]

  for (let segment of explodedKey) {
    if (segment === '*') {
      let values: unknown[]

      if (target instanceof Collection) {
        const all = target.all()
        values = Array.isArray(all) ? all : Object.values(all)
      } else if (isIterable(target)) {
        values = [...target]
      } else {
        return getValue(defaultValue)
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
        segment = Object.keys(readableTarget(target))[0] ?? ''
        break
      case '\\{last}':
        segment = '{last}'
        break
      case '{last}': {
        const keys = Object.keys(readableTarget(target))
        segment = keys[keys.length - 1] ?? ''
        break
      }
      default:
        // No transformation needed
        // segment remains unchanged
        break
    }

    if (typeof segment !== 'string' && typeof segment !== 'number') {
      return getValue(defaultValue)
    }

    if (Arr.accessible(target) && Arr.exists(target, segment)) {
      target = Reflect.get(target, segment)
    } else if (isObject(target) && isSet(target[segment])) {
      target = target[segment]
    } else {
      return getValue(defaultValue)
    }
  }

  return target
}

const readableTarget = (target: unknown): Record<string, unknown> => {
  if (Array.isArray(target)) {
    return Object.fromEntries(target.map((item, index) => [index, item]))
  }

  if (typeof target === 'object' && target !== null) {
    return Object.fromEntries(Object.entries(target))
  }

  return {}
}

const isIterable = (value: unknown): value is Iterable<unknown> => {
  // Accepts arrays or objects implementing iterable protocol (like Traversable in PHP).
  if (Array.isArray(value)) {
    return true
  }

  if (value === null || typeof value !== 'object') {
    return false
  }

  return typeof Reflect.get(value, Symbol.iterator) === 'function'
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

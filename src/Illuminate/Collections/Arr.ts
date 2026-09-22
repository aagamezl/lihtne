import {
  isJSON,
  isNil,
  isNull,
  isPlainObject,
  isString
} from 'es-toolkit'
import { get } from 'es-toolkit/compat'

import { findKey, isEmpty, isNumeric, value } from '../Support'
import { Collection } from './Collection'
import { dataGet } from './helpers'
import { Dictionary } from './types'

export type MapCallback = (
  value: any,
  index: number,
  array?: unknown[] | undefined
) => unknown

export class Arr {
  /**
   * If the given value is not an array and not null, wrap it in one.
   *
   * @template TKey of array-key = array-key
   * @template TValue
   *
   * @param  array<TKey, TValue>|TValue|null  $value
   * @return ($value is null ? array{} : ($value is array ? array<TKey, TValue> : array{TValue}))
   */
  public static wrap<TValue>(value: TValue | TValue[] | null = null): TValue[] {
    if (isNil(value)) {
      return []
    }

    return Array.isArray(value) ? value : [value]
  }

  /**
   * Get an item from an array using "dot" notation.
   *
   * @param  {Record<string, any>}  array
   * @param  {string|number|undefined}  key
   * @param  {any}  defaultValue
   * @return {unknown}
   */
  static get (
    array: Record<string, unknown>,
    key?: string | number,
    defaultValue?: unknown
  ) {
    if (key === undefined) {
      return array
    }

    if (Object.values(array).includes(key)) {
      return array[key]
    }

    return get(array, key, defaultValue)
  }

  /**
 * Collapse an array of arrays into a single array.
 *
 * @param  {iterable}  array
 * @return [array]
 */
  public static collapse (array: Iterable<unknown> | Collection): unknown[] {
    const results: unknown[] = []

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
   * Determine whether the given value is array accessible.
   *
   * @param  {unknown}  value
   * @return {boolean}
   */
  public static accessible (value: unknown): value is unknown[] {
    return Array.isArray(value)
  }

  /**
   * Determine if the given key exists in the provided array.
   *
   * @param  \ArrayAccess|array  $array
   * @param  string|int|float  $key
   * @return bool
   */
  public static exists (array: Iterable<unknown> | Collection, key: string | number): boolean {
    if (array instanceof Collection) {
      return this.exists(array.all() as Iterable<unknown>, key)
    }

    if (Array.isArray(array)) {
      return Object.hasOwn(array, key)
    }

    if (typeof key === 'number') {
      key = String(key)
    }

    return typeof array === 'object' && array !== null && key in array
  }

  /**
   * Pluck an array of values from an array.
   *
   * @param  iterable  $array
   * @param  string|array|int|Closure|null  $value
   * @param  string|array|Closure|null  $key
   * @return array
   */
  public static pluck (
    array: Iterable<unknown>,
    value?: string | unknown[] | number | Function,
    key?: string | unknown[] | Function
  ): unknown[] {
    const results: unknown[] = []

    const [explodedValue, explodedKey] = this.explodePluckParameters(value, key)

    for (const item of array) {
      const itemValue = explodedValue instanceof Function
        ? explodedValue(item)
        : dataGet(item, explodedValue)

      // If the key is "null", we will just append the value to the array and keep
      // looping. Otherwise we will key the array using the value of the key we
      // received from the developer. Then we'll return the final array form.
      if (isNull(key)) {
        results.push(itemValue)
      } else {
        const itemKey = explodedKey instanceof Function
          ? explodedKey(item)
          : dataGet(item, explodedKey)

        results[itemKey] = itemValue
      }
    }

    return results
  }

  /**
   * Explode the "value" and "key" arguments passed to "pluck".
   *
   * @param  Closure|array|string  $value
   * @param  string|array|Closure|null  $key
   * @return array
   */
  protected static explodePluckParameters (
    value?: Function | string | number | unknown[],
    key?: string | unknown[] | Function
  ) {
    value = isString(value) ? value.split('.') : value

    key = isNil(key) || Array.isArray(key) || key instanceof Function ? key : key.split('.')

    return [value, key]
  }

  /**
 * Return the first element in an iterable passing a given truth test.
 *
 * @template TKey
 * @template TValue
 * @template TFirstDefault
 *
 * @param  iterable<TKey, TValue>  $array
 * @param  (callable(TValue, TKey): bool)|null  $callback
 * @param  TFirstDefault|(\Closure(): TFirstDefault)  $default
 * @return TValue|TFirstDefault
 */
  public static first<TValue, TKey, TDefault>(
    array: Iterable<TValue> | Dictionary<TValue>,
    callback?: (value: TValue, key: TKey) => boolean,
    defaultVal?: TDefault | (() => TDefault)
  ): TValue | (() => TValue) {
    if (isNull(callback)) {
      if (isEmpty(array)) {
        return value(defaultVal)
      }

      if (Array.isArray(array)) {
        return array[0]
      }

      for (const item of array) {
        return item
      }

      return value(defaultVal)
    }

    array = this.from(array)

    const key = findKey(array, callback)

    return key !== undefined ? (array as any)[key] : value(defaultVal)
  }

  /**
 * Get the underlying array of items from the given argument.
 *
 * @template TKey of array-key = array-key
 * @template TValue = mixed
 *
 * @param  array<TKey, TValue>|Enumerable<TKey, TValue>|Arrayable<TKey, TValue>|WeakMap<object, TValue>|Traversable<TKey, TValue>|Jsonable|JsonSerializable|object  $items
 * @return ($items is WeakMap ? list<TValue> : array<TKey, TValue>)
 *
 * @throws \InvalidArgumentException
 */
  public static from (items: any) {
    if (Array.isArray(items)) {
      return items
    }

    if (Symbol.iterator in Object(items)) {
      return Array.from(items)
    }

    if (isJSON(items)) {
      return JSON.parse(items)
    }

    if (isPlainObject(items)) {
      return items
    }

    throw new Error('Items cannot be represented by a scalar value.')
  }

  /**
 * Run a map over each of the items in the array.
 *
 * @param  array  $array
 * @param  callable  $callback
 * @return array
 */
  public static map (array: any, callback: MapCallback) {
    // const keys = toArray(array);
    const keys = Object.keys(array)

    let items

    try {
      items = keys.map((key: any) => {
        return callback(array[key], isNumeric(key) ? Number(key) : key, keys)
      })
    } catch (ArgumentCountError) {
      items = Object.values(array).map(callback)
    }

    return Array.isArray(array)
      ? items
      : Object.fromEntries(keys.map((key, index) => [key, items[index]]))
  }
}

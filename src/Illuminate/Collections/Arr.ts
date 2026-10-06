import { isPlainObject } from '@devnetic/utils'

import { getValue, iterationKey } from '../Support/helpers'
import { Collection } from './Collection'
import {
  type Dictionary,
  resolveDefault
} from './types'

const DOT_SEPARATOR = '.'

/**
 * TypeScript port of `Illuminate\Support\Arr`.
 *
 * Only the subset of methods requested for this port is implemented:
 * wrap, get, collapse, accessible, exists, except, forget, pluck,
 * explode (as `explodePluckParameters`), first, from, map.
 *
 * PHP's `Arr` operates over a single associative-array type that mixes
 * list and dictionary shapes. TypeScript has no equivalent, so this port
 * represents that "accessible" shape as `unknown[] | Dictionary<unknown>`
 * throughout, matching whichever shape was actually passed in.
 */
export class Arr {
  /**
   * Get all of the given array except for a specified array of keys.
   *
   * @param  array  $array
   * @param  array|string|int|float  $keys
   * @return array
   */
  public static except<TValue, TKeys extends PropertyKey>(
    array: TValue,
    keys: TKeys[]
  ): TValue {
    this.forget(array, keys)

    return array
  }

  /**
   * Remove one or many array items from a given array using "dot" notation.
   *
   * @param  array  $array
   * @param  array|string|int|float  $keys
   * @return void
   */
  public static forget<TValue, TKeys extends PropertyKey>(
    array: TValue,
    keys: TKeys[]
  ): void {
    if (Array.isArray(array)) {
      if (array.length === 0) {
        return
      }

      // const normalizedKeys = Arr.from<TKeys>(keys)

      if (keys.length === 0) {
        return
      }
    }

    /* eslint-disable no-labels -- continue keys skips to the next key from nested while */
    keys: for (const key of keys) {
      // clean up before each pass
      // array = original

      // if the exact key exists in the top-level, remove it
      if (this.exists(array, key)) {
        // array[key] = undefined
        continue
      }

      const parts = String(key).split(DOT_SEPARATOR)

      if (!Arr.accessible(array)) {
        continue keys
      }

      let cursor: unknown[] | Dictionary<unknown> = array

      while (parts.length > 1) {
        const part = parts.shift()

        if (part === undefined) {
          continue keys
        }

        if (!Arr.exists(cursor, part)) {
          continue keys
        }

        const next = Arr.readEntry<unknown>(cursor, part)

        if (!Arr.accessible(next)) {
          continue keys
        }

        cursor = next
      }

      const finalKey = parts.shift()

      if (finalKey === undefined || !Arr.exists(cursor, finalKey)) {
        continue keys
      }

      if (Array.isArray(cursor)) {
        cursor[Number(finalKey)] = undefined
      } else {
        cursor[finalKey] = undefined
      }
    }
    /* eslint-enable no-labels */
  }

  /**
   * True when dictionary keys are dense `0..n-1`, like a PHP list array.
   */
  static isList<TValue>(dictionary: Dictionary<TValue>): boolean {
    const keys = Object.keys(dictionary)

    for (let index = 0; index < keys.length; index += 1) {
      if (keys[index] !== String(index)) {
        return false
      }
    }

    return true
  }

  /**
   * Filter the array using the given callback.
   *
   * @template TKey of array-key
   * @template TValue
   *
   * @param  array<TKey, TValue>  $array
   * @param  callable(TValue, TKey): bool  $callback
   * @return array<TKey, TValue>
   */
  public static where<TValue>(
    array: Array<TValue>,
    callback: (value: TValue, key: number) => boolean
  ): TValue[] {
    return array.filter((value, key) => callback(value, key))
  }

  /**
   * Flatten a multi-dimensional array into a single level.
   *
   * @param  iterable  $array
   * @param  int  $depth
   * @return array
   */
  /**
   * Plain `{}` dictionaries mirror PHP associative arrays for flattening.
   */
  private static shouldFlattenAsArray (
    value: unknown
  ): value is unknown[] | Dictionary<unknown> {
    if (Array.isArray(value)) {
      return true
    }

    if (value === null || typeof value !== 'object') {
      return false
    }

    if (value instanceof Collection || value instanceof Date) {
      return false
    }

    return value.constructor === Object
  }

  static flatten (
    array: Iterable<unknown>,
    depth: number = Infinity
  ): unknown[] {
    // const result: unknown[] = []

    // for (let item of array) {
    //   item = item instanceof Collection ? item.all() : item

    //   if (!Arr.shouldFlattenAsArray(item)) {
    //     result.push(item)
    //   } else {
    //     const nested = Array.isArray(item) ? item : Object.values(item)
    //     const values = depth === 1 ? nested : Arr.flatten(nested, depth - 1)

    //     for (const value of values) {
    //       result.push(value)
    //     }
    //   }
    // }

    // return result
    const result = []
    const entries = Object.entries(array)

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
   * Ordered values for a list-shaped dictionary (same order as PHP `array_values`).
   */
  static listValues<TValue>(dictionary: Dictionary<TValue>): TValue[] {
    return Object.values(dictionary)
  }

  /**
   * Determine whether the given value is array accessible.
   *
   * PHP checks `is_array($value) || $value instanceof ArrayAccess`. There
   * is no `ArrayAccess` equivalent in plain TypeScript/JS, so this treats
   * arrays and plain (non-null) objects as "accessible", mirroring how
   * PHP arrays serve as both lists and dictionaries.
   */
  static accessible (value: unknown): value is unknown[] | Dictionary<unknown> {
    if (Array.isArray(value)) {
      return true
    }

    if (value === null || value === undefined) {
      return false
    }

    return typeof value === 'object'
  }

  /**
   * Collapse an array of arrays into a single array.
   *
   * Mirrors `Arr::collapse()`: iterates the given iterable, and for every
   * element that is itself an array, merges its values into the result.
   * Non-array elements are silently dropped, exactly as in PHP (only
   * `Collection` instances and arrays are collapsed; everything else is
   * skipped).
   */
  static collapse<TValue>(array: Iterable<TValue[] | unknown>): TValue[] {
    const results: TValue[] = []

    for (const values of array) {
      if (Arr.isValueArray<TValue>(values)) {
        for (const value of values) {
          results.push(value)
        }
      }
    }

    return results
  }

  /**
   * Narrow helper for `collapse()`: an `Array.isArray` check that keeps
   * the element type as `TValue[]` (instead of the generic `unknown[]`
   * signature `Array.isArray` reports) without a cast at the call site.
   */
  private static isValueArray<TValue>(
    value: TValue[] | unknown
  ): value is TValue[] {
    return Array.isArray(value)
  }

  /**
   * Determine if the given key exists in the provided array.
   *
   * Mirrors `Arr::exists()`. PHP normalizes float/null keys to strings
   * before checking; TypeScript keys are already strings or numbers, so
   * this checks own-property existence for objects and index bounds for
   * arrays (an index within `[0, length)` counts as existing, matching
   * PHP's `array_key_exists` for lists).
   */
  static exists<TValue, TKey extends PropertyKey>(
    array: TValue,
    key: TKey
  ): boolean {
    if (Array.isArray(array)) {
      const index = Number(key)

      if (Number.isInteger(index)) {
        return index >= 0 && index < array.length
      }

      return false
    }

    return Object.prototype.hasOwnProperty.call(array, key)
  }

  /**
   * Return the first element in an iterable passing a given truth test.
   *
   * Mirrors `Arr::first()`. Without a callback, returns the first item
   * (or `default` if empty). With a callback, returns the first item for
   * which the callback returns `true` (or `default` if none match).
   */
  static first<TValue, TKey extends PropertyKey, TDefault = undefined>(
    // array: ArrayableInput<TValue>,
    array: TValue[] | Record<string, TValue>,
    callback?: (value: TValue, key: TKey) => boolean,
    defaultValue?: TDefault | (() => TDefault)
  ): TValue | TDefault | undefined {
    if (callback === undefined) {
      if (array.length === 0) {
        return getValue(defaultValue as TValue)
      }

      if (Array.isArray(array)) {
        return array[0]
      }

      // for (const item of array) {
      //   return item;
      // }

      return getValue(defaultValue as TValue)
    }

    array = this.from(array)

    return Object.entries(array).find(([key, value]) => {
      return callback(value, iterationKey<TKey>(key))
    })?.[1] ?? getValue(defaultValue as TValue)
  }

  /**
   * Get the underlying array of items from the given argument.
   *
   * Mirrors `Arr::from()`. Normalizes arrays, Arrayable objects, and
   * plain iterables/objects into a `Dictionary<TValue>` keyed the way
   * PHP would key an associative array (arrays stay arrays; iterables are
   * indexed from 0; plain objects keep their own keys).
   *
   * Unlike the PHP version, this always returns a `Dictionary`, never a
   * bare list, because callers that need list semantics work with plain
   * arrays directly and never need to call `from()` on them.
   */
  static from<TValue>(
    // items: ArrayableInput<TValue>
    // items: TValue[] | Dictionary<unknown> | Iterable<unknown> | Record<string, unknown>
    items: TValue[] | Record<string, TValue> | Set<TValue>
    // ): Dictionary<TValue> | TValue[] {
  ): TValue[] | Record<string, TValue> {
    if (items === null || items === undefined) {
      throw new Error('Items cannot be represented by a scalar value.')
    }
    if (Array.isArray(items)) {
      return items
    }

    if (items instanceof Set) {
      return Array.from(items)
    }

    if (typeof items === 'object') {
      return Object.entries(items).reduce<Record<string, TValue>>((acc, [key, value]) => {
        acc[key] = value
        return acc
      }, {})
    }

    throw new Error('Items cannot be represented by a scalar value.')
  }

  /**
   * Get an item from an array using "dot" notation.
   *
   * Mirrors `Arr::get()`. Supports both direct keys and dotted paths
   * ("a.b.c") that walk nested accessible values. Returns `default`
   * (resolved via `resolveDefault`, matching PHP's `value()`) when the
   * path cannot be resolved.
   */
  static get<TValue, TDefault = undefined>(
    array: unknown,
    key: string | number | null | undefined,
    defaultValue?: TDefault | (() => TDefault)
  ): TValue | TDefault | undefined {
    if (!Arr.accessible(array)) {
      return resolveDefault(defaultValue)
    }

    if (key === null || key === undefined) {
      return array as TValue
    }

    const stringKey = String(key)

    if (Arr.exists(array, stringKey)) {
      return Arr.readEntry<TValue>(array, stringKey)
    }

    if (!stringKey.includes(DOT_SEPARATOR)) {
      return resolveDefault(defaultValue)
    }

    let cursor: unknown = array

    for (const segment of stringKey.split(DOT_SEPARATOR)) {
      if (Arr.accessible(cursor) && Arr.exists(cursor, segment)) {
        cursor = Arr.readEntry<unknown>(cursor, segment)
      } else {
        return resolveDefault(defaultValue)
      }
    }

    return cursor as TValue
  }

  /**
   * Run a map over each of the items in the array, preserving keys.
   *
   * Mirrors `Arr::map()`. The callback receives `(value, key)` for every
   * entry and the result is rebuilt with the same keys, just like
   * `array_combine(array_keys($array), array_map(...))` in PHP.
   */
  static filter<TKey extends PropertyKey, TValue>(
    array: TValue[] | Record<string, TValue>,
    callback?: (value: TValue, key: TKey) => boolean
  ): TValue[] | Record<string, TValue> {
    if (callback === undefined) {
      if (Array.isArray(array)) {
        return array.filter(Boolean)
      }

      return Object.fromEntries(
        Object.entries(array).filter(([, value]) => Boolean(value))
      )
    }

    if (Array.isArray(array)) {
      return array.filter((value, index) => callback(value, index as TKey))
    }

    return Object.entries(array).reduce<Record<string, TValue>>((acc, [key, value]) => {
      if (callback(value, iterationKey<TKey>(key))) {
        acc[key] = value
      }

      return acc
    }, {})
  }

  static map<TKey extends PropertyKey, TValue, TMapped>(
    array: TValue[] | Record<string, TValue>,
    callback: (value: TValue, key: TKey) => TMapped
  ): TMapped[] | Record<string, TMapped> {
    return Object.entries(array).reduce<TMapped[] | Record<PropertyKey, TMapped>>((acc, [key, value]) => {
      if (Array.isArray(acc)) {
        acc.push(callback(value, iterationKey<TKey>(key)))
      } else {
        acc[key] = callback(value, iterationKey<TKey>(key))
      }

      return acc
    }, Array.isArray(array) ? [] : {})
  }

  /**
   * Return the last element in an array passing a given truth test.
   *
   * @template TKey
   * @template TValue
   * @template TLastDefault
   *
   * @param  iterable<TKey, TValue>  $array
   * @param  (callable(TValue, TKey): bool)|null  $callback
   * @param  TLastDefault|(\Closure(): TLastDefault)  $default
   * @return TValue|TLastDefault
   */
  public static last<TValue, TKey extends PropertyKey, TDefault = undefined>(
    array: TValue[],
    callback?: (value: TValue, key: TKey) => boolean,
    defaultValue?: TDefault | (() => TDefault)
  ): TValue | TDefault | undefined {
    if (array === null || array === undefined) {
      return getValue(defaultValue)
    }

    const normalized = Arr.from<TValue>(array)

    if (callback === undefined) {
      return Object.values(normalized).length === 0
        ? resolveDefault(defaultValue)
        : Object.values(normalized)[Object.values(normalized).length - 1]
    }

    return Arr.first<TValue, TKey, TDefault>(
      Object.values(normalized).reverse(),
      callback,
      defaultValue
    )
  }

  /**
   * Pluck an array of values from an array.
   *
   * Mirrors `Arr::pluck()`. For each item, extracts the value found at
   * dot-path `value` (or the return of a value-callback), optionally
   * keyed by dot-path `key` (or a key-callback). Nested arrays produced
   * by wildcard-free single-level access are read via `dataGet`.
   */
  static pluck<TItem, TValue>(
    array: Iterable<TItem>,
    value: string | string[] | ((item: TItem) => TValue),
    key?: string | string[] | ((item: TItem) => PropertyKey) | null
  ): Array<TValue | undefined> | Dictionary<TValue | undefined> {
    const [valuePath, keyPath] = Arr.explodePluckParameters(value, key)

    const resultsAsList: Array<TValue | undefined> = []
    const resultsAsDictionary: Dictionary<TValue | undefined> = {}
    const keyed = keyPath !== null && keyPath !== undefined

    for (const item of array) {
      const itemValue = Arr.resolvePluckSegment<TItem, TValue>(item, valuePath)

      if (!keyed) {
        resultsAsList.push(itemValue)
        continue
      }

      const itemKey = Arr.resolvePluckSegment<TItem, PropertyKey>(item, keyPath)

      resultsAsDictionary[String(itemKey)] = itemValue
    }

    return keyed ? resultsAsDictionary : resultsAsList
  }

  /**
   * Resolve a single "value" or "key" pluck segment for one item: either
   * calls the provided callback, or walks the exploded dot-path via
   * `dataGet`. Extracted from `pluck()` to avoid an inline function-type
   * cast at each call site.
   */
  private static resolvePluckSegment<TItem, TResult>(
    item: TItem,
    path: string[] | ((item: TItem) => TResult)
  ): TResult | undefined {
    if (typeof path === 'function') {
      return path(item)
    }

    return Arr.dataGet<TResult>(item, path)
  }

  /**
   * Explode the "value" and "key" arguments passed to "pluck".
   *
   * Mirrors the protected `Arr::explodePluckParameters()`. String paths
   * are split on `.` into segments; callbacks and already-exploded arrays
   * pass through unchanged; `null` stays `null`.
   */
  static explodePluckParameters<TItem, TValue>(
    value: string | string[] | ((item: TItem) => TValue),
    key?: string | string[] | ((item: TItem) => PropertyKey) | null
  ): [
      string[] | ((item: TItem) => TValue),
      string[] | ((item: TItem) => PropertyKey) | null
  ] {
    const explodedValue =
      typeof value === 'string' ? value.split(DOT_SEPARATOR) : value

    let explodedKey: string[] | ((item: TItem) => PropertyKey) | null

    if (key === null || key === undefined) {
      explodedKey = null
    } else if (typeof key === 'function' || Array.isArray(key)) {
      explodedKey = key
    } else {
      explodedKey = key.split(DOT_SEPARATOR)
    }

    return [explodedValue, explodedKey]
  }

  /**
   * If the given value is not an array and not null/undefined, wrap it in
   * an array.
   *
   * Mirrors `Arr::wrap()`.
   */
  static wrap<TValue>(value?: TValue | TValue[]): TValue[] {
    if (value === undefined) {
      return []
    }

    return Array.isArray(value) ? value : [value]
  }

  /**
   * Get an item from an array or object using "dot" notation.
   *
   * TypeScript port of the global `data_get()` helper, scoped to the
   * subset `Arr::pluck()` needs: plain segment traversal through
   * accessible values and objects. Wildcard (`*`) and `{first}`/`{last}`
   * segments are intentionally out of scope here, since `pluck()` never
   * produces them for this port's use cases.
   */
  static dataGet<TValue, TDefault = undefined>(
    target: unknown,
    segments: string[],
    defaultValue?: TDefault | (() => TDefault)
  ): TValue | TDefault | undefined {
    let cursor: unknown = target

    for (const segment of segments) {
      if (Arr.accessible(cursor) && Arr.exists(cursor, segment)) {
        cursor = Arr.readEntry<unknown>(cursor, segment)
        continue
      }

      if (Arr.isPlainObjectWithProperty(cursor, segment)) {
        cursor = cursor[segment]
        continue
      }

      return resolveDefault(defaultValue)
    }

    return cursor as TValue
  }

  /**
   * Narrow helper for `dataGet()`: mirrors PHP's `is_object($target) &&
   * isset($target->{$segment})` branch — a plain-object property read
   * distinct from the array-accessible branch handled just above it.
   */
  private static isPlainObjectWithProperty (
    value: unknown,
    property: string
  ): value is Dictionary<unknown> {
    return typeof value === 'object' && value !== null && property in value
  }

  /**
   * Read a single entry out of an array-or-dictionary "accessible" value
   * by key, once its presence has already been confirmed by
   * `Arr.exists()`. Centralizes the index-signature read (and the
   * narrowing that goes with it) so callers never touch bracket access on
   * a `Dictionary` directly.
   */
  private static readEntry<TValue>(
    source: unknown[] | Dictionary<unknown>,
    key: PropertyKey
  ): TValue {
    if (Array.isArray(source)) {
      const index = Number(key)
      const value = source[index]

      return value as TValue
    }

    const stringKey = String(key)

    for (const [entryKey, entryValue] of Object.entries(source)) {
      if (entryKey === stringKey) {
        return entryValue as TValue
      }
    }

    throw new Error(
      `Key "${stringKey}" does not exist; caller must check Arr.exists() first.`
    )
  }
}

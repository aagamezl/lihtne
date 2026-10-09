import { isPlainObject } from 'es-toolkit'

import type { ArrayableInput } from '../types'

import { Collection } from '../Collection'
export class EnumeratesValues<TKey extends PropertyKey, TValue> {
  /**
   * The methods that can be proxied.
   */
  static proxies: string[] = [
    'average',
    'avg',
    'contains',
    'doesntContain',
    'each',
    'every',
    'filter',
    'first',
    'flatMap',
    'groupBy',
    'hasMany',
    'hasSole',
    'keyBy',
    'last',
    'map',
    'max',
    'min',
    'partition',
    'percentage',
    'reject',
    'skipUntil',
    'skipWhile',
    'some',
    'sortBy',
    'sortByDesc',
    'sum',
    'takeUntil',
    'takeWhile',
    'unique',
    'unless',
    'until',
    'when'
  ]

  protected entries: boolean = false

  /**
   * Results array of items from Collection or Arrayable.
   *
   * @param  mixed  $items
   * @return array<TKey, TValue>
   */
  protected getArrayableItems (
    items?: TValue[] | Record<string, TValue>
  ) {
    // return isPrimitive(items) || isEnum(items)
    //   ? Arr.wrap<TValue>(items as TValue)
    //   : Arr.from(items)
    if (Array.isArray(items) /*  || items instanceof Map */) {
      return items
    } else if (items instanceof Collection) {
      return items.all()
    } else if (isPlainObject(items)) {
      this.entries = true
      // return Object.entries(items)
      return items
    } else if (items === undefined) {
      return []
    }

    return [items]
  }

  /**
   * Narrow a runtime object key (always a `string`, per `Object.entries()`)
   * back to the caller's declared key type. See the matching helper on
   * `Arr` for why this cast — the one in this file — is unavoidable.
   */
  private static toKey<TKey extends PropertyKey> (key: string): TKey {
    return key as unknown as TKey
  }

  /**
   * Determine if the given value is callable, but not a string.
   *
   * @param  mixed  $value
   * @return bool
   */
  public useAsCallable (
    value: unknown
  ): value is (...args: never[]) => unknown {
    return typeof value === 'function'
  }

  /**
   * Execute a callback over each item.
   *
   * @param  callable(TValue, TKey): mixed  $callback
   * @return $this
   */
  public each (callback: (value: TValue, key: TKey) => unknown): this {
    const items = (this as { items?: Iterable<unknown> }).items ?? []

    if (Array.isArray(items)) {
      for (const [key, item] of items.entries()) {
        if (callback(item, key) === false) {
          break
        }
      }

      return this
    }

    for (const [key, item] of Object.entries(Object(items))) {
      if (callback(item, key) === false) {
        break
      }
    }

    return this
  }

  /**
   * Narrow helper used only to keep `getArrayableItems()` readable:
   * reports whether a value is one of PHP's "scalar" types (or null),
   * i.e. not an array/object/Arrayable that `Arr.from()` should handle.
   */
  private isScalarLike (
    value: ArrayableInput<TValue> | TValue
  ): value is TValue | null | undefined {
    if (value === null || value === undefined) {
      return true
    }

    if (isArrayable<TValue>(value)) {
      return false
    }

    const scalarType = typeof value

    return (
      scalarType === 'string' ||
      scalarType === 'number' ||
      scalarType === 'boolean'
    )
  }

  /**
     * Get the collection of items as a plain array.
     *
     * @return array<TKey, mixed>
     */
  public toArray (): Array<TValue> {
    return this.map((value: TValue) => value).all()
  }
}

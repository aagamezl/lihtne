import { isPlainObject } from 'es-toolkit'

import { typedEntries } from '../../Support'
import { Collection } from '../Collection'

export abstract class EnumeratesValues<TValue> {
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
   * Rows owned by the class that uses this trait.
   * `Collection` declares the field; these methods only read it.
   */
  protected items!: TValue[] | Record<string, TValue>

  /**
   * Execute a callback over each item.
   *
   * @param  callable(TValue, TKey): mixed  $callback
   * @return $this
   */
  public each (callback: (value: TValue, key: PropertyKey) => unknown): this {
    const items = this.items ?? []

    if (Array.isArray(items)) {
      for (const [key, item] of typedEntries<TValue>(items)) {
        if (callback(item, key) === false) {
          break
        }
      }

      return this
    }

    for (const [key, item] of typedEntries<TValue>(items)) {
      if (callback(item, key) === false) {
        break
      }
    }

    return this
  }

  /**
   * Get the collection of items as a plain array.
   *
   * @return array<TKey, mixed>
   */
  public toArray (): Array<TValue> {
    // return withMap(this).map((value: TValue) => value).all()
    // @ts-expect-error - `map` is not defined on the `EnumeratesValues` class
    return this.map((value: TValue) => value).all()
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
   * Results array of items from Collection or Arrayable.
   *
   * @param  mixed  $items
   * @return array<TKey, TValue>
   */
  protected getArrayableItems (items?: TValue[] | Record<string, TValue>) {
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
}

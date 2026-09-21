import { isPrimitive } from 'es-toolkit'

import { isEnum } from '../../Support'
import { Arr } from '../Arr'
export class EnumeratesValues {
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

  /**
   * Results array of items from Collection or Arrayable.
   *
   * @param  mixed  $items
   * @return array<TKey, TValue>
   */
  public getArrayableItems<TValue>(items: unknown): Iterable<TValue> {
    return isPrimitive(items) || isEnum(items)
      ? Arr.wrap<TValue>(items as TValue)
      : Arr.from(items)
  }

  /**
   * Determine if the given value is callable, but not a string.
   *
   * @param  mixed  $value
   * @return bool
   */
  public useAsCallable (value: unknown): value is Function {
    return typeof value === 'function'
  }

  /**
   * Execute a callback over each item.
   *
   * @param  callable(TValue, TKey): mixed  $callback
   * @return $this
   */
  public each (callback: (item: unknown, key: string | number) => unknown): this {
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
}

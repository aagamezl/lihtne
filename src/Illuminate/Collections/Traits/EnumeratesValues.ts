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
}

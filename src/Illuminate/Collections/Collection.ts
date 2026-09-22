import { isPlainObject } from 'es-toolkit'

import { Macroable } from '../Macroable/Traits/Macroable'
import { mixing } from '../Support/Traits/use'
import { Arr, type MapCallback } from './Arr'
import { EnumeratesValues } from './Traits/EnumeratesValues'

export interface Collection<TValue = unknown, TKey = string | number> extends EnumeratesValues, Macroable { }

export class Collection<TValue = unknown, TKey = string | number> extends mixing().useTrait([EnumeratesValues, Macroable]) {
  /**
   * The items contained in the collection.
   *
   * @var array<TKey, TValue>
   */
  // protected items: Record<string, unknown> | unknown[] = {}
  protected items: Iterable<TValue> | Record<string, TValue>

  /**
   * Create a new collection.
   *
   * @param  \Illuminate\Contracts\Support\Arrayable<TKey, TValue>|iterable<TKey, TValue>|null  $items
   */
  public constructor (items: TValue | TValue[] | Record<string, TValue> = []) {
    super()

    this.items = this.getArrayableItems/* <TValue> */(items)
  }

  /**
   * Create a new instance of the collection.
   *
   * @param  \Illuminate\Contracts\Support\Arrayable<TKey, TValue>|iterable<TKey, TValue>|null  $items
   * @return static
   */
  protected newInstance<TNewValue = TValue>(
    items: TNewValue | TNewValue[] | Record<string, TNewValue> = []
  ): Collection<TNewValue> {
    return new Collection<TNewValue>(items)
  }

  /**
   * Run a map over each of the items.
   *
   * @template TMapValue
   *
   * @param  callable(TValue, TKey): TMapValue  $callback
   * @return static<TKey, TMapValue>
   */
  public map (callback: MapCallback): Collection {
    return this.newInstance(Arr.map(this.items, callback))
  }

  /**
   * Get all of the items in the collection.
   *
   * @return array<TKey, TValue>
   */
  public all ()/* : Iterable<unknown> | Collection */ {
    return this.items
    // return this.entries ? Object.entries(this.items) : Array.from(this.items)
  }

  /**
 * Concatenate values of a given key as a string.
 *
 * @param  (callable(TValue, TKey): mixed)|string|null  $value
 * @param  string|null  $glue
 * @return string
 */
  public implode (value?: MapCallback | string | number, glue?: string): string {
    // if (this.useAsCallable(value)) {
    //   return Object.values(this.map(value).all()).join(glue ?? '')
    // }

    // const first = this.first<unknown, string>()

    // if (
    //   Array.isArray(first) ||
    //   (isPlainObject(first) && typeof first !== 'string')
    // ) {
    //   return this.pluck(value).all().join(glue ?? '')
    // }

    // return Object.values(this.items).join((value as string) ?? '')

    if (this.useAsCallable(value)) {
      return Object.values(this.map(value).all()).join(glue ?? '')
    }

    const first = this.first()

    if (Array.isArray(first) || (isPlainObject(first) && !(first instanceof String))) {
      return Object.values(this.pluck(value).all()).join(glue ?? '')
    }

    return Object.values(this.items).join((value as string) ?? '')
  }

  /**
   * Get the values of a given key.
   *
   * @param  \Closure|string|int|array<array-key, string>|null  $value
   * @param  \Closure|string|null  $key
   * @return static<array-key, mixed>
   */
  public pluck (
    value?: Function | string | number | unknown[],
    key?: Function | string | unknown[]
  ): Collection {
    return this.newInstance(Arr.pluck(this.items, value, key))
  }

  /**
 * Get the first item from the collection passing the given truth test.
 *
 * @template TFirstDefault
 *
 * @param  (callable(TValue, TKey): bool)|null  $callback
 * @param  TFirstDefault|(\Closure(): TFirstDefault)  $default
 * @return TValue|TFirstDefault
 */
  public first (
    callback?: (value: TValue, key: TKey) => boolean,
    defaultValue?: any
  ) {
    return Arr.first<TValue, TKey>(this.items, callback, defaultValue)
  }
}

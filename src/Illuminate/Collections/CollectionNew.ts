import { Arr } from './ArrNew'
import { EnumeratesValues } from './EnumeratesValues'
import { ArrayableInput, Dictionary } from './types'

const EMPTY_GLUE = ''

/**
 * TypeScript port of `Illuminate\Support\Collection`.
 *
 * Only the subset of methods requested for this port is implemented:
 * the constructor, `map`, `all`, `implode`, `pluck`, and `first`.
 *
 * Laravel's `Collection` mixes in `EnumeratesValues` via `use
 * EnumeratesValues;`. Since the trait system itself is out of scope for
 * this port, `Collection` instead extends the `EnumeratesValues` base
 * class to obtain `each`, `getArrayableItems`, and `useAsCallable`.
 */
export class Collection<TKey extends PropertyKey, TValue> extends EnumeratesValues<TKey, TValue> {
  /**
   * Create a new collection.
   *
   * Mirrors `Collection::__construct()`: normalizes whatever was passed
   * in through `getArrayableItems()` before storing it.
   */
  constructor (items: ArrayableInput<TKey, TValue> = []) {
    super({})

    this.items = this.getArrayableItems(items)
  }

  /**
   * Create a new instance of the collection.
   *
   * Mirrors the protected `Collection::newInstance()`, used internally
   * wherever PHP would call `new static($items)` to preserve the
   * concrete subclass. TypeScript has no `static::class` equivalent that
   * works generically across subclasses without reflection, so this
   * always builds a plain `Collection` — faithful for this port's scope,
   * since no subclassing is exercised here.
   */
  protected newInstance (items: ArrayableInput<TKey, TValue> = []): Collection<TKey, TValue> {
    return new Collection<TKey, TValue>(items)
  }

  /**
   * Get all of the items in the collection.
   *
   * Mirrors `Collection::all()`.
   */
  all (): Dictionary<TValue> {
    return this.items
  }

  /**
   * Get the first item from the collection passing the given truth test.
   *
   * Mirrors `Collection::first()`, which delegates straight to
   * `Arr::first()` over the collection's underlying items.
   */
  first<TDefault = undefined> (
    callback?: (value: TValue, key: TKey) => boolean,
    defaultValue?: TDefault | (() => TDefault)
  ): TValue | TDefault | undefined {
    return Arr.first<TValue, TKey, TDefault>(this.items, callback, defaultValue)
  }

  /**
   * Concatenate values of a given key as a string.
   *
   * Mirrors `Collection::implode()`:
   *
   *   if ($this->useAsCallable($value)) {
   *       return implode($glue ?? '', $this->map($value)->all());
   *   }
   *
   *   $first = $this->first();
   *
   *   if (is_array($first) || (is_object($first) && ! $first instanceof Stringable)) {
   *       return implode($glue ?? '', $this->pluck($value)->all());
   *   }
   *
   *   return implode($value ?? '', $this->items);
   *
   * TypeScript has no `Stringable` interface distinct from "has a
   * `toString` other than the default `Object.prototype.toString`", so
   * that check is approximated: plain objects/arrays are treated as
   * needing `pluck()`, while primitives (and values with a custom
   * `toString`) are joined directly.
   *
   * `implode`'s `value` parameter is a plain `string | function` union
   * here (narrower than `EnumeratesValues.useAsCallable`'s general
   * "any non-string callable" check), so a native `typeof value ===
   * 'function'` check narrows both branches without needing that helper
   * or a cast back to the specific callback shape.
   */
  implode (value?: string | ((item: TValue, key: TKey) => unknown), glue?: string): string {
    if (typeof value === 'function') {
      const mapped = this.map(value)

      return Object.values(mapped.all()).join(glue ?? EMPTY_GLUE)
    }

    const first = this.first()

    if (this.isPlainArrayOrObject(first)) {
      const plucked = this.pluck<unknown>(value)

      return Object.values(plucked.all()).join(glue ?? EMPTY_GLUE)
    }

    return Object.values(this.items).join(value ?? EMPTY_GLUE)
  }

  /**
   * Run a map over each of the items.
   *
   * Mirrors `Collection::map()`, which delegates to `Arr::map()`.
   */
  map<TMapped> (callback: (value: TValue, key: TKey) => TMapped): Collection<TKey, TMapped> {
    const mapped = Arr.map<TKey, TValue, TMapped>(this.items, callback)

    return new Collection<TKey, TMapped>(mapped)
  }

  /**
   * Get the values of a given key.
   *
   * Mirrors `Collection::pluck()`, which delegates to `Arr::pluck()`.
   */
  pluck<TPlucked> (
    value: string | string[] | ((item: TValue) => TPlucked),
    key?: string | string[] | ((item: TValue) => PropertyKey) | null
  ): Collection<PropertyKey, TPlucked | undefined> {
    const plucked = Arr.pluck<TValue, TPlucked>(Object.values(this.items), value, key)

    return new Collection<PropertyKey, TPlucked | undefined>(plucked)
  }

  /**
   * Narrow helper used only to keep `implode()` readable: approximates
   * PHP's `is_array($first) || (is_object($first) && ! $first instanceof
   * Stringable)` check.
   */
  private isPlainArrayOrObject (value: unknown): boolean {
    if (value === null || typeof value !== 'object') {
      return false
    }

    if (Array.isArray(value)) {
      return true
    }

    const hasCustomToString = typeof (value as { toString?: unknown }).toString === 'function' &&
      (value as { toString: () => string }).toString !== Object.prototype.toString

    return !hasCustomToString
  }
}

// import { isPlainObject, isPrimitive } from 'es-toolkit'
// import type { MapCallback } from './Arr'

// // export type CollectionItems = Array<any> | Record<string, unknown>
// export type CollectionItems = Array<unknown> | CollectionNew | Record<string, unknown>

// // export class CollectionNew<T> extends Array<T> {
// export class CollectionNew<TValue = any, TKey = any> {
//   protected items: Array<TValue>


//   constructor(items: TValue) {
//     this.items = this.getArrayableItems(items)
//   }

//   /**
//   * Results array of items from Collection or Arrayable.
//   *
//   * @param  {*}  items
//   * @return {Array}
//   */
//   protected getArrayableItems(items: TValue): Array<TValue> {
//     // if (Array.isArray(items)) {
//     //   return items
//     // } else if (items instanceof CollectionNew) {
//     //   return items.all()
//     // } else if (isPlainObject(items)) {
//     //   return [items]
//     // } else if (items === undefined) {
//     //   return []
//     // }

//     // return [items]
//     if (isPrimitive(items) || isPlainObject(items) || typeof items === 'object') {
//       return [items]
//     }

//     if (Array.isArray(items)) {
//       return items
//     }

//     return [items]
//   }

//   public all(): Array<unknown> | CollectionNew {
//     return this.items
//   }

//   public first(
//     callback?: (value: TValue, key: TKey) => boolean,
//     defaultValue?: unknown
//   ) {
//     if (callback === undefined) {
//       if (this.items.length === 0) {
//         return defaultValue
//       }

//       return this.items.at(0)
//     }

//     const item = this.items.find((value, key) => {
//       return callback(value, key as TKey)
//     })

//     return item ?? defaultValue
//     // if (callback !== undefined) {

//     //   return item ?? [defaultValue]
//     // }

//     // return this.items.at(0)

//     // return [defaultValue]
//   }

//   /**
//  * Create a new instance of the collection.
//  *
//  * @param  \Illuminate\Contracts\Support\Arrayable<TKey, TValue>|iterable<TKey, TValue>|null  items
//  * @return static
//  */
//   protected newInstance<T>(items: T[] = []): CollectionNew<T> {
//     return new CollectionNew<T>(items as T)
//   }

//   public count(): number {
//     return this.items.length
//   }

//   protected useAsCallable(value: unknown) {
//     return typeof value !== 'string' && typeof value === 'function'
//   }

//  public map (callback: Function): CollectionNew {
//    return this.newInstance(this.items.map((value, index) => callback(value, index)))
//   }

//   public implode(value?: MapCallback, glue?: string) {
//     if (this.useAsCallable(value)) {
//       return this.map(value).all().join(glue ?? '')
//     }

//     const first = this.first()

//     if (Array.isArray(first) || (isPlainObject(first) && typeof first !== 'string')) {
//       return this.pluck(value).all().join(glue ?? '')
//     }

//     return this.items.join(value ?? '')
//   }

//   public pluck<T extends object>(
//     items: T[],
//     valuePath?: string,
//     keyPath?: string
//   ): CollectionNew {
//     function getByPath<T extends object, R = unknown>(obj: T, path: string): R {
//       return path.split('.').reduce<any>((acc, key) => acc?.[key], obj);
//     }

//     if (!keyPath) {
//       // Simple pluck: return array of values
//       return items.map(item => getByPath(item, valuePath));
//     }

//     // Keyed pluck: return object keyed by keyPath
//     const result: Record<string | number, any> = {};

//     for (const item of items) {
//       const key = getByPath(item, keyPath);
//       const value = getByPath(item, valuePath);

//       result[key as any] = value;
//     }

//     return this.newInstance(result);
//   }
// }

import { isPlainObject } from 'es-toolkit'

import type { ArrayableInput, Dictionary } from './types'

import { Arr } from './Arr'
import { EnumeratesValues } from './EnumeratesValues'

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
  protected newInstance<TNewValue = TValue>(
    items: ArrayableInput<TKey, TNewValue> = []
  ): Collection<TKey, TNewValue> {
    return new Collection<TKey, TNewValue>(items)
  }

  /**
   * Get all of the items in the collection.
   *
   * Mirrors `Collection::all()`. List-shaped collections (dense numeric
   * keys) return a real array so callers can use `.length` / `.join()`.
   * Associative collections keep the underlying dictionary.
   */
  all (): Dictionary<TValue> | TValue[] {
    if (Arr.isList(this.items)) {
      return Arr.listValues(this.items)
    }

    return this.items
  }

  /**
   * Collapse the collection of items into a single array.
   *
   * @return static<int, mixed>
   */
  public collapse (): Collection<TKey, TValue> {
    return this.newInstance(Arr.collapse(Object.values(this.items)))
  }

  /**
   * Get the first item from the collection passing the given truth test.
   *
   * Mirrors `Collection::first()`, which delegates straight to
   * `Arr::first()` over the collection's underlying items.
   */
  first<TDefault = undefined>(
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
      return this.joinAll(this.map(value).all(), glue ?? EMPTY_GLUE)
    }

    const first = this.first()

    if (
      Array.isArray(first) ||
      (isPlainObject(first) && !(first instanceof String))
    ) {
      return this.joinAll(this.pluck<unknown>(value as string).all(), glue ?? EMPTY_GLUE)
    }

    return this.joinAll(this.items, value ?? EMPTY_GLUE)
  }

  /**
   * Run a map over each of the items.
   *
   * Mirrors `Collection::map()`, which delegates to `Arr::map()`.
   */
  map<TMapped>(callback: (value: TValue, key: TKey) => TMapped): Collection<TKey, TMapped> {
    const mapped = Arr.map<TKey, TValue, TMapped>(this.items, callback)

    return this.newInstance<TMapped>(mapped)
  }

  /**
   * Get the values of a given key.
   *
   * Mirrors `Collection::pluck()`, which delegates to `Arr::pluck()`.
   */
  pluck<TPlucked>(
    value: string | string[] | ((item: TValue) => TPlucked),
    key?: string | string[] | ((item: TValue) => PropertyKey) | null
  ): Collection<PropertyKey, TPlucked | undefined> {
    const plucked = Arr.pluck<TValue, TPlucked>(Object.values(this.items), value, key)

    return new Collection<PropertyKey, TPlucked | undefined>(plucked)
  }

  /**
   * Join collection contents whether `all()` returned a list or dictionary.
   */
  private joinAll (
    items: Dictionary<unknown> | unknown[] | Dictionary<TValue> | TValue[],
    glue: string
  ): string {
    const values = Array.isArray(items) ? items : Object.values(items)

    return values.join(glue)
  }
}

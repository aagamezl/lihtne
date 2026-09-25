import { Arr } from './Arr'
import { type ArrayableInput, type Dictionary, isArrayable } from './types'

const CALLBACK_STOP_SIGNAL = false

/**
 * TypeScript port of `Illuminate\Support\Traits\EnumeratesValues`.
 *
 * Laravel implements this as a PHP trait mixed into `Collection` (and
 * `LazyCollection`). Per this port's scope, it is written here as a plain
 * base class instead: the trait/mixin composition itself is handled
 * separately, outside this port.
 *
 * Only the subset of methods requested for this port is implemented:
 * `getArrayableItems`, `useAsCallable`, and `each`. Both `items` and the
 * constructor exist here only so `each()` has something concrete to
 * iterate — `Collection` overrides/extends this storage when it composes
 * with this class.
 */
export class EnumeratesValues<TKey extends PropertyKey, TValue> {
  /**
   * Mirrors the underlying `$items` array every method in this trait
   * reads from. Stored as a `Dictionary` so both list-like (numeric) and
   * associative (string) keys behave the way PHP arrays do.
   */
  protected items: Dictionary<TValue>

  constructor (items: Dictionary<TValue> = {}) {
    this.items = items
  }

  /**
   * Create a collection of all elements that do not pass a given truth test.
   *
   * @param  (callable(TValue, TKey): bool)|bool|TValue  $callback
   * @return static
   */
  public reject (
    callback: (value: TValue, key: TKey) => boolean | TValue = true
  ): this {
    const useAsCallable = this.useAsCallable(callback)

    return this.filter((value, key) => {
      return useAsCallable
        ? !callback(value, key)
        : value !== callback
    })
  }

  /**
   * Execute a callback over each item.
   *
   * Mirrors `EnumeratesValues::each()`. Iterates `$this` (i.e. the
   * underlying items, in insertion order) and stops early if the
   * callback returns exactly `false`, matching PHP's `=== false` check.
   */
  each (callback: (value: TValue, key: TKey) => unknown): this {
    for (const [key, value] of Object.entries(this.items)) {
      const result = callback(value, EnumeratesValues.toKey<TKey>(key))

      if (result === CALLBACK_STOP_SIGNAL) {
        break
      }
    }

    return this
  }

  /**
   * Narrow a runtime object key (always a `string`, per `Object.entries()`)
   * back to the caller's declared key type. See the matching helper on
   * `Arr` for why this cast — the one in this file — is unavoidable.
   */
  private static toKey<TKey extends PropertyKey>(key: string): TKey {
    return key as unknown as TKey
  }

  /**
   * Results array of items from Collection or Arrayable.
   *
   * Mirrors the protected `EnumeratesValues::getArrayableItems()`:
   *
   *   is_null($items) || is_scalar($items) || $items instanceof UnitEnum
   *       ? Arr::wrap($items)
   *       : Arr::from($items)
   *
   * `null`/`undefined` and scalar values are wrapped via `Arr.wrap()`;
   * everything else (arrays, Arrayable objects, plain iterables/objects)
   * is normalized via `Arr.from()`. TypeScript has no `UnitEnum`
   * equivalent, so that branch is omitted.
   */
  protected getArrayableItems (items: ArrayableInput<TKey, TValue> | TValue): Dictionary<TValue> {
    if (this.isScalarLike(items)) {
      const wrapped = Arr.wrap(items)
      const result: Dictionary<TValue> = {}

      wrapped.forEach((value, index) => {
        result[index] = value
      })

      return result
    }

    return Arr.from(items)
  }

  /**
   * Determine if the given value is callable, but not a string.
   *
   * Mirrors the protected `EnumeratesValues::useAsCallable()`. PHP
   * distinguishes "callable" from "plain string" because a string can
   * itself be a valid PHP callable (a function name); in TypeScript the
   * equivalent distinction is simply "is this a function".
   */
  protected useAsCallable (value: unknown): value is (...args: never[]) => unknown {
    return typeof value !== 'string' && typeof value === 'function'
  }

  /**
   * Narrow helper used only to keep `getArrayableItems()` readable:
   * reports whether a value is one of PHP's "scalar" types (or null),
   * i.e. not an array/object/Arrayable that `Arr.from()` should handle.
   */
  private isScalarLike (
    value: ArrayableInput<TKey, TValue> | TValue
  ): value is TValue | null | undefined {
    if (value === null || value === undefined) {
      return true
    }

    if (isArrayable<TKey, TValue>(value)) {
      return false
    }

    const scalarType = typeof value

    return scalarType === 'string' || scalarType === 'number' || scalarType === 'boolean'
  }
}

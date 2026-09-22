/**
 * Shared type contracts used across the Arr / Collection port.
 *
 * These mirror the PHP concepts Laravel leans on (`Arrayable`, "array
 * accessible" values, dot-notation keys) without resorting to `any`.
 */

/**
 * Mirrors `Illuminate\Contracts\Support\Arrayable`.
 *
 * Any object that can produce a plain array/record representation of
 * itself. `Collection` itself implements this.
 */
export interface Arrayable<TKey extends PropertyKey, TValue> {
  toArray(): Dictionary<TValue>
}

/**
 * A "dictionary" shape: a plain object keyed by string, standing in for
 * PHP's single associative-array type (TypeScript has no native
 * ArrayAccess type, so object-literal records fill that role here).
 *
 * Deliberately keyed by `string`, not the wider `PropertyKey` (which also
 * includes `symbol` and `number`): `Object.entries()`/`Object.keys()`
 * only widen to the precise `[string, TValue][]` shape this port relies
 * on throughout when the index signature itself is `string`-keyed. The
 * `TKey` type parameter on `Arrayable` and elsewhere in this port stays
 * generic for the public API surface — only this internal storage type is
 * deliberately narrowed to `string`.
 */
export type Dictionary<TValue> = Record<string, TValue>

/**
 * Anything Arr/Collection helpers can read entries from: a JS array, a
 * plain record/dictionary, or something Arrayable.
 */
export type ArrayableInput<TKey extends PropertyKey, TValue> =
  | TValue[]
  | Dictionary<TValue>
  | Arrayable<TKey, TValue>
  | Iterable<TValue>
  | null
  | undefined

/**
 * Type guard for the Arrayable contract, used in place of `instanceof`
 * checks against an interface (interfaces have no runtime representation
 * in TypeScript, so this checks for the `toArray` method shape instead).
 */
export function isArrayable<TKey extends PropertyKey, TValue>(
  value: unknown
): value is Arrayable<TKey, TValue> {
  if (value === null || typeof value !== 'object') {
    return false
  }

  const candidate = value as { toArray?: unknown }

  return typeof candidate.toArray === 'function'
}

/**
 * A callback shaped like PHP's `callable(TValue, TKey): TReturn` closures
 * used throughout Arr/Collection (e.g. the `first()` predicate, `map()`
 * transformer).
 */
export type ItemCallback<TKey extends PropertyKey, TValue, TReturn> = (
  value: TValue,
  key: TKey
) => TReturn

/**
 * PHP's `value()` helper: if given a Closure, call it and return the
 * result; otherwise return the value itself. Used for lazily-evaluated
 * `$default` arguments throughout Arr.
 */
export function resolveDefault<TValue>(
  value: TValue | (() => TValue)
): TValue {
  if (typeof value === 'function') {
    const resolver = value as () => TValue

    return resolver()
  }

  return value
}

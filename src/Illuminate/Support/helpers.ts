import { HigherOrderTapProxy } from './HigherOrderTapProxy'

export type Entries<T> = {
  [K in keyof T]: [K, T[K]]
}[keyof T][]

export type Prettify<T> = {
  [K in keyof T]: Prettify<T[K]>
} & {}

export type ChangeCase = 'CASE_LOWER' | 'CASE_UPPER'

export const isEmpty = (value: unknown): boolean => {
  return value === undefined || value === 0 || value === false || value === null
}

/**
 * PHP array keys are integers for lists; `Object.entries()` only yields
 * strings. Match legacy `Arr::map()` by coercing numeric string keys.
 */
export const iterationKey = <TKey extends PropertyKey>(key: PropertyKey): TKey => {
  return (isNumeric(key) ? Number(key) : key) as TKey
}

export const isEnum = (value: unknown): boolean => {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const values = Object.values(value as Record<string, unknown>)

  if (values.length === 0) {
    return false
  }

  return values.every((v) => typeof v === 'string' || typeof v === 'number')
}

export const isNumeric = (value: PropertyKey): boolean => {
  return !Array.isArray(value) && Number(value) - Number(value) + 1 >= 0
}

export const isSet = (value: unknown): boolean => {
  return value !== undefined && value !== null
}

export const iterableValues = <TValue>(
  // value: Record<string, TValue> | TValue[]
  value: Iterable<TValue>
): Iterable<TValue> => {
  return Array.isArray(value) ? value : Object.values(value)
}

export const value = <TValue>(
  value: TValue | ((...args: PropertyKey[]) => TValue),
  ...args: PropertyKey[]
): TValue => {
  return value instanceof Function ? value(...args) : value
}

export const typedEntries = <T extends object>(obj: T): Entries<T> => {
  return Object.entries(obj) as Entries<T>
}

/**
 * Make a string's first character uppercase
 *
 * @param  {string}  value
 * @return {string}
 */
export const ucfirst = (value: string): string => {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

/**
 * Call the given Closure with the given value then return the value.
 *
 * @template TValue
 *
 * @param  TValue  $value
 * @param  (callable(TValue): mixed)|null  $callback
 * @return ($callback is null ? \Illuminate\Support\HigherOrderTapProxy<TValue> : TValue)
 */
export function tap<TValue> (value: TValue): HigherOrderTapProxy<TValue>
export function tap<TValue> (
  value: TValue,
  callback: (value: TValue) => unknown
): TValue
export function tap<TValue> (
  value: TValue,
  callback?: (value: TValue) => unknown
): TValue | HigherOrderTapProxy<TValue> {
  if (callback === undefined) {
    return new HigherOrderTapProxy(value)
  }

  callback(value)

  return value
}

export const changeKeyCase = (
  value: Record<string, unknown>,
  changeCase: ChangeCase = 'CASE_LOWER'
): Record<string, unknown> => {
  const casefunction =
    changeCase === 'CASE_LOWER' ? 'toLowerCase' : 'toUpperCase'
  return Object.fromEntries(
    Object.entries(value).map(([key, value]) => [key[casefunction](), value])
  )
}

/**
 * Determine if a value is set, mimicking PHP's isset().
 *
 * Returns false for undefined and null, and true for any other value,
 * including falsy ones such as false, 0, '' and [].
 */
export const isValueSet = <T>(value: T | null | undefined): value is T => {
  return value !== undefined && value !== null
}

/**
 *
 * @param {string} str
 * @returns {string}
 */
export const hex2bin = (str: string): string => {
  // Treat each character's code as a byte (0‑255)
  let hex = ''

  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i)
    if (code > 255) {
      throw new Error('Byte value exceeds 255')
    }

    hex += code.toString(16).padStart(2, '0')
  }

  return hex
}

export const findKey = <TKey extends PropertyKey, TValue>(
  obj: Record<TKey, TValue>,
  callback: ((value: TValue, key: TKey) => boolean) | undefined
): TKey | undefined => {
  for (const key in obj) {
    if (callback && callback(obj[key], key as TKey)) {
      return key as TKey
    }
  }

  return undefined
}

export const isObject = (
  value: unknown
): value is Record<PropertyKey, unknown> => {
  return value !== null && typeof value === 'object'
}

/**
 * Get the first element of an array. Useful for method chaining.
 *
 * @param  {any}  value
 * @return {unknown}
 */
export const head = <TValue>(
  value: TValue[] | Record<string, TValue>
): TValue | undefined => {
  if (Array.isArray(value)) {
    return value[0]
  }

  return Object.values(value)[0]
}

/**
 * Get the first element of an array. Useful for method chaining.
 *
 * @param  {any}  array
 * @return {any}
 */
export const reset = <TValue>(
  value: TValue[] | Record<string, TValue>
): TValue | undefined => {
  return head(value)
}

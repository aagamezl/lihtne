import { isPlainObject } from '@devnetic/utils'

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
export const iterationKey = <TKey extends PropertyKey>(
  key: PropertyKey
): TKey => {
  return (isNumeric(key) ? Number(key) : key) as TKey
}

export const objectDiffKey = <TTarget extends Record<string, unknown>, TFrom extends Record<string, unknown>[]>(
  target: TTarget,
  ...from: TFrom
): Partial<TTarget> => {
  // const keys = from.flatMap(obj => Object.keys(obj))
  // return Object.fromEntries(
  //   Object.entries(target).filter(([key]) => !keys.includes(key))
  // )
  const keys = from.reduce((result, current) => {
    return result.concat(Object.keys(current))
  }, [])

  return Object.entries(target).reduce((result, [key, value]) => {
    if (!keys.includes(key)) {
      result[key] = value
    }

    return result
  }, {})
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

/**
 * `isPlainObject` does not narrow, so `set` would still see a record in the
 * computed property name of the scalar branch.
 */
export const isPlainRecord = (
  key: Record<string, unknown> | string | number
): key is Record<string, unknown> => {
  return isPlainObject(key)
}

export const getValue = <TValue>(
  value: TValue | ((...args: PropertyKey[]) => TValue),
  ...args: PropertyKey[]
): TValue => {
  return value instanceof Function ? value(...args) : value
}

export function typedEntries<TValue> (
  obj: Record<string, TValue> | readonly TValue[]
): [string, TValue][]
export function typedEntries (obj: object): [string, unknown][] {
  return Object.entries(obj)
}

/**
 * Get a value from the array, and remove it.
 *
 * @param  {Record<string, unknown>}  array
 * @param  {string}  key
 * @param  {any}  [defaultValue=undefined]
 * @return {any}
 */
export const pull = <
  TRecord extends Record<string, unknown>,
  TKey extends keyof TRecord & string
>(
  array: TRecord,
  key: TKey,
  defaultValue?: TRecord[TKey]
): TRecord[TKey] | undefined => {
  const value = array[key] ?? defaultValue

  delete array[key]

  return value
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

type ChangeRecordKeyCase<
  TValue extends Record<string, unknown>,
  TCase extends ChangeCase
> = {
  [
  K in keyof TValue as K extends string
    ? TCase extends 'CASE_LOWER'
      ? Lowercase<K>
      : Uppercase<K>
    : K
  ]: TValue[K]
}

export function changeKeyCase<TValue extends Record<string, unknown>> (
  value: TValue,
  changeCase?: 'CASE_LOWER'
): ChangeRecordKeyCase<TValue, 'CASE_LOWER'>
export function changeKeyCase<TValue extends Record<string, unknown>> (
  value: TValue,
  changeCase: 'CASE_UPPER'
): ChangeRecordKeyCase<TValue, 'CASE_UPPER'>
export function changeKeyCase<TValue extends Record<string, unknown>> (
  value: TValue,
  changeCase: ChangeCase
): Record<string, unknown>
export function changeKeyCase (
  value: Record<string, unknown>,
  changeCase: ChangeCase = 'CASE_LOWER'
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).map(([key, value]) => [
      key[changeCase === 'CASE_LOWER' ? 'toLowerCase' : 'toUpperCase'](),
      value
    ])
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

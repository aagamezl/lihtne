export type Entries<T> = {
  [K in keyof T]: [K, T[K]]
}[keyof T][]

export type Prettify<T> = {
  [K in keyof T]: Prettify<T[K]>;
} & {}

export const isEmpty = (value: unknown): boolean => {
  return value === undefined || value === 0 || value === false || value === null
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

export const isNumeric = (value: string | number): boolean => {
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

export const value = (value: unknown, ...args: unknown[]): unknown => {
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

export const findKey = <TKey, TValue>(
  obj: any,
  callback: ((value: TValue, key: TKey) => boolean) | undefined
): TKey | undefined => {
  for (const key in obj) {
    if (callback && callback(obj[key], key as TKey)) {
      return key as TKey
    }
  }

  return undefined
}

export const isObject = (value: unknown): value is Record<PropertyKey, unknown> => {
  return value !== null && typeof value === 'object'
}

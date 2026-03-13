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

export const isEmpty = (value: unknown): boolean => {
  return value === undefined || value === 0 || value === false;
};

export const isEnum = (value: unknown): boolean => {
  if (typeof value !== "object" || value === null) {
    return false
  }

  const values = Object.values(value as Record<string, unknown>)

  if (values.length === 0) {
    return false
  }

  return values.every(
    v => typeof v === "string" || typeof v === "number"
  )
};

export const isNumeric = (value: any): boolean => {
  return !Array.isArray(value) && (value - parseFloat(value) + 1) >= 0
};

export const iterableValues = <TValue>(value: Record<string, TValue> | TValue[]): Iterable<TValue> => {
  return Array.isArray(value)
    ? value
    : Object.values(value);
}

export const value = (value: any, ...args: any[]) => {
  return value instanceof Function ? value(...args) : value;
};
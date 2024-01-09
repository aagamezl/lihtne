import { lstatSync } from 'fs'

import { getValue, isFalsy, isNil, isObject, isTruthy } from '@devnetic/utils'

import HigherOrderTapProxy from './HigherOrderTapProxy.js'

export const castArray = (value) => {
  if (value === undefined) {
    return []
  }

  return Array.isArray(value) ? value : [value]
}
/**
 * Returns an array with all keys from array lowercased or uppercased.
 *
 * @param {Record<string, unknown>} value
 * @param {string} [changeCase=CAMEL_CASE]
 * @returns {Record<string, unknown>}
 */
export const changeKeyCase = (value, changeCase = 'CASE_LOWER') => {
  const result = {}
  if (isTruthy(value) && typeof value === 'object') {
    const casefunction = (isFalsy(changeCase) || changeCase === 'CASE_LOWER') ? 'toLowerCase' : 'toUpperCase'
    for (const key in value) {
      result[key[casefunction]()] = value[key]
    }
    return result
  }
  return value
}

export const clone = (target) => {
  if (isNil(target) || !isObject(target)) {
    return target
  }

  return Object.create(Object.getPrototypeOf(target), Object.getOwnPropertyDescriptors(target))
}

export const isDirectory = (path) => {
  try {
    return lstatSync(path).isDirectory()
  } catch (error) {
    return false
  }
}

export const ksort = (value) => {
  return Object.keys(value)
    .sort()
    .reduce((result, key) => {
      result[key] = value[key]

      return result
    }, {})
}

export const objectDiffKey = (target, ...from) => {
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

/**
 * Get a value from the array, and remove it.
 *
 * @param  {Record<string, unknown>}  array
 * @param  {string}  key
 * @param  {any}  [defaultValue=undefined]
 * @return {any}
 */
export const pull = (array, key, defaultValue) => {
  const value = getValue(array, key, defaultValue)

  delete array[key]

  return value
}

export const spaceship = (a, b) => {
  if (a === b) {
    return 0
  }

  if (a > b || a === null || b === null || a === undefined || b === undefined) {
    return 1
  }

  if (a < b) {
    return -1
  }

  throw new Error(`Spaceship failed on ${a} and ${b}`)
}

/**
 * Call the given Closure with the given value then return the value.
 *
 * @param  {unknown}  value
 * @param  {callable}  [callback=undefined]
 * @return {unknown}
 */
export const tap = (value, callback) => {
  if (callback === undefined) {
    return new HigherOrderTapProxy(value)
  }

  callback(value)

  return value
}

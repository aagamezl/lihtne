import { lstatSync } from 'fs'

import { getValue, isFalsy, isNil, isObject, isTruthy } from '@devnetic/utils'

import HigherOrderTapProxy from './HigherOrderTapProxy.js'

export const arrayDiff = (array1, array2) => {
  return array1.filter(value => !array2.includes(value))
}

export const mergeArrays = (array1, array2) => {
  const result = []

  for (const element of array1) {
    if (typeof element === 'object' && element !== null && !Array.isArray(element)) {
      // Check if an object with the same key already exists in the result array
      const existingObject = result.find(obj => typeof obj === 'object' && obj !== null && Object.keys(obj).some(key => element[key] !== undefined))

      // If an existing object is found, override its properties
      if (existingObject) {
        Object.assign(existingObject, element)
      } else {
        // Otherwise, add the object to the result array
        result.push({ ...element })
      }
    } else {
      // For non-object elements, add them directly to the result array
      result.push(element)
    }
  }

  for (const element of array2) {
    if (typeof element === 'object' && element !== null && !Array.isArray(element)) {
      // Check if an object with the same key already exists in the result array
      const existingObject = result.find(obj => typeof obj === 'object' && obj !== null && Object.keys(obj).some(key => element[key] !== undefined))

      // If an existing object is found, override its properties
      if (existingObject) {
        Object.assign(existingObject, element)
      } else {
        // Otherwise, add the object to the result array
        result.push({ ...element })
      }
    } else {
      // For non-object elements, add them directly to the result array
      result.push(element)
    }
  }

  return result
}

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

export const explode = (delimiter, string, limit = 0) => {
  if (delimiter === '' || typeof delimiter !== 'string') {
    throw new Error('Invalid delimiter')
  }

  if (typeof string !== 'string') {
    throw new Error('Invalid input string')
  }

  if (limit === 0) {
    return string.split(delimiter)
  }

  const result = []
  let currentIndex = 0

  while (result.length < limit - 1) {
    const nextIndex = string.indexOf(delimiter, currentIndex)

    if (nextIndex === -1) {
      break
    }

    result.push(string.slice(currentIndex, nextIndex))
    currentIndex = nextIndex + delimiter.length
  }

  result.push(string.slice(currentIndex))

  return result
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

export const pregMatchAll = (subject, regex) => {
  const matches = Array.from(subject.matchAll(regex), match => match[0])

  const keys = matches.map(match => match[1])

  return [[...matches], [...keys]]
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

import { fstatSync, lstatSync } from 'node:fs'
import net from 'node:net'
import { Stream } from 'node:stream'

import { getValue, isFalsy, isTruthy } from '@devnetic/utils'

import HigherOrderTapProxy from './HigherOrderTapProxy.js'

export const arrayDiff = (array1, array2) => {
  return array1.filter(value => !array2.includes(value))
}

/**
 *
 * @param {string} str
 * @returns {string}
 */
export const bin2hex = (str) => {
  return str.split('').reduce((result, char) => {
    const hexCode = char.charCodeAt().toString(16)

    if (hexCode.length < 2) {
      result += '0' + hexCode
    } else {
      result += hexCode
    }

    return result
  }, '')
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

export const clone = (obj, hash = new WeakMap()) => {
  // if (isNil(target) || !isObject(target)) {
  //   return target
  // }

  // return Object.create(Object.getPrototypeOf(target), Object.getOwnPropertyDescriptors(target))

  if (Object(obj) !== obj || obj instanceof Function) {
    // Primitives and functions
    return obj
  }

  if (hash.has(obj)) {
    // Cyclic reference
    return hash.get(obj)
  }

  let result

  if (obj instanceof Set) {
    result = new Set([...obj].map(item => clone(item, hash)))
  } else if (obj instanceof Map) {
    result = new Map([...obj].map(([key, val]) => [clone(key, hash), clone(val, hash)]))
  } else if (obj instanceof Date) {
    result = new Date(obj)
  } else if (obj instanceof RegExp) {
    result = new RegExp(obj.source, obj.flags)
  } else if (Array.isArray(obj)) {
    result = obj.map(item => clone(item, hash))
  } else if (typeof obj === 'object') {
    // Objects with prototype
    result = Object.create(Object.getPrototypeOf(obj))
    hash.set(obj, result)

    for (const key in obj) {
      if (Object.hasOwn(obj, key)) {
        result[key] = clone(obj[key], hash)
      }
    }
  }

  return result
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

export const hex2bin = str => {
  return str.match(/.{1,2}/g).reduce((result, hex) => {
    const charCode = parseInt(hex, 16)

    result += String.fromCharCode(charCode)

    return result
  }, '')
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

export const arrayMerge = (value1, value2) => {
  if (typeof value1 === 'object' && typeof value2 === 'object') {
    // Merge dictionaries (objects)
    if (Array.isArray(value1)) {
      // Merge arrays
      return value1.concat(value2)
    } else {
      // Merge objects
      const mergedObject = { ...value1, ...value2 }
      return mergedObject
    }
  } else {
    throw new Error('Both input arguments must be either dictionaries (objects) or arrays.')
  }
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

export const pregMatchAll = (subject, regex) => {
  const matches = Array.from(subject.matchAll(regex), match => match[0])

  const keys = matches.map(match => match[1])

  return [[...matches], [...keys]]
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

export const strReplace = (search, replace, subject, countObj) => {
  let i = 0
  let j = 0
  let temp = ''
  let repl = ''
  let sl = 0
  let fl = 0
  const f = [].concat(search)
  let r = [].concat(replace)
  let s = subject
  let ra = Object.prototype.toString.call(r) === '[object Array]'
  const sa = Object.prototype.toString.call(s) === '[object Array]'
  s = [].concat(s)

  if (typeof (search) === 'object' && typeof (replace) === 'string') {
    temp = replace
    replace = []
    for (i = 0; i < search.length; i += 1) {
      replace[i] = temp
    }
    temp = ''
    r = [].concat(replace)
    ra = Object.prototype.toString.call(r) === '[object Array]'
  }

  if (typeof countObj !== 'undefined') {
    countObj.value = 0
  }

  for (i = 0, sl = s.length; i < sl; i++) {
    if (s[i] === '') {
      continue
    }

    for (j = 0, fl = f.length; j < fl; j++) {
      if (f[j] === '') {
        continue
      }

      temp = s[i] + ''
      repl = ra ? (r[j] !== undefined ? r[j] : '') : r[0]
      s[i] = (temp).split(f[j]).join(repl)

      if (typeof countObj !== 'undefined') {
        countObj.value += ((temp.split(f[j])).length - 1)
      }
    }
  }

  return sa ? s : s[0]
}

/**
 * Call the given Closure with the given value then return the value.
 *
 * @param  {unknown}  value
 * @param  {Function}  [callback]
 * @return {any}
 */
export const tap = (value, callback) => {
  if (callback === undefined) {
    return new HigherOrderTapProxy(value)
  }

  callback(value)

  return value
}

/**
 * Make a string's first character uppercase
 *
 * @param  {string}  value
 * @return {string}
 */
export const ucfirst = (value) => {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

/**
 *
 * @param {string} type
 * @param {string} [message]
 * @throws {RuntimeException}
 */
export const CustomException = (type, message = undefined) => {
  switch (type) {
    case 'abstract':
      return new Error('RuntimeException: Cannot create an instance of an abstract class.')

    case 'concrete-method':
      return new Error(`RuntimeException: Implement ${message} method on concrete class.`)

    case 'multiple-columns-selected': {
      return new Error('MultipleColumnsSelectedException')
    }
  }
}

/**
 * Helper function to get all traits used by a class, including inherited traits.
 *
 * @param {Object} obj
 * @returns {string[]}
 */
export const classUsesRecursive = (obj) => {
  const traits = []

  while (obj) {
    if (obj.constructor.traits) {
      traits.push(...obj.constructor.traits)
    }

    obj = Object.getPrototypeOf(obj)
  }

  return traits
}

export const versionCompare = (version1, version2, operator = '=') => {
  const parts1 = version1.split('.')
  const parts2 = version2.split('.')

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const a = parseInt(parts1[i] || 0, 10)
    const b = parseInt(parts2[i] || 0, 10)

    if (a === b) {
      continue
    }

    return compareNumbers(a, b, operator)
  }

  return true // Versions are equal
}

export const compareNumbers = (a, b, operator) => {
  switch (operator) {
    case '=':
      return a === b
    case '<':
      return a < b
    case '>':
      return a > b
    case '<=':
      return a <= b
    case '>=':
      return a >= b
    case '!=':
      return a !== b
    default:
      throw new Error('Invalid operator')
  }
}

export const match = (value, cases) => {
  for (const [pattern, result] of Object.entries(cases)) {
    if (pattern === value) {
      return result
    }
  }

  // Default case (optional)
  if (cases.default) {
    return cases.default
  }

  throw new Error('No matching case found')
}

// const fs = require('fs')
// const stream = require('stream')
// const net = require('net')

/**
 * Checks if a value is a resource.
 *
 * @param  {any}  value
 * @return {boolean}
 */
export const isResource = (value) => {
  if (value === null || value === undefined) {
    return false
  }

  // Check for file descriptors
  if (typeof value === 'number' && !isNaN(value) && value >= 0) {
    try {
      fstatSync(value)
      return true
    } catch (err) {
      return false
    }
  }

  // Check for streams (Readable, Writable, Duplex)
  if (value instanceof Stream.Stream) {
    return true
  }

  // Check for net.Socket (TCP/UDP connections)
  if (value instanceof net.Socket) {
    return true
  }

  // Additional checks can be added here for other types of resources

  return false
}

import { castArray } from '@devnetic/utils'
import { collect } from '../Collections/helpers.js'

export default class Str {
  /**
   * Return the remainder of a string after the first occurrence of a given value.
   *
   * @param  {string}  subject
   * @param  {string}  search
   * @return {string}
   */
  static after (subject, search) {
    return search === '' ? subject : subject.split(search, 2).reverse()[0]
  }

  /**
 * Determine if a given string contains a given substring.
 *
 * @param  {string}  haystack
 * @param  {string|string[]}  needles
 * @param  {boolean}  ignoreCase
 * @return {boolean}
 */
  static contains (haystack, needles, ignoreCase = false) {
    if (ignoreCase) {
      haystack = haystack.toLowerCase()

      needles = [...needles].map((needle) => needle.toLowerCase())
    }

    for (const needle of needles) {
      if (haystack.includes(needle)) {
        return true
      }
    }

    return false
  }

  /**
   * Determine if a given string ends with a given substring.
   *
   * @param  {string}  haystack
   * @param  {string|string[]}  needles
   * @return {boolean}
   */
  static endsWith (haystack, needles) {
    for (const needle of castArray(needles)) {
      if (needle !== '' && needle !== undefined && haystack.endsWith(needle)) {
        return true
      }
    }

    return false
  }

  /**
   * Replace the first occurrence of a given value in the string.
   *
   * @param  {string}  search
   * @param  {string}  replace
   * @param  {string}  subject
   * @return {string}
   */
  static replaceFirst (search, replace, subject) {
    search = String(search)

    if (search === '') {
      return subject
    }

    const position = subject.indexOf(search)

    if (position !== -1) {
      return subject.substring(0, position) + replace + subject.substring(position + search.length)
    }

    return subject
  }

  /**
     * Get the portion of a string before the last occurrence of a given value.
     *
     * @param  {string}  subject
     * @param  {string}  search
     * @return {string}
     */
  static beforeLast (subject, search) {
    if (search === '') {
      return subject
    }

    const pos = subject.lastIndexOf(search)

    if (pos === -1) {
      return subject
    }

    return this.substr(subject, 0, pos)
  }

  /**
 * Replace a given value in the string sequentially with an array.
 *
 * @param  {string}  search
 * @param  {string[]}  replace
 * @param  {string}  subject
 * @return {string}
 */
  static replaceArray (search, replace, subject) {
    if (Symbol.iterator in Object(replace)) {
      replace = collect(replace).all()
    }

    const segments = subject.split(search)

    let result = segments.shift()

    for (const segment of segments) {
      result += this.toStringOr(replace.shift() ?? search, search) + segment
    }

    return result
  }

  /**
     * Returns the portion of the string specified by the start and length parameters.
     *
     * @param  {string}  string
     * @param  {number}  start
     * @param  {number}  [length]
     * @param  {string}  encoding
     * @return {string}
     */
  static substr (string, start, length = undefined, encoding = 'UTF-8') {
    return string.substring(start, start + length)
  }

  /**
   * Convert the given value to a string or return the given fallback on failure.
   *
   * @private
   * @param  {any}  value
   * @param  {string}  fallback
   * @return {string}
   */
  static toStringOr (value, fallback) {
    try {
      return String(value)
    } catch (e) {
      return fallback
    }
  }
}

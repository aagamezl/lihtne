import Collection from '../Collections/Collection.js'
import { value } from '../Collections/helpers.js'

export default class Fluent {
  /**
   * All of the attributes set on the fluent instance.
   *
   * @type {Record<string, unknown>}
   */
  attributes = {}

  /**
   * Create a new fluent instance.
   *
   * @param  {Record<string, unknown>}  [attributes]
   */
  constructor (attributes = {}) {
    for (const [key, value] of Object.entries(attributes)) {
      this.attributes[key] = value
    }
  }

  /**
   * Get an attribute from the fluent instance.
   *
   * @param  {string}  key
   * @param  {any}  defaultValue
   * @return {any}
   */
  get (key, defaultValue = undefined) {
    return this.attributes[key] ?? defaultValue
  }

  /**
   * Get an attribute from the fluent instance.
   *
   * @param  {string}  key
   * @param  {any}  [defaultValue]
   * @return {any}
   */
  value (key, defaultValue = undefined) {
    if (Reflect.has(this.attributes, key)) {
      return this.attributes[key]
    }

    return value(defaultValue)
  }

  /**
   * Get the value of the given key as a new Fluent instance.
   *
   * @param {string} key
   * @param {*} [defaultValue=null]
   * @returns {this}
   */
  scope (key, defaultValue = null) {
    return new this.constructor(
      Object.assign({}, this.get(key, defaultValue))
    )
  }

  /**
   * Get the attributes from the fluent instance.
   *
   * @return {Object<string, unknown>}
   */
  getAttributes () {
    return this.attributes
  }

  /**
   * Convert the fluent instance to an array.
   *
   * @return array<TKey, TValue>
   */
  toArray () {
    return this.attributes
  }

  /**
   * Convert the fluent instance to a Collection.
   *
   * @param  {string|null}  key
   * @return {Collection}
   */
  collect (key = null) {
    return new Collection(this.get(key))
  }

  /**
   * Convert the object into something JSON serializable.
   *
   * @return {Record<string, unknown>}
   */
  jsonSerialize () {
    return this.toArray()
  }

  /**
   * Convert the fluent instance to JSON.
   *
   * @param  {any}  options
   * @return {string}
   */
  toJson (options) {
    return JSON.stringify(this.jsonSerialize(), options)
  }

  /**
   * Determine if the given offset exists.
   *
   * @param  {string}  offset
   * @return {boolean}
   */
  offsetExists (offset) {
    return this.attributes[offset] !== undefined
  }

  /**
   * Get the value for a given offset.
   *
   * @param  {string}  offset
   * @return {unknown}
   */
  offsetGet (offset) {
    return this.value(offset)
  }

  /**
   * Set the value at the given offset.
   *
   * @param  {string}  offset
   * @param  {unknown}  value
   * @return {void}
   */
  offsetSet (offset, value) {
    this.attributes[offset] = value
  }

  /**
   * Unset the value at the given offset.
   *
   * @param  {string}  offset
   * @return {void}
   */
  offsetUnset (offset) {
    delete this.attributes[offset]
  }

  /**
   * Place the column "after" another column(MySQL)
   *
   * @param {string} column
   */
  // after (column) {
  //   this.attributes.after = column
  // }

  /**
   *
   * @param {string} key
   * @returns {any}
   */
  // change (key) {
  //   return this.value(key)
  // }

  /**
   * Specify a collation for the column
   *
   * @param {string} collation
   * @returns {void}
   */
  // collation (collation) {
  //   this.offsetSet('collation', collation)
  // }

  /**
 * Get an attribute from the fluent instance.
 *
 * @param  {string}  key
 * @param  {any}  value
 * @return {void}
 */
  set (key, value) {
    return this.offsetSet(key, value)
  }

  /**
   * Set the starting value of an auto-incrementing field (MySQL / PostgreSQL)
   *
   * @param {number} value
   * @return {void}
   */
  // startingValue (value) {
  //   this.attributes.startingValue = value
  // }
}

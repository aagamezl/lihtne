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

    // const handler = {
    //   get (target, method, receiver) {
    //     if (Reflect.has(target, method)) {
    //       return target[method]
    //     }

    //     return new Proxy(() => { }, {
    //       get: handler.get,
    //       apply: (target, thisArg, parameters) => {
    //         thisArg.attributes[method] = parameters.length > 0 ? parameters[0] : true

    //         return thisArg
    //       }
    //     })
    //   },
    //   set (target, key, value) {
    //     target.offsetSet(key, value)

    //     return true
    //   },
    //   getPrototypeOf (target) {
    //     return Object.getPrototypeOf(target)
    //   }
    // }

    // return new Proxy(this, handler)
  }

  /**
   * Place the column "after" another column(MySQL)
   *
   * @param {string} column
   */
  after (column) {
    this.attributes.after = column
  }

  /**
   *
   * @param {string} key
   * @returns {any}
   */
  change (key) {
    return this.value(key)
  }

  /**
   * Specify a collation for the column
   *
   * @param {string} collation
   * @returns {void}
   */
  collation (collation) {
    this.offsetSet('collation', collation)
  }

  /**
   * Get an attribute from the fluent instance.
   *
   * @param  {string}  key
   * @param  {any}  defaultValue
   * @return {any}
   */
  get (key, defaultValue = undefined) {
    if (Reflect.has(this.attributes, key)) {
      return this.attributes[key]
    }

    return value(defaultValue)
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
}

import fs from 'fs'
import { join } from 'path'

import { getValue, isNumeric } from '@devnetic/utils'

import Arr from './../Collections/Arr.js'

export default class Repository {
  /**
   * Create a new configuration repository.
   *
   * @param  {Record<string, unknown>}  items
   */
  constructor (items = {}) {
    this.configFile = 'config.json'

    /**
     * All of the configuration items.
     *
     * @member {object}
     */
    this.items = {}

    try {
      const path = join(process.cwd(), this.configFile)

      const config = JSON.parse(fs.readFileSync(path, { encoding: 'utf8' }))

      this.items = { ...config, ...items }
    } catch (error) {
      throw new Error(`Could not load ${this.configFile}`)
    }
  }

  /**
   * Get all of the configuration items for the application.
   *
   * @return {Array}
   */
  all () {
    return this.items
  }

  /**
   * Get the specified configuration value.
   *
   * @param  {string[]|string}  key
   * @param  {unknown}  defaultValue
   * @return {unknown}
   */
  get (key, defaultValue = undefined) {
    if (Array.isArray(key)) {
      return this.getMany(key)
    }

    return getValue(this.items, key, defaultValue)
  }

  /**
   * Get many configuration values.
   *
   * @param  {string[]}  keys
   * @return {Record<string, unknown>}
   */
  getMany (keys) {
    const config = {}

    for (let [key, defaultValue] of keys) {
      if (isNumeric(key)) {
        [key, defaultValue] = [defaultValue, null]
      }

      config[key] = Arr.get(this.items, key, defaultValue)
    }

    return config
  }

  /**
   * Determine if the given configuration value exists.
   *
   * @param  {string}  key
   * @return {boolean}
   */
  has (key) {
    return Arr.has(this.items, key)
  }

  /**
   * Determine if the given configuration option exists.
   *
   * @param  {string}  key
   * @return {boolean}
   */
  offsetExists (key) {
    return this.has(key)
  }

  /**
   * Get a configuration option.
   *
   * @param  {string}  key
   * @return {*}
   */
  offsetGet (key) {
    return this.get(key)
  }

  /**
   * Set a configuration option.
   *
   * @param  {string}  key
   * @param  {*}  value
   * @return {void}
   */
  offsetSet (key, value) {
    this.set(key, value)
  }

  /**
   * Unset a configuration option.
   *
   * @param  {string}  key
   * @return {void}
   */
  offsetUnset (key) {
    this.set(key, null)
  }

  /**
   * Prepend a value onto an Array configuration value.
   *
   * @param  {string}  key
   * @param  {*}  value
   * @return {void}
   */
  prepend (key, value) {
    const array = this.get(key)

    array.unshift(value)

    this.set(key, array)
  }

  /**
   * Push a value onto an Array configuration value.
   *
   * @param  {string}  key
   * @param  {*}  value
   * @return {void}
   */
  push (key, value) {
    const array = this.get(key)

    array.push(value)

    this.set(key, array)
  }

  /**
   * Set a given configuration value.
   *
   * @param  Array|{string}  key
   * @param  {*}  value
   * @return {void}
   */
  set (key, value = null) {
    const keys = Array.isArray(key) ? key : { key: value }

    for (const [key, value] of Object.entries(keys)) {
      Arr.set(this.items, key, value)
    }
  }
}

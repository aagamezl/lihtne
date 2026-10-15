import fs from 'node:fs'
import { join } from 'path'

import { isNumeric, isPlainObject } from '@devnetic/utils'

import type { LihtneConfig } from './types'

import { Arr } from './../Collections/Arr'
import { Macroable } from '../Macroable/Traits/Macroable'
import { instanceProxy } from '../Support'

export class Repository extends Macroable {
  /**
   * All of the configuration items.
   *
   * @var array<string,mixed>
   */
  protected items: Partial<LihtneConfig> = {
    // database: {
    //   default: '',
    //   connections: {}
    // }
  }

  /**
   * The path to the configuration file.
   *
   * @var string
   */
  protected configFile: string = 'lihtne-config.json'

  /**
   * Create a new configuration repository.
   *
   * @param  {Partial<LihtneConfig>}  items
   */
  constructor(items: Partial<LihtneConfig> = {}) {
    super()

    try {
      const path = join(process.cwd(), this.configFile)

      const config = JSON.parse(fs.readFileSync(path, { encoding: 'utf8' })) as LihtneConfig

      // this.items = {
      //   ...config,
      //   ...items,
      //   database: {
      //     ...config.database,
      //     ...items.database,
      //     connections: {
      //       ...config.database.connections,
      //       ...items.database?.connections
      //     }
      //   }
      // }
      this.items = items
    } catch (error) {
      throw new Error(`Could not load ${this.configFile}`)
    }

    return instanceProxy(this)
  }

  /**
   * Get all of the configuration items for the application.
   *
   * @return {Array}
   */
  all(): Partial<LihtneConfig> {
    return this.items
  }

  /**
   * Get the specified configuration value.
   *
   * @param  {string[]|string}  key
   * @param  {unknown}  defaultValue
   * @return {unknown}
   */
  get(key: Record<string, unknown> | string | number, defaultValue?: unknown): unknown {
    if (Array.isArray(key) || typeof key === 'object') {
      return this.getMany(key)
    }

    const value = Arr.get(this.items, key, defaultValue)

    return value
  }

  /**
   * Get many configuration values.
   *
   * @param  {string[]}  keys
   * @return {Record<string, unknown>}
   */
  getMany(keys: string | number | Record<string, unknown>): Record<string, unknown> {
    const config: Record<string, unknown> = {}

    for (const [index, value] of Object.entries(keys)) {
      const key = isNumeric(index) ? value : index
      const defaultValue = isNumeric(index) ? undefined : value

      config[key] = Arr.get(this.items, key, defaultValue)
    }

    return config
  }

  /**
   * Get the specified float configuration value.
   *
   * @param  string  $key
   * @param  (\Closure():(float|null))|float|null  $default
   * @return float
   *
   * @throws \InvalidArgumentException
   */
  float(key: string, defaultValue?: unknown): number {
    const value = this.get(key, defaultValue);

    if (!Number.isFinite(value)) {
      throw new Error(`Configuration value for key [${key}] must be a float, ${typeof value} given.`);
    }

    // TODO: This is a temporary solution to convert the value to a number.
    // I need to find a better solution to handle this with a generic type.
    return Number(value)
  }

  /**
   * Determine if the given configuration value exists.
   *
   * @param  {string}  key
   * @return {boolean}
   */
  has(key: string): boolean {
    return Arr.has(this.items, key)
  }

  /**
   * Determine if the given configuration option exists.
   *
   * @param  {string}  key
   * @return {boolean}
   */
  offsetExists(key: string): boolean {
    return this.has(key)
  }

  /**
   * Get a configuration option.
   *
   * @param  {string}  key
   * @return {*}
   */
  offsetGet(key: string | number): unknown {
    return this.get(key)
  }

  /**
   * Set a configuration option.
   *
   * @param  {string}  key
   * @param  {*}  value
   * @return {void}
   */
  offsetSet(key: string | number, value: unknown): void {
    this.set(key, value)
  }

  /**
   * Unset a configuration option.
   *
   * @param  {string}  key
   * @return {void}
   */
  offsetUnset(key: string): void {
    this.set(key, undefined)
  }

  /**
   * Prepend a value onto an Array configuration value.
   *
   * @param  {string}  key
   * @param  {*}  value
   * @return {void}
   */
  prepend(key: string, value: unknown): void {
    const array = this.get(key, [])

    // if (typeof array === 'object') {
      array.unshift(value)
      // array[key] = value
    // }

    this.set(key, array)
  }

  /**
   * Push a value onto an Array configuration value.
   *
   * @param  {string}  key
   * @param  {*}  value
   * @return {void}
   */
  push(key: string, value: unknown): void {
    const array = this.get(key, [])

    if (Array.isArray(array)) {
      array.push(value)
    }

    this.set(key, array)
  }

  /**
   * Set a given configuration value.
   *
   * @param  {string[]|string}  key
   * @param  {unknown}  value
   * @return {void}
   */
  set(key: Record<string, unknown> | string | number, value?: unknown): void {
    const keys = Array.isArray(key) || isPlainObject(key) ? key : { [key]: value }

    for (const [key, value] of Object.entries(keys)) {
      Arr.set(this.items, key, value)
    }
  }
}

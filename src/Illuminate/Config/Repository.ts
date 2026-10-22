import { isNumeric } from '@devnetic/utils'

import type { LihtneConfig } from './types'

import { Collection } from '../Collections'
import { Macroable } from '../Macroable/Traits/Macroable'
import { instanceProxy } from '../Support'
import { isPlainRecord } from '../Support/helpers'
import { Arr } from './../Collections/Arr'

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
   * Create a new configuration repository.
   *
   * @param  {Partial<LihtneConfig>}  items
   */
  constructor (items: Partial<LihtneConfig> = {}) {
    super()

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

    return instanceProxy(this)
  }

  /**
   * Get all of the configuration items for the application.
   *
   * @return {Array}
   */
  all (): Partial<LihtneConfig> {
    return this.items
  }

  /**
   * Get the specified array configuration value.
   *
   * @param  string  $key
   * @param  (\Closure():(array<array-key, mixed>|null))|array<array-key, mixed>|null  $default
   * @return array<array-key, mixed>
   *
   * @throws \InvalidArgumentException
   */
  public array (key: string, defaultValue?: unknown): unknown[] {
    const value = this.get<string, unknown>(key, defaultValue)

    if (!Array.isArray(value)) {
      throw new Error(`InvalidArgumentException: Configuration value for key [${key}] must be an array, ${typeof value} given.`)
    }

    return value
  }

  /**
   * Get the specified boolean configuration value.
   *
   * @param  string  $key
   * @param  (\Closure():(bool|null))|bool|null  $default
   * @return bool
   *
   * @throws \InvalidArgumentException
   */
  public boolean (key: string, defaultValue?: unknown): boolean {
    const value = this.get<string, unknown>(key, defaultValue)

    if (typeof value !== 'boolean') {
      throw new Error(`InvalidArgumentException: Configuration value for key [${key}] must be a boolean, ${typeof value} given.`)
    }

    return value
  }

  /**
   * Get the specified array configuration value as a collection.
   *
   * @param  string  $key
   * @param  (\Closure():(array<array-key, mixed>|null))|array<array-key, mixed>|null  $default
   * @return Collection<array-key, mixed>
   */
  public collection (key: string, defaultValue?: unknown): Collection<string, unknown> {
    return new Collection(this.array(key, defaultValue))
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
  float (key: string, defaultValue?: unknown): number {
    const value = this.get(key, defaultValue)

    if (!Number.isFinite(value)) {
      throw new Error(`Configuration value for key [${key}] must be a float, ${typeof value} given.`)
    }

    // TODO: This is a temporary solution to convert the value to a number.
    // I need to find a better solution to handle this with a generic type.
    return Number(value)
  }

  /**
   * Get the specified configuration value.
   *
   * @param  {string[]|string}  key
   * @param  {unknown}  defaultValue
   * @return {unknown}
   */
  get<TKey extends string | number, TValue = unknown>(key: TKey, defaultValue?: TValue): TValue
  get<TKey extends Record<string, unknown> | readonly string[], TValue = unknown>(key: TKey, defaultValue?: TValue): Record<string, TValue>
  get (key: Record<string, unknown> | readonly string[] | string | number, defaultValue?: unknown): unknown {
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
  getMany<TValue = unknown>(keys: Record<string, unknown> | readonly string[]): Record<string, TValue>
  getMany<TValue = unknown>(keys: object): Record<string, TValue> {
    const config: Record<string, TValue> = {}

    for (const [index, value] of Object.entries(keys)) {
      const key = isNumeric(index) ? value : index
      const defaultValue = isNumeric(index) ? undefined : value

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
  has (key: string): boolean {
    return Arr.has(this.items, key)
  }

  /**
   * Get the specified integer configuration value.
   *
   * @param  string  $key
   * @param  (\Closure():(int|null))|int|null  $default
   * @return int
   *
   * @throws \InvalidArgumentException
   */
  public integer (key: string, defaultValue?: unknown): number {
    const value = this.get<string, unknown>(key, defaultValue)

    if (typeof value !== 'number') {
      throw new Error(`InvalidArgumentException:Configuration value for key [${key}] must be an integer, ${typeof value} given.`)
    }
    return value
  }

  /**
   * Determine if the given configuration option exists.
   *
   * @param  {string}  key
   * @return {boolean}
   */
  offsetExists (key: string): boolean {
    return this.has(key)
  }

  /**
   * Get a configuration option.
   *
   * @param  {string}  key
   * @return {*}
   */
  offsetGet (key: string | number): unknown {
    return this.get(key)
  }

  /**
   * Set a configuration option.
   *
   * @param  {string}  key
   * @param  {*}  value
   * @return {void}
   */
  offsetSet (key: string | number, value: unknown): void {
    this.set(key, value)
  }

  /**
   * Unset a configuration option.
   *
   * @param  {string}  key
   * @return {void}
   */
  offsetUnset (key: string): void {
    this.set(key, undefined)
  }

  /**
   * Prepend a value onto an Array configuration value.
   *
   * @param  {string}  key
   * @param  {*}  value
   * @return {void}
   */
  prepend (key: string, value: unknown): void {
    const array = this.get<string, unknown[]>(key, [])

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
  push (key: string, value: unknown): void {
    const array = this.get<string, unknown[]>(key, [])

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
  set (key: Record<string, unknown> | string | number, value?: unknown): void {
    const keys = Array.isArray(key) || isPlainRecord(key) ? key : { [key]: value }

    for (const [key, value] of Object.entries(keys)) {
      Arr.set(this.items, key, value)
    }
  }

  /**
   * Get the specified string configuration value.
   *
   * @param  string  $key
   * @param  (\Closure():(string|null))|string|null  $default
   * @return string
   *
   * @throws \InvalidArgumentException
   */
  public string (key: string, defaultValue?: unknown): string {
    const value = this.get<string, unknown>(key, defaultValue)

    if (typeof value !== 'string') {
      throw new Error(`InvalidArgumentException: Configuration value for key [${key}] must be a string, ${typeof value} given.`)
    }
    return value
  }
}

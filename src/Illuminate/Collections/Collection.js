import { getType, isFunction, isPlainObject, isString, range } from '@devnetic/utils'

import use from '../Support/Traits/use.js'
import Arr from './Arr.js'
import { EnumeratesValues } from './Traits/EnumeratesValues.js'
import Macroable from '../Macroable/Traits/Macroable.js'
import { dataGet } from './helpers.js'
import { arrayDiff, mergeArrays, spaceship } from '../Support/index.js'

export default class Collection {
  /**
   * Create a new collection.
   *
   * @param  {\Illuminate\Contracts\Support\Arrayable<TKey, TValue>|iterable<TKey, TValue>|null}  items
   * @return {void}
   */
  constructor (items = []) {
    use(this.constructor, [EnumeratesValues, Macroable])

    // We don't want to enumerate this property with Object.entries() or similar
    Object.defineProperty(this, 'entries', {
      enumerable: false,
      value: false,
      writable: true
    })

    /**
   * The items contained in the collection.
   *
   * @type {unknown[]}
   */
    this.items = this.getArrayableItems(items)
  }

  /**
   * Get all of the items in the collection.
   *
   * @return {unknown[]}
   */
  all () {
    return this.entries === true ? Object.fromEntries(this.items) : this.items
  }

  /**
     * Collapse the collection of items into a single array.
     *
     * @return {Collection}
     */
  collapse () {
    return new Collection(Arr.collapse(this.items))
  }

  /**
    * Determine if an item exists in the collection.
    *
    * @param  {*}  key
    * @param  {*}  operator
    * @param  {*}  value
    * @return {boolean}
    */
  contains (key/* , operator, value */) {
    if (arguments.length === 1) {
      if (this.useAsCallable(key)) {
        const placeholder = {}
        return this.first(key, placeholder) !== placeholder
      }

      return this.items.includes(key)
    }

    return this.contains(this.operatorForWhere.apply(null, arguments))
  }

  /**
   * Count the number of items in the collection.
   *
   * @return {number}
   */
  count () {
    if (this.items instanceof Map) {
      return this.items.size
    }

    return Object.keys(this.items).length
  }

  /**
     * Get the items in the collection that are not present in the given items.
     *
     * @param  {Object.<string, unknown>}  items
     * @return {Collection}
     */
  diff (items) {
    // return new Collection(objectDiffKey(this.items, this.getArrayableItems(items)))
    return new Collection(arrayDiff(this.items, this.getArrayableItems(items)))
  }

  /**
   * Run a filter over each of the items.
   *
   * @param  {(callable(TValue, TKey) => boolean)}  [callback]
   * @return {static}
   */
  filter (callback) {
    if (callback) {
      return new Collection(Arr.where(this.items, callback))
    }

    return new Collection(this.items.filter(value => value))
  }

  /**
   * Get the first item from the collection passing the given truth test.
   *
   * @param  {Function}  [callback]
   * @param  {unknown}  [defaultValue]
   * @return {unknown}
   */
  first (callback, defaultValue) {
    return Arr.first(this.items, callback, defaultValue)
  }

  /**
   * Concatenate values of a given key as a string.
   *
   * @param  {string}  value
   * @param  {string}  [glue]
   * @return {string}
   */
  implode (value, glue) {
    const first = this.first()

    if (Array.isArray(first) || (isPlainObject(first) && typeof first !== 'string')) {
      return this.pluck(value).all().join(glue ?? '')
    }

    return this.items.join(value ?? '')
  }

  /**
   * Determine if the collection is empty or not.
   *
   * @return {boolean}
   */
  isEmpty () {
    return getType(this.items) === 'Map' ? this.items?.size === 0 : this.items?.length === 0
  }

  /**
   * Join all items from the collection using a string. The final items can use a separate glue string.
   *
   * @param  {string}  glue
   * @param  {string}  finalGlue
   * @return {string}
   */
  join (glue, finalGlue = '') {
    if (finalGlue === '') {
      return this.implode(glue)
    }

    const count = this.count()

    if (count === 0) {
      return ''
    }

    if (count === 1) {
      return this.last()
    }

    const collection = new Collection(this.items)

    const finalItem = collection.pop()

    return collection.implode(glue) + finalGlue + finalItem
  }

  /**
   * Get the last item from the collection.
   *
   * @param  {Function|undefined}  [callback]
   * @param  {unknown}  [defaultValue]
   * @return {unknown}
   */
  last (callback, defaultValue) {
    return Arr.last(this.items, callback, defaultValue)
  }

  /**
   * Create a new collection instance if the value isn't one already.
   *
   * @param  {*}  items
   * @return {static}
   */
  static make (items = []) {
    return new this(items)
  }

  /**
   * Run a map over each of the items.
   *
   * @param  {Function}  callback
   * @return {Collection}
   */
  map (callback) {
    return new Collection(this.items.map((item, key) => {
      if (isFunction(callback)) {
        [key, item] = Array.isArray(item) && item.length > 1 ? item : [key, item]

        return callback(item, key)
      }

      return item
    }))
  }

  /**
   * Merge the collection with the given items.
   *
   * @param  {*}  items
   * @return {Collection}
   */
  merge (items) {
    return new this.constructor(mergeArrays(this.items, this.getArrayableItems(items)))
  }

  /**
    * Get an operator checker callback.
    *
    * @param  {string}  key
    * @param  {string|null}  operator
    * @param  {*}  value
    * @return {Function}
    */
  operatorForWhere (key, operator, value) {
    if (arguments.length === 1) {
      value = true
      operator = '='
    }
    if (arguments.length === 2) {
      value = operator
      operator = '='
    }
    return (item) => {
      const retrieved = dataGet(item, key)
      const strings = [retrieved, value].filter((value) => {
        return isString(value) || (isPlainObject(value) && Reflect.has(value, 'toString'))
      })
      if (strings.length < 2 && [retrieved, value].filter(isPlainObject).length === 1) {
        return ['!=', '<>', '!=='].includes(operator)
      }
      switch (operator) {
        case '=':
        case '==': return retrieved == value; // eslint-disable-line
        case '!=':
        case '<>': return retrieved != value; // eslint-disable-line
        case '<': return retrieved < value
        case '>': return retrieved > value
        case '<=': return retrieved <= value
        case '>=': return retrieved >= value
        case '===': return retrieved === value
        case '!==': return retrieved !== value
        default: return '=='
      }
    }
  }

  /**
   * Get the values of a given key.
   *
   * @param  {string|Array|number}  value
   * @param  {string|undefined}  key
   * @return {Collection}
   */
  pluck (value, key) {
    return new Collection(Arr.pluck(this.items, value, key))
  }

  /**
   * Get and remove the last N items from the collection.
   *
   * @param  {number}  count
   * @return {static<int, TValue>|TValue|undefined}
   */
  pop (count = 1) {
    if (count === 1) {
      return this.items.pop()
    }
    if (this.isEmpty()) {
      return new Collection()
    }
    const collectionCount = this.count()
    // for (const item of range(1, Math.min(count, collectionCount))) {
    //   results.push(this.items.pop())
    // }
    return new Collection(range(1, Math.min(count, collectionCount)).reduce((results) => {
      results.push(this.items.pop())
      return results
    }, []))
  }

  /**
   * Sort the collection using the given callback.
   *
   * @param  {Function|Array|string}  callback
   * @param  {boolean}  descending
   * @return {this}
   */
  sortBy (callback, descending = false) {
    if (Array.isArray(callback) && !isFunction(callback)) {
      return this.sortByMany(callback)
    }
    let results = new Map()
    callback = this.valueRetriever(callback)
    // First we will loop through the items and get the comparator from a callback
    // function which we were given. Then, we will sort the returned values and
    // and grab the corresponding values for the sorted keys from this array.
    for (const [key, value] of this.items) {
      results.set(key, callback(value, key))
    }
    results = descending
      ? new Map([...results.entries()].sort((a, b) => a[1] - b[1]))
      : new Map([...results.entries()].sort((a, b) => b[1] - a[1]))
    // Once we have sorted all of the keys in the array, we will loop through them
    // and grab the corresponding model so we can set the underlying items list
    // to the sorted version. Then we'll just return the collection instance.
    for (const [key] of results) {
      results.set(key, this.items instanceof Map ? this.items.get(key) : this.items[key])
    }
    return new Collection(results)
  }

  /**
   * Sort the collection using multiple comparisons.
   *
   * @param  {any[]}  comparisons
   * @return {Collection}
   */
  sortByMany (comparisons = []) {
    const items = this.items
    items.sort((a, b) => {
      let result
      for (let comparison of comparisons) {
        comparison = Arr.wrap(comparison)
        const prop = comparison[0]
        const ascending = Arr.get(comparison, 1, true) === true ||
          Arr.get(comparison, 1, true) === 'asc'
        let values
        if (!isString(prop) && isFunction(prop)) {
          result = prop(a, b)
        } else {
          values = [dataGet(a, prop), dataGet(b, prop)]
          if (!ascending) {
            values = values.reverse()
          }
          result = spaceship(values[0], values[1])
        }
        if (result === 0) {
          continue
        }
      }
      return result
    })
    return new Collection(items)
  }

  /**
   * Reset the keys on the underlying array.
   *
   * @return {Collection}
   */
  values () {
    return new Collection(Object.values(this.items))
  }
}

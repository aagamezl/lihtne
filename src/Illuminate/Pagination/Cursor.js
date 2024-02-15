import { collect } from '../Collections/helpers.js'
import { strReplace } from '../Support/helpers.js'

export default class Cursor {
  /**
   * The parameters associated with the cursor.
   * @protected
   * @type {Record<string, unknown>}
   */
  parametersProperty

  /**
   * Determine whether the cursor points to the next or previous set of items.
   * @protected
   * @type {boolean}
   */
  pointsToNextItemsProperty

  /**
   * Create a new cursor instance.
   *
   * @param {Record<string, unknown>} parameters
   * @param {boolean} [pointsToNextItems=true]
   */
  constructor (parameters, pointsToNextItems = true) {
    this.parametersProperty = parameters
    this.pointsToNextItemsProperty = pointsToNextItems
  }

  /**
   * Get the given parameter from the cursor.
   *
   * @param {string} parameterName
   * @returns {string|undefined}
   * @throws {Error}
   */
  parameter (parameterName) {
    if (this.parametersProperty[parameterName] === undefined) {
      throw new Error(`UnexpectedValueException: Unable to find parameter [${parameterName}] in pagination item.`)
    }

    return this.parametersProperty[parameterName]
  }

  /**
   * Get the given parameters from the cursor.
   *
   * @param {Record<string, unknown>} parameterNames
   * @returns {Record<string, unknown>}
   */
  parameters (parameterNames) {
    return collect(parameterNames).map((parameterName) => {
      return this.parameter(parameterName)
    }).toArray()
  }

  /**
   * Determine whether the cursor points to the next set of items.
   *
   * @returns {boolean}
   */
  pointsToNextItems () {
    return this.pointsToNextItemsProperty
  }

  /**
   * Determine whether the cursor points to the previous set of items.
   *
   * @returns {boolean}
   */
  pointsToPreviousItems () {
    return !this.pointsToNextItemsProperty
  }

  /**
   * Get the object representation of the cursor.
   *
   * @returns {Record<string, unknown>}
   */
  toArray () {
    return {
      ...this.parametersProperty,
      _pointsToNextItems: this.pointsToNextItemsProperty
    }
  }

  /**
   * Get the encoded string representation of the cursor to construct a URL.
   *
   * @returns {string}
   */
  encode () {
    const encodedString = Buffer.from(JSON.stringify(this.toArray())).toString('base64')
    return strReplace(['+', '/', '='], ['-', '_', ''], encodedString)
  }

  /**
   * Get a cursor instance from the encoded string representation.
   *
   * @param {string} [encodedString]
   * @returns {Cursor|undefined}
   */
  static fromEncoded (encodedString) {
    if (typeof encodedString !== 'string') {
      return undefined
    }

    try {
      const decodedString = Buffer.from(encodedString.replace(/[-_]/g, match => ({ '-': '+', _: '/' }[match])), 'base64').toString('utf-8')

      const { _pointsToNextItems, ...parameters } = JSON.parse(decodedString)

      return new Cursor(parameters, _pointsToNextItems)
    } catch (error) {
      return undefined
    }
  }
}

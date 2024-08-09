/** @typedef {import('../Statements/Statement.js').default} Statement */

import { CustomException } from '../../Support/helpers.js'

export default class Driver {
  /** @type {string} */
  dsn

  /** @type {Record<string, unknown>} */
  options = {}

  /** @type {number} */
  static ATTR_SERVER_VERSION = 4

  static FETCH_OBJ = 5

  /**
 * Creates an instance of Statement.
 * @param {string} dsn
 * @param {Record<string, unknown>} options
 * @memberof Driver
 */
  constructor (dsn, options) {
    this.dsn = dsn
    this.options = options
  }

  /**
   *
   * @param {number} attribute
   * @returns {any}
   */
  getAttribute (attribute) {
    throw CustomException('concrete-method', 'getAttribute')
  }

  /**
   * Prepares a statement for execution and returns a statement object
   * @param {string} query
   * @returns {Statement}
   * @throws {Error}
   */
  prepare (query) {
    throw CustomException('concrete-method', 'prepare')
  }
}

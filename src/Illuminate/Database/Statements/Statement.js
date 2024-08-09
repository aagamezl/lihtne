import { CustomException } from './../../Support/index.js'

/**
 * @typedef {Object} PreparedStatement
 * @property {string} name
 * @property {string} text
 * @property {import('../Drivers/Driver.js').FetchMode} rowMode
 */

/**
 * @class
 * @abstract
 * @description Implementation of the PHP PDOStatement class
 */
export default class Statement {
  /** @type {} */
  bindings = {}

  /** @type {string} */
  dsn = ''

  /** @type {import('../Drivers/Driver.js').FetchMode} */
  fetchMode = 'object'

  /** @type {Record<string, unknown>} */
  options = {}

  /** @type {string|undefined} */
  query = undefined

  /**
   * @protected
   * @type {any}
   */
  result = {}

  /** @type {number} */
  rowCountProperty = 0

  /**
   * @protected
   * @type {PreparedStatement|undefined}
   */
  statement = undefined

  /**
   * Creates an instance of Statement.
   * @param {string} dsn
   * @param {Record<string, unknown>} options
   * @param {string} query
   * @memberof Statement
   */
  constructor (dsn, options, query) {
    if (new.target === Statement) {
      throw CustomException('abstract')
    }

    this.dsn = dsn
    this.options = options
    this.query = query
  }

  /**
   *
   * @param {string|number} param
   * @param {*} value
   * @return {boolean}
   */
  bindValue (param, value) {
    try {
      this.bindings[param] = value

      return true
    } catch (error) {
      return false
    }
  }

  /**
   *
   * @param {Record<string, unknown>} [params]
   * @returns {Promise<any[]>}
   */
  execute (params) {
    throw CustomException('concrete-method', 'execute')
  }

  /**
   * Returns an array containing all of the remaining rows in the result set
   *
   * @returns {unknown[]}
   */
  fetchAll () {
    throw CustomException('concrete-method', 'fetchAll')
  }

  parameterize () {
    throw CustomException('concrete-method', 'parameterize')
  }

  /**
   * Prepares a statement for execution and returns a statement object
   *
   * @param {string} query
   * @returns {Statement}
   */
  prepare (query) {
    throw CustomException('concrete-method', 'prepare')
  }

  rowCount () {
    throw CustomException('concrete-method', 'rowCount')
  }
}

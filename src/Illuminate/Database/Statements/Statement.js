import { throwException } from './../../Support/index.js'

/**
 * @description Implementation of the PHP PDOStatement class
 */
export default class Statement {
  /**
   * Creates an instance of Statement.
   * @param {string} dsn
   * @param {Record<string, unknown>} options
   * @memberof Statement
   */
  constructor (dsn, options) {
    if (new.target === Statement) {
      throwException('abstract')
    }

    this.bindings = {}
    this.dsn = dsn
    this.fetchMode = undefined
    this.options = options

    this.result = undefined
    this.rowCountProperty = 0
    this.statement = undefined
  }

  /**
   *
   * @param {string|number} param
   * @param {*} value
   * @return boolean
   */
  bindValue (param, value) {
    try {
      this.bindings[param] = value

      return true
    } catch (error) {
      return false
    }
  }

  parameterize () {
    throwException('concrete-method', 'parameterize')
  }

  rowCount () {
    throwException('concrete-method', 'rowCount')
  }
}

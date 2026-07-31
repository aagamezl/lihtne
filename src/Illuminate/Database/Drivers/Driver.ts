import { CustomException } from '../../Support/helpers'
import { Statement } from '../Statements'

export default class Driver {
  /** @type {string} */
  dsn

  /** @type {Record<string, unknown>} */
  options = {}

  /**
   * Creates an instance of Statement.
   * @param {string} dsn
   * @param {Record<string, unknown>} options
   * @memberof Driver
   */
  constructor(dsn: string, options: Record<string, unknown>) {
    this.dsn = dsn
    this.options = options
  }

  /**
   * Prepares a statement for execution and returns a statement object
   * @param {string} query
   * @returns {Statement}
   * @throws {Error}
   */
  prepare(query: string): Statement {
    throw CustomException('concrete-method', 'prepare')
  }
}

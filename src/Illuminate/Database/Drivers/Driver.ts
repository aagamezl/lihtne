import { CustomException } from '../../Support/helpers'
import { Statement } from '../Statements'

export abstract class Driver {
  /** @type {string} */
  protected dsn: string

  /** @type {Record<string, unknown>} */
  protected options: Record<string, unknown> = {}

  static readonly ATTR_SERVER_VERSION?: number

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
   *
   * @param {number} attribute
   * @returns {any}
   */
  getAttribute(attribute: string) { }

  /**
   * Prepares a statement for execution and returns a statement object
   * @param {string} query
   * @returns {Statement}
   * @throws {Error}
   */
  prepare(query: string): Statement { }
}

/** @typedef {import('../Statements/Statement.js').default} Statement */

import { CustomException } from '../../Support/helpers.js'

export default class Driver {
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

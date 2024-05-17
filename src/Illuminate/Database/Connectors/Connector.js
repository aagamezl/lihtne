// import Statement from '../Statements/Statement.js'
import { objectDiffKey, CustomException } from './../../Support/index.js'

/** @typedef {import('../Drivers/Driver.js').default} Driver */

export default class Connector {
  /**
   * @protected
   * @type {Record<string, string>}
   */
  options = {}

  constructor () {
    if (new.target === Connector) {
      CustomException('abstract')
    }
  }

  /**
   * Establish a database connection.
   *
   * @param  {Record<string, any>}  config
   * @returns {Driver}
   */
  connect (config) {
    throw CustomException('concrete-method', 'prepare')
  }

  /**
   * Create a new PDO connection.
   *
   * @param  {string}  dsn
   * @param  {Record<string, any>}  config
   * @param  {Record<string, unknown>}  options
   * @return {Driver}
   *
   * @throws {Error}
   */
  createConnection (dsn, config, options) {
    try {
      return this.createDriverConnection(dsn, options)
    } catch (error) {
      return this.tryAgainIfCausedByLostConnection(
        error, dsn, options
      )
    }
  }

  /**
   * Create a new PDO connection instance.
   *
   * @protected
   * @param  {string}  dsn
   * @param  {Record<string, unknown>}  options
   * @returns {import('../Drivers/Driver.js').default}
   * @throws {Error}
   */
  createDriverConnection (dsn, options) {
    // return new Statement(dsn, options)
    throw CustomException('concrete-method', 'createDriverConnection')
  }

  /**
   * Get the PDO options based on the configuration.
   *
   * @param  {Record<string, any>}  config
   * @return {Record<string, any>}
   */
  getOptions (config) {
    const options = config.options ?? {}

    return { ...objectDiffKey(this.options, options), ...options }
  }

  /**
  * Handle an exception that occurred during connect execution.
  *
  * @param  {Error}  e
  * @param  {string}  dsn
  * @param  {Record<string, unknown>}  options
  * @return {Statement}
  *
  * @throws \Exception
  */
  tryAgainIfCausedByLostConnection (e, dsn, options) {
    if (this.causedByLostConnection(e)) {
      return this.createNdoConnection(dsn, options)
    }

    throw e
  }
}

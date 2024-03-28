import Statement from '../Statements/Statement.js'
import { objectDiffKey } from './../../Support/index.js'

export default class Connector {
  constructor () {
    this.options = {}
  }

  /**
   * Create a new PDO connection.
   *
   * @param  {string}  dsn
   * @param  {object}  config
   * @param  {Array}  options
   * @return \PDO
   *
   * @throws \Exception
   */
  createConnection (dsn, config, options) {
    try {
      return this.createNdoConnection(
        dsn, options
      )
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
   * @param  {string}  username
   * @param  {string}  password
   * @param  {array}  options
   * @return {Statement}
   */
  createNdoConnection (dsn, options) {
    return new Statement(dsn, options)
  }

  /**
   * Get the PDO options based on the configuration.
   *
   * @param  {object}  config
   * @return {array}
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

import { CustomException } from '../../Support/helpers.js'

/**
 * @abstract
 */
export default class ConnectionEvent {
  /**
   * The name of the connection.
   * @type {string}
   */
  connectionName

  /**
   * The database connection instance.
   * @type {import('./../Connection.js').default}
   */
  connection

  /**
   * Create a new event instance.
   *
   * @param {import('./../Connection.js').default} connection
   */
  constructor (connection) {
    if (new.target === ConnectionEvent) {
      throw CustomException('abstract')
    }

    this.connection = connection
    this.connectionName = connection.getName()
  }
}

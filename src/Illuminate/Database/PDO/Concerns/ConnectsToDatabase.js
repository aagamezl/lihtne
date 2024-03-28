import { isNil, isObject } from '@devnetic/utils'

import Connection from './../Connection.js'

export default class ConnectsToDatabase {
  /**
   * Create a new database connection.
   *
   * @param  {object}  params
   * @param  {string|undefined}  [username]
   * @param  {string|undefined}  [password]
   * @param  {object}  [driverOptions]
   * @return {import('../Connection.js').default}
   *
   * @throws {\InvalidArgumentException}
   */
  connect (params, username = undefined, password = undefined, driverOptions = {}) {
    if (isNil(params.pdo) || !isObject(params.pdo)) {
      throw new Error('InvalidArgumentException: Lihtne requires the "pdo" property to be set and be a Connection Object instance.')
    }

    return new Connection(params.pdo)
  }
}

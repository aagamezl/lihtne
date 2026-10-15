import { jest } from '@jest/globals'

import { Connection, type Driver } from '../../../src/Illuminate/Database'

export const config = {
  driver: 'mysql',
  host: '127.0.0.1',
  database: 'test',
  username: 'root',
  password: 'root'
}

/**
 * Returns a Connection instance
 *
 * @return {Connection}
 */
export const getConnection = (prefix: string = '') => {
  const connection = new Connection({} as Driver, '', '', {})

  jest.spyOn(connection, 'getDatabaseName').mockReturnValue('database')
  jest.spyOn(connection, 'getTablePrefix').mockReturnValue(prefix)

  return connection
}

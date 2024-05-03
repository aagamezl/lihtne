import Connection from '../../../src/Illuminate/Database/Connection.js'

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
export const getConnection = () => new Connection(() => { })

export default getConnection

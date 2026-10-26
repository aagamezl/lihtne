// Reads MySQL VERSION() through a driver built with a URL, without DB().
import { MySqlDriver } from '../../../src/Illuminate/Database/Drivers/MySqlDriver'
import { MySqlConnection } from '../../../src/Illuminate/Database/MySqlConnection'

const connection = new MySqlConnection(
  new MySqlDriver('mysql://lihtne:lihtne@127.0.0.1:3306/lihtne', {}),
  'lihtne',
  '',
  { driver: 'mysql' }
)

const version = await connection.getServerVersion()

console.log(version)

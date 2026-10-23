// Loads lihtne.config.ts through DB() and selects users, first by first_name
// and then the whole table. The commented block builds the driver by hand.
// import { MySqlDriver } from '../../../src/Illuminate/Database/Drivers/MySqlDriver'
// import { MySqlConnection } from '../../../src/Illuminate/Database/MySqlConnection'

// const connection = new MySqlConnection(
//   new MySqlDriver('mysql://lihtne:lihtne@127.0.0.1:3306/lihtne', {}),
//   'lihtne',
//   '',
//   { driver: 'mysql' }
// )

// ;(async () => {
//   try {
//     let users = await connection.query().from('users').where('first_name', 'John').get()
//     console.log(JSON.stringify(users.all(), null, 2))

//     users = await connection.query().from('users').get()

//     console.log(JSON.stringify(users.all(), null, 2))
//   } catch (error) {
//     console.error(error)
//   }
// })()

import { DB } from '../../../src/Illuminate/Support/Facades/DB'

(async () => {
  try {
    const db = await DB('mysql')

    console.log('SQL: %s', db.query().from('users').where('firstname', 'John').toSql())
    console.log('Bindings: %o', db.query().from('users').where('firstname', 'John').getBindings())

    let users = await db.query().from('users').where('first_name', 'John').get()
    console.log(JSON.stringify(users.all(), null, 2))

    users = await db.query().from('users').get()

    console.log(JSON.stringify(users.all(), null, 2))

    await db.disconnect()
  } catch (error) {
    console.error(error)

    process.exitCode = 1
  }
})()

import { DB } from '../../../src/Illuminate/Support/Facades/DB'

(async () => {
  try {
    const db = await DB('mariadb')

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

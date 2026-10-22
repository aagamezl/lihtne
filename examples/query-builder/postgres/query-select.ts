// Loads lihtne.config.ts through DB() and selects users, first by first_name
// and then the whole table.
import { DB } from '../../../src/Illuminate/Support/Facades/DB'

(async () => {
  try {
    // console.log('SQL: %s', DB().query().from('users').where('firstname', 'John').toSql())
    // console.log('Bindings: %o', DB().query().from('users').where('firstname', 'John').getBindings())

    const db = await DB()
    let users = await db.query().from('users').where('first_name', 'John').get()
    console.log(JSON.stringify(users.all(), null, 2))

    users = await db.query().from('users').get()

    console.log(JSON.stringify(users.all(), null, 2))
  } catch (error) {
    console.error(error)
    process.exitCode = 1
  } finally {
    process.exit()
  }
})()

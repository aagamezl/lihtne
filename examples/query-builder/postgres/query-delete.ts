// Inserts robert.doe and deletes that row by the id insertGetId returned.
import { DB } from '../../../src/Illuminate/Support/Facades/DB'

(async () => {
  try {
    const db = await DB()
    const userId = await db.query().from('users').insertGetId({
      first_name: 'Robert',
      last_name: 'Doe',
      username: 'robert.doe',
      password_hash: '12345678',
      email: 'robert.doe@email.com'
    })

    console.log(`User id: ${userId}`)

    const result = await db.query().from('users').delete(userId)

    console.log('result.rowCount: %o', result)
  } catch (error) {
    console.error(error)
  }
})()

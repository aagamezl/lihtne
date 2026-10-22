// Finds the user with email astrid.larsen@example.com and sets first_name to Louise.
import { DB } from '../../../src/Illuminate/Support/Facades/DB'

(async () => {
  try {
    const db = await DB()
    const users = await db
      .query()
      .from('users')
      .where('email', 'astrid.larsen@example.com')
      .get()

    const userId = users.first()?.id

    if (typeof userId !== 'string' && typeof userId !== 'number') {
      console.error('User not found')

      return
    }

    console.log(`User id: ${userId}`)

    const result = await db.query().from('users')
      .where('id', '=', userId)
      .update({ first_name: 'Louise' })

    console.log('result.rowCount: %o', result)
  } catch (error) {
    console.error(error)
  }
})()

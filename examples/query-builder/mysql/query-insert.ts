// Inserts one users row through DB() and prints the id from insertGetId.
// On this table the primary key is uuid(), so the protocol insert id stays 0.
import { DB } from '../../../src/Illuminate/Support/Facades/DB'
;(async () => {
  try {
    const db = await DB()

    const userId = await db.query().from('users').insertGetId(
      {
        first_name: 'John',
        last_name: 'Doe',
        username: 'john.doe',
        password_hash: '12345678',
        email: 'john.doe@email.com'
      }
    )

    console.log('userId: %o', userId)

    // let result = await db.query().from('users').insert(
    //   {
    //     first_name: 'Michael',
    //     last_name: 'Doe',
    //     username: 'michael.doe',
    //     password_hash: '12345678',
    //     email: 'michael.doe@email.com'
    //   }
    // )

    // console.log('result: %o', result)

    // result = await db.query().from('users').insert([
    //   {
    //     first_name: 'Helena',
    //     last_name: 'Doe',
    //     username: 'helena.doe',
    //     password_hash: '12345678',
    //     email: 'helena.doe@email.com'
    //   },
    //   {
    //     first_name: 'Mike',
    //     last_name: 'Doe',
    //     username: 'mike.doe',
    //     password_hash: '12345678',
    //     email: 'mike.doe@email.com'
    //   }
    // ])

    // console.log('result: %o', result)

    // const users = await db.query().from('users').get()

    // console.log(JSON.stringify(users.all(), null, 2))
  } catch (error) {
    console.error(error)
  }
})()

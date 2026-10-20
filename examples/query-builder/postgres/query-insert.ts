import { DB } from '../../../src/Illuminate/Support/Facades/DB'

(async () => {
  try {
    const db = await DB()
    let result = await db.query().from('users').insert(
      {
        first_name: 'Michael',
        last_name: 'Doe',
        username: 'michael.doe',
        password_hash: '12345678',
        email: 'michael.doe@email.com'
      }
    )

    console.log('result: %o', result)

    result = await db.query().from('users').insert([
      {
        first_name: 'Helena',
        last_name: 'Doe',
        username: 'helena.doe',
        password_hash: '12345678',
        email: 'helena.doe@email.com'
      },
      {
        first_name: 'Mike',
        last_name: 'Doe',
        username: 'mike.doe',
        password_hash: '12345678',
        email: 'mike.doe@email.com'
      }
    ])

    console.log('result: %o', result)

    const users = await db.query().from('users').get()

    console.log(JSON.stringify(users.all(), null, 2))
  } catch (error) {
    console.error(error)
  }
})()

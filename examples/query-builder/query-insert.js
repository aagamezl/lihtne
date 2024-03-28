import DB from '../../src/Illuminate/Support/Facades/DB.js'

const main = async () => {
  try {
    let result = await DB().query().from('users').insert(
      {
        firstname: 'Michael',
        lastname: 'Doe',
        email: 'michael.doe@email.com',
        password: '12345678',
        age: 38
      }
    )

    console.log('result.rowCount: %o', result.rowCount)

    result = await DB().query().from('users').insert([
      {
        firstname: 'Helena',
        lastname: 'Doe',
        email: 'helena.doe@email.com',
        password: '12345678',
        age: 32
      },
      {
        firstname: 'Mike',
        lastname: 'Doe',
        email: 'mike.doe@email.com',
        password: '12345678',
        age: 45
      }
    ])

    console.log('result.rowCount: %o', result.rowCount)

    const users = await DB().query().from('users').get()

    console.log(JSON.stringify(users.all(), null, 2))
  } catch (error) {
    console.error(error)
  }
}

main()

import DB from '../../src/Illuminate/Support/Facades/DB.js'

(async () => {
  try {
    const userId = await DB().query().from('users').insertGetId({
      firstname: 'Robert',
      lastname: 'Doe',
      email: 'robert.doe@email.com',
      password: '12345678',
      age: 38
    })

    console.log(`User id: ${userId}`)

    const result = await DB().query().from('users').delete(userId)

    console.log('result.rowCount: %o', result)
  } catch (error) {
    console.error(error)
  }
})()

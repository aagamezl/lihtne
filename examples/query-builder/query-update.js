import DB from '../../src/Illuminate/Support/Facades/DB.js'

const main = async () => {
  try {
    const users = await DB().query().from('users').where('email', 'jane.doe@email.com').get()
    const userId = users.all()[0].id

    console.log(`User id: ${userId}`)

    const result = await DB().query().from('users')
      .where('id', '=', userId)
      .update({ firstname: 'Louise' })

    console.log('result.rowCount: %o', result)
  } catch (error) {
    console.error(error)
  }
}

main()

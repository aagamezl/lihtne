import DB from '../../src/Illuminate/Support/Facades/DB.js'

(async () => {
  try {
    console.log('SQL: %s', DB().query().from('users').where('firstname', 'John').toSql())
    console.log('Bindings: %o', DB().query().from('users').where('firstname', 'John').getBindings())

    let users = await DB().query().from('users').where('firstname', 'John').get()
    console.log(JSON.stringify(users.all(), null, 2))

    users = await DB().query().from('users').get()

    console.log(JSON.stringify(users.all(), null, 2))
  } catch (error) {
    console.error(error)
  }
})()

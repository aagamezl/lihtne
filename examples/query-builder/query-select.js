import DB from '../../src/Illuminate/Support/Facades/DB.js'

const main = async () => {
  try {
    // let users = await DB.query().from('users').where('name', 'John Doe').get()
    console.log(DB().query().from('users').where('firstname', 'John').toSql())
    let users = await DB().query().from('users').where('firstname', 'John').get()
    console.log(JSON.stringify(users.all(), null, 2))

    users = await DB().query().from('users').get()

    console.log(JSON.stringify(users.all(), null, 2))
  } catch (error) {
    console.error(error)
  }
}

main()

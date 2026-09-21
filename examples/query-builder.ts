import { Connection, Driver } from '../src/Illuminate/Database'
import { Processor } from '../src/Illuminate/Database/Query'
import { Builder } from '../src/Illuminate/Database/Query/Builder'
import { Grammar } from '../src/Illuminate/Database/Query/Grammars/Grammar'

const driver = new Driver('', {})
const connection = new Connection(driver)
const grammar = new Grammar(connection)
const processor = new Processor()

const builder = new Builder(
  connection,
  grammar,
  processor
)

const run = async () => {
  const results = await builder.select('id', 'name').from('users').get()

  console.log(results)
}

run().catch((error) => {
  console.error(error)
})

import Builder from '../../../src/Illuminate/Database/Query/Builder.js'
import PostgresGrammar from '../../../src/Illuminate/Database/Query/Grammars/PostgresGrammar.js'
import Processor from '../../../src/Illuminate/Database/Query/Processors/Processor.js'
import getConnection from './getConnection.js'

const getPostgresBuilder = () => {
  const grammar = new PostgresGrammar()
  const processor = new Processor()

  return new Builder(getConnection(), grammar, processor)
}

export default getPostgresBuilder

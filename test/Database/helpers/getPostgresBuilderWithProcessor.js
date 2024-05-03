import Builder from '../../../src/Illuminate/Database/Query/Builder.js'
import PostgresGrammar from '../../../src/Illuminate/Database/Query/Grammars/PostgresGrammar.js'
import PostgresProcessor from '../../../src/Illuminate/Database/Query/Processors/PostgresProcessor.js'

import getConnection from './getConnection.js'

const getPostgresBuilderWithProcessor = () => {
  const grammar = new PostgresGrammar()
  const processor = new PostgresProcessor()

  return new Builder(getConnection(), grammar, processor)
}

export default getPostgresBuilderWithProcessor

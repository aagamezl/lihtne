import Builder from '../../../src/Illuminate/Database/Query/Builder.js'
import MySqlGrammar from '../../../src/Illuminate/Database/Query/Grammars/MySqlGrammar.js'
import MySqlProcessor from '../../../src/Illuminate/Database/Query/Processors/MySqlProcessor.js'

import getConnection from './getConnection.js'

const getMySqlBuilderWithProcessor = () => {
  const grammar = new MySqlGrammar()
  const processor = new MySqlProcessor()

  return new Builder(getConnection(), grammar, processor)
}

export default getMySqlBuilderWithProcessor

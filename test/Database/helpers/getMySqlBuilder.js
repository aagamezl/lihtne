import Builder from '../../../src/Illuminate/Database/Query/Builder.js'
import MySqlGrammar from '../../../src/Illuminate/Database/Query/Grammars/MySqlGrammar.js'
import Processor from '../../../src/Illuminate/Database/Query/Processors/Processor.js'
import getConnection from './getConnection.js'

const getMySqlBuilder = () => {
  const grammar = new MySqlGrammar()
  const processor = new Processor()

  return new Builder(getConnection(), grammar, processor)
}

export default getMySqlBuilder

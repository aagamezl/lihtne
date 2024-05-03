import Builder from '../../../src/Illuminate/Database/Query/Builder.js'
import Processor from '../../../src/Illuminate/Database/Query/Processors/Processor.js'
import SQLiteGrammar from '../../../src/Illuminate/Database/Query/Grammars/SQLiteGrammar.js'
import getConnection from './getConnection.js'

const getSQLiteBuilder = () => {
  const grammar = new SQLiteGrammar()
  const processor = new Processor()

  return new Builder(getConnection(), grammar, processor)
}

export default getSQLiteBuilder

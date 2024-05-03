import Builder from '../../../src/Illuminate/Database/Query/Builder.js'
import Processor from '../../../src/Illuminate/Database/Query/Processors/Processor.js'
import SqlServerGrammar from '../../../src/Illuminate/Database/Query/Grammars/SqlServerGrammar.js'
import getConnection from './getConnection.js'

const getSqlServerBuilder = () => {
  const grammar = new SqlServerGrammar()
  const processor = new Processor()

  return new Builder(getConnection(), grammar, processor)
}

export default getSqlServerBuilder

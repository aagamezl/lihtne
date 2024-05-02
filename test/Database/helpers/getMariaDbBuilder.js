import Builder from '../../../src/Illuminate/Database/Query/Builder.js'
import MariaDbGrammar from '../../../src/Illuminate/Database/Query/Grammars/MariaDbGrammar.js'
import Processor from '../../../src/Illuminate/Database/Query/Processors/Processor.js'
import getConnection from './getConnection.js'

const getMariaDbBuilder = () => {
  const grammar = new MariaDbGrammar()
  const processor = new Processor()

  return new Builder(getConnection(), grammar, processor)
}

export default getMariaDbBuilder

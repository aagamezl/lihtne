import Grammar from '../../../src/Illuminate/Database/Query/Grammars/Grammar.js'
import Builder from '../../../src/Illuminate/Database/Query/Builder.js'
import Processor from '../../../src/Illuminate/Database/Query/Processors/Processor.js'

import getConnection from './getConnection.js'

const getBuilder = () => {
  const grammar = new Grammar()
  const processor = new Processor()

  return new Builder(getConnection(), grammar, processor)
}

export default getBuilder

import Grammar from '../../../src/Illuminate/Database/Query/Grammars/Grammar.js'
import Builder from '../../../src/Illuminate/Database/Query/Builder.js'
import Processor from '../../../src/Illuminate/Database/Query/Processors/Processor.js'

import getConnection from './getConnection.js'

const getBuilder = (connection, grammar, processor) => {
  // const grammar = new Grammar()
  // const processor = new Processor()

  return new Builder(
    connection ?? getConnection(),
    grammar ?? new Grammar(),
    processor ?? new Processor()
  )
}

export default getBuilder

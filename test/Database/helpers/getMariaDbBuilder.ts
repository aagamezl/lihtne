import { jest } from '@jest/globals'

import { Builder } from '../../../src/Illuminate/Database/Query/Builder'
import { MariaDbGrammar } from '../../../src/Illuminate/Database/Query/Grammars/MariaDbGrammar'
import { Processor } from '../../../src/Illuminate/Database/Query/Processors/Processor'
import { getConnection } from './getConnection'

export const getMariaDbBuilder = (prefix: string = ''): Builder => {
  const connection = getConnection(prefix)
  const grammar = new MariaDbGrammar(connection)
  const processor = jest.mocked(new Processor())

  return new Builder(connection, grammar, processor)
}

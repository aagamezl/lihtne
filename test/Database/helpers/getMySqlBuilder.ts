import { jest } from '@jest/globals'

import { Processor } from '../../../src/Illuminate/Database/Query'
import { Builder } from '../../../src/Illuminate/Database/Query/Builder'
import { MySqlGrammar } from '../../../src/Illuminate/Database/Query/Grammars/MySqlGrammar'
import { getConnection } from './getConnection'

export const getMySqlBuilder = (prefix: string = ''): Builder => {
  const connection = getConnection(prefix)
  const grammar = new MySqlGrammar(connection)
  const processor = jest.mocked(new Processor())

  return new Builder(connection, grammar, processor)
}

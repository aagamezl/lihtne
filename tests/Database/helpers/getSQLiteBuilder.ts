import { jest } from '@jest/globals'

import { Builder, Processor } from '../../../src/Illuminate/Database/Query'
import { SQLiteGrammar } from '../../../src/Illuminate/Database/Query/Grammars/SQLiteGrammar'
import { getConnection } from './getConnection'

export const getSQLiteBuilder = (prefix: string = ''): Builder => {
  const connection = getConnection(prefix)
  const grammar = new SQLiteGrammar(connection)
  const processor = jest.mocked(new Processor())

  return new Builder(connection, grammar, processor)
}

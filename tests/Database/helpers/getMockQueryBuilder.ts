import { jest } from '@jest/globals'

import { Builder, Grammar, Processor } from '../../../src/Illuminate/Database/Query'
import { getConnection } from './getConnection'

export const getMockQueryBuilder = (): Builder => {
  const connection = getConnection()
  const processor = jest.mocked(new Processor())

  return new Builder(connection, new Grammar(connection), processor)
}

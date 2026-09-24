import {
  Builder,
  Processor,
  SqlServerGrammar
} from '../../../src/Illuminate/Database/Query'
import { getConnection } from './getConnection'

export const getSqlServerBuilder = (prefix: string = ''): Builder => {
  const connection = getConnection(prefix)
  const grammar = new SqlServerGrammar(connection)
  const processor = new Processor()

  return new Builder(connection, grammar, processor)
}

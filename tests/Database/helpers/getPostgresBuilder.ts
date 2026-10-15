import {
  Builder,
  PostgresGrammar,
  Processor
} from '../../../src/Illuminate/Database/Query'
import { getConnection } from './getConnection'

export const getPostgresBuilder = (prefix: string = ''): Builder => {
  const connection = getConnection(prefix)
  const grammar = new PostgresGrammar(connection)
  const processor = new Processor()

  return new Builder(connection, grammar, processor)
}

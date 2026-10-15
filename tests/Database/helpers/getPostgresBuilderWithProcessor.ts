import { Builder } from '../../../src/Illuminate/Database/Query/Builder'
import { PostgresGrammar } from '../../../src/Illuminate/Database/Query/Grammars/PostgresGrammar'
import { PostgresProcessor } from '../../../src/Illuminate/Database/Query/Processors/PostgresProcessor'
import { getConnection } from './getConnection'

export const getPostgresBuilderWithProcessor = (prefix: string = ''): Builder => {
  const connection = getConnection(prefix)
  const grammar = new PostgresGrammar(connection)
  const processor = new PostgresProcessor()

  return new Builder(connection, grammar, processor)
}

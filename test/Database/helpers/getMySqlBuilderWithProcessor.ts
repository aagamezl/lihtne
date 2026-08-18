import { Builder } from '../../../src/Illuminate/Database/Query/Builder'
import { MySqlGrammar } from '../../../src/Illuminate/Database/Query/Grammars/MySqlGrammar'
import { MySqlProcessor } from '../../../src/Illuminate/Database/Query/Processors/MySqlProcessor'

import { getConnection } from './getConnection'

export const getMySqlBuilderWithProcessor = (): Builder => {
  const grammar = new MySqlGrammar()
  const processor = new MySqlProcessor()

  return new Builder(getConnection(), grammar, processor)
}

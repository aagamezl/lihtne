import { Processor } from '../../../src/Illuminate/Database/Query'
import { Builder } from '../../../src/Illuminate/Database/Query/Builder'
import { Grammar } from '../../../src/Illuminate/Database/Query/Grammars/Grammar'
import { getConnection } from './getConnection'

export const getBuilder = (prefix: string = ''): Builder => {
  const connection = getConnection(prefix)

  return new Builder(
    connection,
    new Grammar(connection),
    new Processor()
  )
}

import { Builder, Grammar, Processor } from '../../../src/Illuminate/Database/Query'
import { getConnection } from './getConnection'

export const getBuilder = (prefix: string = ''): Builder => {
  const connection = getConnection(prefix)

  return new Builder(
    connection,
    new Grammar(connection),
    new Processor()
  )
}

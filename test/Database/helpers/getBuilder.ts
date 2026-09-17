import { Processor } from '../../../src/Illuminate/Database/Query'
import { Builder } from '../../../src/Illuminate/Database/Query/Builder'
import { Grammar } from '../../../src/Illuminate/Database/Query/Grammars/Grammar'
// import Processor from '../../../src/Illuminate/Database/Query/Processors/Processor.ts'
import { getConnection } from './getConnection'

export const getBuilder = (connection?: unknown, grammar?: unknown, processor?: unknown) => {
  const connectionInstance = connection ?? getConnection()

  return new Builder(
    connectionInstance,
    grammar ?? new Grammar(connectionInstance),
    processor ?? new Processor()
  )
}

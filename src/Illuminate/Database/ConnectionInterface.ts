import { Grammar } from './Query/Grammars'
import { Processor } from './Query/Processors'

export interface ConnectionInterface {
  getQueryGrammar(): Grammar
  getPostProcessor(): Processor
}

import { mixing } from '../../../Support/Traits'
import { CompilesJsonPaths } from '../../Concerns/CompilesJsonPaths'
import { Grammar as BaseGrammar } from '../../Grammar'

export interface Grammar extends BaseGrammar, CompilesJsonPaths { }

export class Grammar extends mixing(BaseGrammar).useTrait([CompilesJsonPaths]) implements Grammar {}

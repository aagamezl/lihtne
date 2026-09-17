import { mixing } from '../../../Support/Traits'
import { CompilesJsonPaths } from '../../Concerns/CompilesJsonPaths'
import { Grammar as BaseGrammar } from '../../Grammar'

export class Grammar extends mixing(BaseGrammar).useTrait([CompilesJsonPaths]) implements Grammar {}

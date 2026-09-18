import { EnumeratesValues } from './Traits/EnumeratesValues'
import { Macroable } from '../Macroable/Traits/Macroable'
import { mixing } from '../Support/Traits/use'

export interface Collection extends EnumeratesValues, Macroable {}

export class Collection extends mixing().useTrait([EnumeratesValues, Macroable]) {}
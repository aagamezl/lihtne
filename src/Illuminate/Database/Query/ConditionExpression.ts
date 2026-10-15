import type { ConditionExpression as ConditionExpressionContract } from '../../Contracts/Database/Query/ConditionExpression'

import { Expression } from './Expression'

/**
 * A raw SQL fragment used as a complete where/having condition (not a column operand).
 */
export class ConditionExpression
  extends Expression
  implements ConditionExpressionContract {}

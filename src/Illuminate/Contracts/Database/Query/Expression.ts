import { Grammar } from '../../../Database'

export interface Expression {
  /**
   * Get the value of the expression.
   *
   * @param  \Illuminate\Database\Grammar  $grammar
   * @return string|int|float
   */
  getValue(grammar: Grammar): string | number
}

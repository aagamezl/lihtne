import { Expression as ExpressionContract } from "../../Contracts/Database/Query/Expression";
import { Grammar } from "../Grammar";

/**
 * @template TValue of string|int|float
 */
export class Expression implements ExpressionContract {
  /**
   * Create a new raw query expression.
   *
   * @param  {string | number}  value
   */
  constructor(protected value: string | number) {
  }

  /**
   * Get the value of the expression.
   *
   * @param  {Grammar}  grammar
   * @return {string | number}
   */
  getValue(grammar: Grammar): string | number {
    return this.value;
  }
}

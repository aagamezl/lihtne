import { instanceProxy } from '../Support'

export class HigherOrderWhenProxy<TTarget> {
  /**
 * The target being conditionally operated on.
 *
 * @var mixed
 */
  protected target: TTarget

  /**
   * The condition for proxying.
   *
   * @var bool
   */
  protected conditionProperty: boolean = false

  /**
   * Indicates whether the proxy has a condition.
   *
   * @var bool
   */
  protected hasCondition: boolean = false

  /**
   * Determine whether the condition should be negated.
   *
   * @var bool
   */
  protected negateConditionOnCaptureProperty: boolean = false

  public constructor (target: TTarget) {
    this.target = target

    return instanceProxy(this)
  }

  public condition (value: boolean): this {
    [this.conditionProperty, this.hasCondition] = [value, true]

    return this
  }

  /**
   * Indicate that the condition should be negated.
   *
   * @return $this
   */
  public negateConditionOnCapture (): this {
    this.negateConditionOnCaptureProperty = true

    return this
  }

  /**
 * Proxy a method call on the target.
 *
 * @param  string  method
 * @param  array  parameters
 * @return mixed
 */
  public __call (method: string, parameters: unknown[]): unknown {
    if (!this.hasCondition) {
      const condition = this.target[method](...parameters)

      return this.condition(this.negateConditionOnCapture ? !condition : condition)
    }

    return this.conditionProperty
      ? this.target[method](...parameters)
      : this.target
  }
}

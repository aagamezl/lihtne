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
    ;[this.conditionProperty, this.hasCondition] = [value, true]

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
    const callTarget = (target: TTarget): unknown => {
      if (typeof target !== 'object' || target === null) {
        return target
      }

      const targetMethod = Reflect.get(target, method)

      if (typeof targetMethod !== 'function') {
        return target
      }

      return targetMethod.apply(target, parameters)
    }

    if (!this.hasCondition) {
      const condition = callTarget(this.target)

      const enabled = condition === true

      return this.condition(
        this.negateConditionOnCaptureProperty ? !enabled : enabled
      )
    }

    return this.conditionProperty ? callTarget(this.target) : this.target
  }
}

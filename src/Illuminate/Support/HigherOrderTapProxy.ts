import { instanceProxy } from './Proxies'

/**
 * @template TTarget
 */
export class HigherOrderTapProxy<TTarget> {
  /**
   * The target being tapped.
   *
   * @var TTarget
   */
  public target: TTarget

  /**
   * Create a new tap proxy instance.
   *
   * @param  TTarget  target
   */
  public constructor (target: TTarget) {
    this.target = target

    return instanceProxy(this)
  }

  /**
   * Dynamically pass method calls to the target.
   *
   * @param  string  method
   * @param  array  parameters
   * @return TTarget
   */
  public __call (method: string, parameters: unknown[]) {
    this.target[method](...parameters)

    return this.target
  }
}

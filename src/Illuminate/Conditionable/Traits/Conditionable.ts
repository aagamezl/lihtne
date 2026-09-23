import { HigherOrderWhenProxy } from '../HigherOrderWhenProxy'

/**
 * Laravel returns `$callback(...) ?? $this`; void callbacks still chain on `$this`.
 */
type WhenReturnType<TInstance, TReturn> =
  [TReturn] extends [void] ? TInstance : TInstance | TReturn

export class Conditionable {
  /**
   * Apply the callback if the given "value" is (or resolves to) truthy.
   *
   * @template TWhenParameter
   * @template TWhenReturnType
   *
   * @param  value
   * @param  callback
   * @param  defaultValue
   * @return this|TWhenReturnType
   */
  public when (): HigherOrderWhenProxy<this>
  public when (value: unknown): HigherOrderWhenProxy<this>
  public when<TWhenParameter, TWhenReturnType = this> (
    value: TWhenParameter | ((instance: this) => TWhenParameter),
    callback?: (instance: this, condition: TWhenParameter) => TWhenReturnType,
    defaultValue?: (instance: this, condition: TWhenParameter) => TWhenReturnType
  ): WhenReturnType<this, TWhenReturnType>
  public when<TWhenParameter, TWhenReturnType = this> (
    value?: TWhenParameter | ((instance: this) => TWhenParameter) | unknown,
    callback?: (instance: this, condition: TWhenParameter) => TWhenReturnType,
    defaultValue?: (instance: this, condition: TWhenParameter) => TWhenReturnType
  ): WhenReturnType<this, TWhenReturnType> | HigherOrderWhenProxy<this> {
    if (arguments.length === 0) {
      return new HigherOrderWhenProxy(this)
    }

    if (arguments.length === 1) {
      return new HigherOrderWhenProxy(this).condition(Boolean(value))
    }

    const resolved = value instanceof Function
      ? (value as (instance: this) => TWhenParameter)(this)
      : value as TWhenParameter

    if (resolved) {
      return (callback?.(this, resolved) ?? this) as WhenReturnType<this, TWhenReturnType>
    }

    if (defaultValue) {
      return (defaultValue(this, resolved) ?? this) as WhenReturnType<this, TWhenReturnType>
    }

    return this as WhenReturnType<this, TWhenReturnType>
  }
}

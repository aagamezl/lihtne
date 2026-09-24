import type { Builder } from '../../Database/Query'

import { HigherOrderWhenProxy } from '../HigherOrderWhenProxy'

/**
 * Laravel returns `$callback(...) ?? $this`; void callbacks still chain on `$this`.
 */
type WhenReturnType<TInstance, TReturn> =
  [TReturn] extends [void] ? TInstance : TInstance | TReturn

type UnlessReturnType<TInstance, TReturn> =
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
  public when<TWhenParameter, TWhenReturnType = this>(
    value: TWhenParameter | ((instance: this) => TWhenParameter),
    callback?: (value: this, condition: TWhenParameter) => TWhenReturnType,
    defaultValue?: (value: this | Builder, condition: TWhenParameter) => TWhenReturnType
  ): WhenReturnType<this, TWhenReturnType>
  public when<TWhenParameter, TWhenReturnType = this>(
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

  /**
   * Apply the callback if the given "value" is (or resolves to) falsy.
   *
   * @template TUnlessParameter
   * @template TUnlessReturnType
   *
   * @param  (\Closure($this): TUnlessParameter)|TUnlessParameter|null  $value
   * @param  (callable($this, TUnlessParameter): TUnlessReturnType)|null  $callback
   * @param  (callable($this, TUnlessParameter): TUnlessReturnType)|null  $default
   * @return $this|TUnlessReturnType
   */
  public unless (): HigherOrderWhenProxy<this>
  public unless (value: unknown): HigherOrderWhenProxy<this>
  public unless<TUnlessParameter, TUnlessReturnType = this>(
    value: TUnlessParameter | ((instance: this) => TUnlessParameter),
    callback?: (instance: this, condition: TUnlessParameter) => TUnlessReturnType,
    defaultValue?: (instance: this, condition: TUnlessParameter) => TUnlessReturnType
  ): UnlessReturnType<this, TUnlessReturnType>
  public unless<TUnlessParameter, TUnlessReturnType = this>(
    value?: TUnlessParameter | ((instance: this) => TUnlessParameter) | unknown,
    callback?: (instance: this, condition: TUnlessParameter) => TUnlessReturnType,
    defaultValue?: (instance: this, condition: TUnlessParameter) => TUnlessReturnType
  ): UnlessReturnType<this, TUnlessReturnType> | HigherOrderWhenProxy<this> {
    if (arguments.length === 0) {
      return (new HigherOrderWhenProxy(this)).negateConditionOnCapture()
    }

    if (arguments.length === 1) {
      return (new HigherOrderWhenProxy(this)).condition(!value)
    }

    const resolved = value instanceof Function
      ? (value as (instance: this) => TUnlessParameter)(this)
      : value as TUnlessParameter

    if (!value) {
      return (callback?.(this, resolved) ?? this) as UnlessReturnType<this, TUnlessReturnType>
    } else if (defaultValue) {
      return (defaultValue(this, resolved) ?? this) as UnlessReturnType<this, TUnlessReturnType>
    }

    return this
  }
}

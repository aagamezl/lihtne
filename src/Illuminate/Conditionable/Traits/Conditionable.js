// import { isFalsy, isTruthy } from '@devnetic/utils'
import { isFalsy, isTruthy } from '../../Support/index.js'

export default class Conditionable {
  /**
   * Apply the callback's query changes if the given "value" is false.
   *
   * @param  {*}  value
   * @param  {Function}  callbackFunc
   * @param  {Function}  [defaultCallback]
   * @return {this|*}
   */
  unless (value, callbackFunc, defaultCallback) {
    value = value instanceof Function ? value(this) : value
    if (isFalsy(value)) {
      return callbackFunc(this, value) ?? this
    } else if (defaultCallback !== undefined) {
      return defaultCallback(this, value) ?? this
    }
    return this
  }

  /**
   * Apply the callback's query changes if the given "value" is true.
   *
   * @param  {unknown}  value
   * @param  {Function}  callback
   * @param  {Function|undefined}  [defaultCallback]
   * @return {*|this}
   */
  when (value, callbackFunc, defaultCallback) {
    value = value instanceof Function ? value(this) : value
    // if (callbackFunc === undefined) {
    //   return new HigherOrderWhenProxy(this, value)
    // }
    if (isTruthy(value)) {
      return callbackFunc(this, value) ?? this
    } else if (defaultCallback !== undefined) {
      return defaultCallback(this, value) ?? this
    }
    return this
  }
}

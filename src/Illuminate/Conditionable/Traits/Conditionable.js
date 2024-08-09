import { isFalsy, isTruthy } from '@devnetic/utils'

// import { isFalsy, isTruthy } from '@devnetic/utils'
// export default class Conditionable {
const Conditionable = (superclass) => class extends superclass {
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

    if (isTruthy(value)) {
      return callbackFunc(this, value) ?? this
    } else if (defaultCallback !== undefined) {
      return defaultCallback(this, value) ?? this
    }

    return this
  }
}

export default Conditionable

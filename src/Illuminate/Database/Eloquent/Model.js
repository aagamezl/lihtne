import { capitalize } from '@devnetic/utils'

export default class Model {
  /**
   * Apply the given named scope if possible.
   *
   * @param  {string}  scope
   * @param  {any[]}  parameters
   * @return {any}
   */
  callNamedScope (scope, parameters = []) {
    // return Reflect.apply(this, method, parameters)
    this[`scope${capitalize(scope)}`](...parameters)
  }

  /**
   * Determine if the model has a given scope.
   *
   * @param  {string}  scope
   * @return {boolean}
   */
  hasNamedScope (scope) {
    // return Reflect.has(this, 'scope' + capitalize(scope))
    return this[`scope${capitalize(scope)}`] !== undefined
  }
}

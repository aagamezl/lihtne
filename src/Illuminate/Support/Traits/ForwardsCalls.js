// export default class ForwardsCalls {
const ForwardsCalls = (superclass) => class extends superclass {
  /**
   * Forward a method call to the given object.
   *
   * @param  {unknown}  object
   * @param  {string}  method
   * @param  {unknown[]}  parameters
   * @return {unknown}
   *
   * @throws \BadMethodCallException
   */
  forwardCallTo (object, method, parameters) {
    try {
      return object[method](...parameters)
    } catch (error) {
      this.throwBadMethodCallException(method)
    }
  }

  /**
 * Throw a bad method call exception for the given method.
 *
 * @param  {string}  method
 * @return {void}
 *
 * @throws {\BadMethodCallException}
 */
  throwBadMethodCallException (method) {
    throw new Error(`BadMethodCallException: Call to undefined method ${this.constructor.name}::${method}`)
  }
}

export default ForwardsCalls

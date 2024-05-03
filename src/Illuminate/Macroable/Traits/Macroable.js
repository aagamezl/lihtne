export default class Macroable {
  /**
   * The registered string macros.
   *
   * @var array
   */
  static { this.macros = [] }
  /**
   * Checks if macro is registered.
   *
   * @param  {string}  name
   * @return {boolean}
   */
  static hasMacro (name) {
    return this.macros[name] !== undefined
  }

  /**
   * Register a custom macro.
   *
   * @param  {string}  name
   * @param  {object|Function}  macro
   * @return {void}
   */
  static macro (name, macro) {
    this.macros[name] = macro
  }

  /**
   * Dynamically handle calls to the class.
   *
   * @param  {string}  method
   * @param  {array}  parameters
   * @return {any}
   *
   * @throws \BadMethodCallException
   */
  __call (method, parameters) {
    if (this.hasMacro(method) === false) {
      throw new Error(`BadMethodCallException: Method ${this.constructor.name}::${method} does not exist.`)
    }

    let macro = this.constructor.macros[method]

    if (macro instanceof Function) {
      macro = macro.bindTo(this, this.constructor.name)
    }

    return macro(...parameters)
  }
}

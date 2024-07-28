class Trait {
  constructor () {
    if (typeof new.target !== 'undefined' && new.target !== Trait) {
      throw new Error('Trait cannot be instantiated directly')
    }
  }
}

export default class Macroable extends Trait {
  /**
   * The registered string macros.
   *
   * @type {any[]}
   */
  static macros = []

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
    if (Macroable.hasMacro(method) === false) {
      throw new Error(`BadMethodCallException: Method ${this.constructor.name}::${method} does not exist.`)
    }

    let macro = Macroable.macros[method]

    if (macro instanceof Function) {
      macro = macro.bindTo(this, this.constructor.name)
    }

    return macro(...parameters)
  }
}

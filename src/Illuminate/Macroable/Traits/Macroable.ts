export class Macroable {
  /**
   * The registered string macros.
   *
   * @var array
   */
  protected macros: Record<string, unknown> = {}

  /**
   * Checks if macro is registered.
   *
   * @param  string  $name
   * @return bool
   */
  public hasMacro (name: string): boolean {
    return this.macros[name] !== undefined
  }

  /**
 * Dynamically handle calls to the class.
 *
 * @param  string  $method
 * @param  array  $parameters
 * @return mixed
 *
 * @throws \BadMethodCallException
 */
  public macroCall (method: string, parameters: unknown[]): unknown {
    if (!this.hasMacro(method)) {
      throw new Error(`BadMethodCallException: Method ${this.constructor.name}::${method}() does not exist.`)
    }

    let macro = this.macros[method]

    if (typeof macro === 'function') {
      try {
        macro = macro.bind(this) ?? (() => { throw new Error('RuntimeException: Unable to bind macro to instance.') })()
      } catch (error) {
        macro = macro.bind(null) ?? (() => { throw new Error('RuntimeException: Unable to bind macro to instance.') })()
      }
    }

    return (macro as Function)(...parameters)
  }
}

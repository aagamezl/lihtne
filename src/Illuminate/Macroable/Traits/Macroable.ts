import { isNil } from '@devnetic/utils'

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
        const boundMacro = macro.bindTo(this)

        if (isNil(boundMacro)) {
          throw new Error('RuntimeException: Unable to bind macro to instance.')
        }

        macro = boundMacro
      } catch (error) {
        macro = macro.bind(null)
      }
    }

    return (macro as Function)(...parameters)
  }
}

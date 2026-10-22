import { isNil } from '@devnetic/utils'

export type Macro = (...args: unknown[]) => unknown
export class Macroable {
  /**
   * The registered string macros.
   *
   * @var array
   */
  protected macros: Record<string, unknown> = {}

  /**
   * Dynamically handle calls to the class.
   *
   * @param  string  $method
   * @param  array  $parameters
   * @return mixed
   *
   * @throws \BadMethodCallException
   */
  // public macroCall(method: string, parameters: unknown[]): unknown {
  public __call (method: string, ...parameters: Array<unknown>): unknown {
    if (!this.hasMacro(method)) {
      throw new Error(
        `BadMethodCallException: Method ${this.constructor.name}.${method}() does not exist.`
      )
    }

    const registered = (this.macros ?? {})[method]
    let macro = registered

    if (typeof registered === 'function') {
      try {
        const boundMacro = registered.bind(this)

        if (isNil(boundMacro)) {
          throw new Error('RuntimeException: Unable to bind macro to instance.')
        }

        macro = boundMacro
      } catch {
        macro = registered.bind(null)
      }
    }

    return (macro as Macro)(...parameters)
  }

  /**
   * Checks if macro is registered.
   *
   * @param  string  $name
   * @return bool
   */
  public hasMacro (name: string): boolean {
    return (this.macros ?? {})[name] !== undefined
  }

  /**
   * Register a custom macro.
   *
   * @param  string  $name
   * @param  object|callable  $macro
   *
   * @param-closure-this static  $macro
   *
   * @return void
   */
  public macro (name: string, macro: unknown): void {
    this.macros[name] = macro
  }
}

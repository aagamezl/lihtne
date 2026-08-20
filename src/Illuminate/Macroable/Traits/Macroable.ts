import { type Constructor } from '../../Support/Traits/use'

// const Macroable = (superclass: Constructor): Constructor => class extends superclass {
//   // The registered string macros.
//   static macros: Record<string, object | Function> = {}

//   /**
//    * Checks if macro is registered.
//    *
//    * @param  {string}  name
//    * @return {boolean}
//    */
//   static hasMacro(name: string) {
//     return this.macros[name] !== undefined
//   }

//   /**
//    * Register a custom macro.
//    *
//    * @param  {string}  name
//    * @param  {object|Function}  macro
//    * @return {void}
//    */
//   static macro(name: string, macro: object | Function) {
//     this.macros[name] = macro
//   }

//   /**
//    * Dynamically handle calls to the class.
//    *
//    * @param  {string}  method
//    * @param  {array}  parameters
//    * @return {any}
//    *
//    * @throws \BadMethodCallException
//    */
//   __call(method: string, parameters: any[]) {
//     if ((this.constructor as any).hasMacro(method) === false) {
//       throw new Error(`BadMethodCallException: Method ${this.constructor.name}::${method} does not exist.`)
//     }

//     let macro = Macroable.macros[method]

//     if (macro instanceof Function) {
//       macro = macro.bindTo(this, this.constructor.name)
//     }

//     return macro(...parameters)
//   }
// }

// export default Macroable

type MacroFn = (...args: any[]) => any

export const Macroable = <TBase extends Constructor>(Base: TBase) => {
  return class extends Base {
    // The registered string macros.
    static macros: Record<string, object | MacroFn> = {}

    /**
     * Checks if macro is registered.
     *
     * @param  {string}  name
     * @return {boolean}
     */
    static hasMacro(name: string) {
      return this.macros[name] !== undefined
    }

    /**
     * Register a custom macro.
     *
     * @param  {string}  name
     * @param  {object|Function}  macro
     * @return {void}
     */
    static macro(name: string, macro: object | MacroFn) {
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
    __call(method: string, parameters: any[]) {
      if ((this.constructor as any).hasMacro(method) === false) {
        throw new Error(
          `BadMethodCallException: Method ${this.constructor.name}::${method} does not exist.`
        )
      }

      let macro = (this.constructor as any).macros[method]

      if (macro instanceof Function) {
        macro = macro.bindTo(this, this.constructor.name)
      }

      return macro(...parameters)
    }
  }
}

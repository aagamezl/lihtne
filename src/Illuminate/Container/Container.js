/**
 * @typedef {Object} AbstractAlias
 * @property {Function} abstract - The abstract class representing the module.
 * @property {Function[]} dependencies - An array of classes representing dependencies.
 */

/**
 * Represents an alias for a class or dependency.
 * @typedef {Object} Alias
 * @property {new (...args: any[]) => any} abstract The constructor of the abstract class being aliased.
 * @property {Array<new (...args: any[]) => any>} [dependencies] Optional array of constructors representing dependencies required for the aliased class.
 */

/**
 * Object containing aliases for various classes or dependencies.
 * @typedef {Object.<string, Alias>} Aliases
 */

export default class Container {
  /**
   * The registered type aliases.
   *
   * @protected
   * @type {Aliases}
   */
  aliases = {}

  /**
   * The registered aliases keyed by the abstract name.
   *
   * @protected
   * @type {Record<string, AbstractAlias[]>}
   */
  abstractAliases = {}

  /**
   * Alias a type to a different name.
   *
   * @param  {string}  alias
   * @param  {Object}  abstract
   * @param  {Class[]}  [dependencies=[]]
   * @return {void}
   *
   * @throws {LogicException}
   */
  alias (alias, abstract, dependencies = []) {
    // TODO: this line needs to be fixed, maybe "alias === abstract.name"
    // if (alias === abstract) {
    if (alias === abstract.name) {
      throw new Error(`LogicException: [${alias}] is aliased to itself.`)
    }

    this.aliases[alias] = { abstract, dependencies }

    if (!Array.isArray(this.abstractAliases[abstract])) {
      this.abstractAliases[alias] = []
    }

    // (this.abstractAliases[alias] ??= []).push({ abstract, dependencies })
    this.abstractAliases[alias].push({ abstract, dependencies })
  }

  /**
   *
   * @param {string|Function} abstract
   * @param {unknown[]} dependencies
   * @returns {unknown}
   */
  build (abstract, dependencies) {
    return Reflect.construct(
      abstract,
      dependencies
    )
  }

  /**
   * Get the alias for an abstract if available.
   *
   * @param  {string | Alias}  abstract
   * @returns {Alias}
   */
  getAlias (abstract) {
    return this.aliases[abstract]
      ? this.getAlias(this.aliases[abstract])
      : abstract
  }

  /**
   *
   * @protected
   * @param {unknown[]} dependencies
   * @returns {unknown[]}
   */
  getParameters (dependencies) {
    return dependencies.map(dependency => {
      return Reflect.construct(dependency, [])
    })
  }

  /**
   * Determine if the given abstract is buildable.
   *
   * @protected
   * @param  {Function}  abstract
   * @return {boolean}
   */
  isBuildable (abstract) {
    return abstract instanceof Function
  }

  /**
   * Resolve the given type from the container.
   *
   * @param  {string|Alias}  abstract
   * @param  {array}  parameters
   * @return {*}
   *
   * @throws {\Illuminate\Contracts\Container\BindingResolutionException}
   */
  make (abstract, parameters = []) {
    return this.resolve(abstract, parameters)
  }

  /**
   * Resolve the given type from the container.
   *
   * @protected
   * @param  {string|Function}  abstract
   * @param  {unknown[]}  parameters
   * @param  {boolean}  raiseEvents
   * @return {unknown}
   *
   * @throws {\Illuminate\Contracts\Container\BindingResolutionException}
   * @throws {\Illuminate\Contracts\Container\CircularDependencyException}
   */
  resolve (abstract, parameters = [], raiseEvents = true) {
    const alias = this.getAlias(abstract)

    // if (this.isBuildable(abstract.abstract)) {
    //   return Reflect.construct(
    //     abstract.abstract,
    //     [...parameters, ...this.getParameters(abstract.dependencies)]
    //   )
    // } else {
    //   return abstract
    // }
    return this.isBuildable(abstract.abstract)
      ? this.build(alias.abstract, [...parameters, ...this.getParameters(alias.dependencies)])
      : abstract
  }
}

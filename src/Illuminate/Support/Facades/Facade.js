import { isObject } from '@devnetic/utils'

import Application from '../../Contracts/Foundation/Application.js'
import InstanceProxy from '../Proxies/InstanceProxy.js'
import { throwException } from '../helpers.js'
import StaticProxy from './../Proxies/StaticProxy.js'

class FacadeClass {
  /**
   * The application instance being facaded.
   *
   * @type {Application}
   */
  // app = undefined

  /**
   * The resolved object instances.
   *
   * @member {Record<string, unknown>}
   */
  // resolvedInstance = {}

  /**
   * @protected
   * @type {Application}
   * */
  static app

  /** @protected */
  static resolvedInstance = {}

  constructor () {
    if (new.target === FacadeClass) {
      throwException('abstract')
    }

    return InstanceProxy(this)
  }

  /**
   * Handle dynamic, static calls to the object.
   *
   * @param  {string}  method
   * @param  {Array}  args
   * @return {*}
   *
   * @throws {Error<RuntimeException>}
   */
  static callStatic (method, ...args) {
    const instance = this.getFacadeRoot()

    if (!instance) {
      throw new Error('RuntimeException: A facade root has not been set.')
    }

    return instance[method](...args)
  }

  /**
   * Get the registered name of the component.
   *
   * @return {string}
   *
   * @throws {\RuntimeException}
   */
  static getFacadeAccessor () {
    throw new Error('RuntimeException: Facade does not implement getFacadeAccessor method.')
  }

  /**
   * Get the root object behind the facade.
   *
   * @return {*}
   */
  static getFacadeRoot () {
    return this.resolveFacadeInstance(this.getFacadeAccessor())
  }

  /**
   * Resolve the facade root instance from the container.
   *
   * @param  {Object|string}  name
   * @return {*}
   */
  static resolveFacadeInstance (name) {
    if (isObject(name)) {
      return name
    }

    if (this.resolvedInstance[name]) {
      return this.resolvedInstance[name]
    }

    // TODO: Reduce the logic beyond here; Application class have unnecessay
    // thing. Refactor to only maintain DatabaseManager and Repository
    if (this.app) {
      this.resolvedInstance[name] = this.app[name]
    } else {
      const app = new Application()
      this.setFacadeApplication(app)

      this.resolvedInstance[name] = this.app[name]
    }

    return this.resolvedInstance[name]
  }

  /**
   * Set the application instance.
   *
   * @param  {Application}  app
   * @return {void}
   */
  static setFacadeApplication (app) {
    this.app = app
  }
}

// FacadeClass.app = undefined
// FacadeClass.resolvedInstance = {}

/** @type {FacadeClass} */
const Facade = StaticProxy(FacadeClass)

export default Facade

class Fluent {
  /**
   * All of the attributes set on the fluent instance.
   *
   * @type {Record<string, unknown>}
   */
  attributes = {}

  /**
   * Create a new fluent instance.
   *
   * @param  {Record<string, unknown>}  [attributes]
   */
  constructor(attributes = {}) {
    for (const [key, value] of Object.entries(attributes)) {
      this.attributes[key] = value
    }

    const handler = {
      get(target, method, receiver) {
        if (Reflect.has(target, method)) {
          return target[method]
        }

        return new Proxy(() => { }, {
          get: handler.get,
          apply: (target, thisArg, parameters) => {
            thisArg.attributes[method] = parameters.length > 0 ? parameters[0] : true

            return thisArg
          }
        })
      },
      getPrototypeOf(target) {
        return Object.getPrototypeOf(target)
      }
    }

    return new Proxy(this, handler)
  }

  __call(method, parameters) {
    this.attributes[method] = parameters.length > 0 ? reset(parameters) : true

    return this;
  }
}

const fluent = new Fluent()
// fluent.foo = 'NOT MAGIC';
// console.log(fluent.foo); // NOT MAGIC
console.log(fluent.bar); // MAGIC
console.log(fluent.method(123)); // MAGIC

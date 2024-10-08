const InstanceProxy = (instance, handler) => {
  const proxyHandler = handler ?? {
    get (target, property, receiver) {
      if (Reflect.has(target, property)) {
        return Reflect.get(target, property)
      }

      return (...args) => {
        return receiver.call(property, ...args)
      }
    },
    getPrototypeOf (target) {
      return Object.getPrototypeOf(target)
    }
  }

  return new Proxy(instance, proxyHandler)
}

export default InstanceProxy

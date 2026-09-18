export const instanceProxy = <T extends object>(instance: T, handler?: ProxyHandler<T>) => {
  const proxyHandler = handler ?? {
    get (target, property, receiver) {
      if (Reflect.has(target, property)) {
        return Reflect.get(target, property)
      }

      return (...args: unknown[]) => {
        return receiver.__call(property, ...args)
      }
    },
    getPrototypeOf (target) {
      return Object.getPrototypeOf(target)
    }
  }

  return new Proxy(instance, proxyHandler)
}

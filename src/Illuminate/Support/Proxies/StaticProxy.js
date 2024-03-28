const StaticProxy = (facade) => {
  return new Proxy(facade, {
    get (target, method, receiver) {
      if (Reflect.has(target, method)) {
        return target[method]
      } else {
        return (...args) => {
          return receiver.callStatic(method, ...args)
          // return target.callStatic(method, ...args)
        }
      }
    }
  })
}

export default StaticProxy

export type Constructor<T = any> = abstract new (
  ...args: never[]
) => T

export type Mixing = {
  useTrait: (constructors: Constructor[]) => Constructor
}

export const mixing = (derivedCtor: Constructor = class { }): Mixing => {
  return {
    useTrait: (constructors: Constructor[]) => {
      constructors.forEach((baseCtor) => {
        Object.getOwnPropertyNames(baseCtor.prototype).forEach((name) => {
          Object.defineProperty(
            derivedCtor.prototype,
            name,
            Object.getOwnPropertyDescriptor(baseCtor.prototype, name) ||
            Object.create(null)
          )
        })
      })

      return derivedCtor
    }
  }
}

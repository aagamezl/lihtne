export type Constructor<T = any> = abstract new (
  ...args: never[]
) => T

export type Mixing<TCtor extends Constructor = Constructor> = {
  useTrait: (constructors: Constructor[]) => TCtor
}

export const mixing = <TCtor extends Constructor>(
  derivedCtor: TCtor = class { } as unknown as TCtor
): Mixing<TCtor> => {
  return {
    useTrait: (constructors: Constructor[]): TCtor => {
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

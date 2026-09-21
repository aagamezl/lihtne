export type Constructor<T = object> = abstract new (
  ...args: never[]
) => T

type DefaultMixinCtor = new () => object

export type Mixing<TCtor extends Constructor = DefaultMixinCtor> = {
  useTrait: (constructors: Constructor[]) => TCtor
}

export const mixing = <TCtor extends Constructor = DefaultMixinCtor>(
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

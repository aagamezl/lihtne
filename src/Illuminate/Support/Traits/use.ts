export type Constructor<T = {}> = new (...args: any[]) => T
export type Trait = <TBase extends Constructor>(base: TBase) => Constructor<any>

export const mix = <TBase extends Constructor = Constructor>(Base?: TBase) => {
  const BaseClass = (Base ?? class {}) as Constructor

  return {
    use(...traits: Trait[]) {
      return traits.reduce(
        (CurrentClass, trait) => trait(CurrentClass),
        BaseClass
      )
    },
  }
}
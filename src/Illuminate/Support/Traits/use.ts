// export type Constructor<T = {}> = new (...args: any[]) => T
// export type Trait = <TBase extends Constructor>(base: TBase) => Constructor<any>
// export type Constructor<T = {}> = new (...args: any[]) => T
// type Constructor = new (...args: any[]) => {};
// export type Trait = <TBase extends Constructor>(base: TBase) => Constructor<any>

// export const mixing = <TBase extends Constructor = Constructor>(Base?: TBase) => {
//   const BaseClass = (Base ?? class {}) as Constructor

//   return {
//     use(...traits: Trait[]) {
//       return traits.reduce(
//         (CurrentClass, trait) => trait(CurrentClass),
//         BaseClass
//       )
//     },
//   }
// }

export type Constructor<T = object> = abstract new (
  ...args: any[]
) => T;

export const mixing = (derivedCtor: Constructor = class { }) => {
  return {
    useTrait: (constructors: Constructor[]) => {
      constructors.forEach((baseCtor) => {
        Object.getOwnPropertyNames(baseCtor.prototype).forEach((name) => {
          Object.defineProperty(
            derivedCtor.prototype,
            name,
            Object.getOwnPropertyDescriptor(baseCtor.prototype, name) ||
            Object.create(null)
          );
        });
      });

      return derivedCtor
    }
  }
}

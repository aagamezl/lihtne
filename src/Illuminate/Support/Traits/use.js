const use = (target, traits) => {
  for (let i = 0; i < traits.length; i++) {
    const traitPrototype = traits[i].prototype
    const propertyNames = Object.getOwnPropertyNames(traitPrototype)

    for (let j = 0, length = propertyNames.length; j < length; j++) {
      const name = propertyNames[j]

      if (name !== 'constructor') {
        target.prototype[name] = traitPrototype[name]
      }
    }
  }
}

// const use = (derivedCtor, constructors) => {
//   constructors.forEach((baseCtor) => {
//     Object.getOwnPropertyNames(baseCtor.prototype).forEach((name) => {
//       Object.defineProperty(
//         derivedCtor.prototype,
//         name,
//         Object.getOwnPropertyDescriptor(baseCtor.prototype, name) ||
//         Object.create(null)
//       )
//     })
//   })
// }

export default use

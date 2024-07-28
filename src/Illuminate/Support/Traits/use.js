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

  // NEW WAY, TEST IT - 2024-07-23
  // traits.forEach((traitClass) => {
  //   // Check if traitClass is a class (avoids errors with non-functions)
  //   if (typeof traitClass !== 'function') {
  //     throw new Error('Trait must be a class')
  //   }

  //   // Ensure the trait cannot be directly instantiated
  //   if (typeof traitClass.prototype.constructor !== 'function') {
  //     throw new Error('Trait cannot be instantiated directly')
  //   }

  //   // Copy static methods from trait to target class
  //   Object.getOwnPropertyNames(traitClass)
  //     .filter((name) => name !== 'constructor' && typeof traitClass[name] === 'function')
  //     .forEach((methodName) => {
  //       target[methodName] = traitClass[methodName]
  //     })

  //   // Copy instance methods from trait prototype to target class prototype
  //   Object.getOwnPropertyNames(traitClass.prototype)
  //     .filter((name) => name !== 'constructor' && typeof traitClass.prototype[name] === 'function')
  //     .forEach((methodName) => {
  //       target.prototype[methodName] = traitClass.prototype[methodName]
  //     })
  // })
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

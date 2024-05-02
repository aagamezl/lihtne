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

export default use

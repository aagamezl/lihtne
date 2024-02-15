const use = (target, traits) => {
  traits.forEach((trait) => {
    const [baseCtor, alias] = typeof trait === 'function' ? [trait, {}] : trait

    Object.getOwnPropertyNames(baseCtor.prototype)
      .filter(name => name !== 'constructor')
      .forEach((name) => {
        Object.defineProperty(
          (target).prototype,
          alias[name] ?? name,
          Object.getOwnPropertyDescriptor(baseCtor.prototype, name) ?? Object.create(null)
        )
      })
  })
}

export default use

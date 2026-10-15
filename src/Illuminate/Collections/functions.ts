export const enumValue = (value: unknown): unknown => {
  if (value !== null && value !== undefined && typeof value === 'object') {
    if ('value' in value) {
      return value.value
    }

    if ('name' in value && typeof value.name === 'string') {
      return value.name
    }
  }

  return value
}

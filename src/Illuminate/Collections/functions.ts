export const enumValue = (value: unknown): unknown => {
  if (typeof value === 'object' && value !== null && 'value' in value) {
    return value.value
  }

  return value
}

const VERSION_SEPARATOR = '.'
const SPECIAL_SEPARATORS_PATTERN = /[-_+]/
const DIGIT_PATTERN = /\d/
const ALPHANUMERIC_PATTERN = /[a-zA-Z0-9]/
const DECIMAL_RADIX = 10

const ORDER_LESS = -1
const ORDER_EQUAL = 0
const ORDER_GREATER = 1

const NUMBER_PLACEHOLDER = '#N#'
const UNKNOWN_FORM_ORDER = -1

// Order matters: matching is prefix based, as in PHP
const SPECIAL_FORM_ORDERS: ReadonlyArray<readonly [string, number]> = [
  ['dev', 0],
  ['alpha', 1],
  ['a', 1],
  ['beta', 2],
  ['b', 2],
  ['RC', 3],
  ['rc', 3],
  ['#', 4],
  ['pl', 5],
  ['p', 5]
]

type VersionOperator =
  | '<' | 'lt' |
  '<=' | 'le' |
  '>' | 'gt' |
  '>=' | 'ge' |
  '==' | 'eq' |
  '!=' | '<>' | 'ne'

const isDigit = function (char: string): boolean {
  return DIGIT_PATTERN.test(char)
}

const isNonDigit = function (char: string): boolean {
  return !isDigit(char) && char !== VERSION_SEPARATOR
}

const sign = function (value: number): number {
  if (value < ORDER_EQUAL) {
    return ORDER_LESS
  }

  if (value > ORDER_EQUAL) {
    return ORDER_GREATER
  }

  return ORDER_EQUAL
}

const canonicalizeVersion = function (version: string): string {
  let canonical = version[0]
  let previousChar = version[0]

  for (let index = 1; index < version.length; index++) {
    const currentChar = version[index]
    const lastCanonicalChar = canonical[canonical.length - 1]
    const needsSeparator = lastCanonicalChar !== VERSION_SEPARATOR

    if (SPECIAL_SEPARATORS_PATTERN.test(currentChar)) {
      if (needsSeparator) {
        canonical += VERSION_SEPARATOR
      }
    } else if (
      (isNonDigit(previousChar) && isDigit(currentChar)) ||
      (isDigit(previousChar) && isNonDigit(currentChar))
    ) {
      if (needsSeparator) {
        canonical += VERSION_SEPARATOR
      }

      canonical += currentChar
    } else if (!ALPHANUMERIC_PATTERN.test(currentChar)) {
      if (needsSeparator) {
        canonical += VERSION_SEPARATOR
      }
    } else {
      canonical += currentChar
    }

    previousChar = currentChar
  }

  return canonical
}

const getSpecialFormOrder = function (form: string): number {
  const match = SPECIAL_FORM_ORDERS.find(function ([name]) {
    return form.startsWith(name)
  })

  return match === undefined ? UNKNOWN_FORM_ORDER : match[1]
}

const compareSpecialForms = function (form1: string, form2: string): number {
  return sign(getSpecialFormOrder(form1) - getSpecialFormOrder(form2))
}

const comparePart = function (part1: string, part2: string): number {
  const isPart1Numeric = isDigit(part1.charAt(0))
  const isPart2Numeric = isDigit(part2.charAt(0))

  if (isPart1Numeric && isPart2Numeric) {
    return sign(parseInt(part1, DECIMAL_RADIX) - parseInt(part2, DECIMAL_RADIX))
  }

  if (!isPart1Numeric && !isPart2Numeric) {
    return compareSpecialForms(part1, part2)
  }

  if (isPart1Numeric) {
    return compareSpecialForms(NUMBER_PLACEHOLDER, part2)
  }

  return compareSpecialForms(part1, NUMBER_PLACEHOLDER)
}

const compareVersions = function (version1: string, version2: string): number {
  if (version1.length === 0 && version2.length === 0) {
    return ORDER_EQUAL
  }

  if (version1.length === 0) {
    return ORDER_LESS
  }

  if (version2.length === 0) {
    return ORDER_GREATER
  }

  const parts1 = canonicalizeVersion(version1).split(VERSION_SEPARATOR)
  const parts2 = canonicalizeVersion(version2).split(VERSION_SEPARATOR)
  const commonLength = Math.min(parts1.length, parts2.length)

  for (let index = 0; index < commonLength; index++) {
    const result = comparePart(parts1[index], parts2[index])

    if (result !== ORDER_EQUAL) {
      return result
    }
  }

  if (parts1.length > commonLength) {
    const remaining = parts1[commonLength]

    return isDigit(remaining.charAt(0))
      ? ORDER_GREATER
      : compareSpecialForms(remaining, NUMBER_PLACEHOLDER)
  }

  if (parts2.length > commonLength) {
    const remaining = parts2[commonLength]

    return isDigit(remaining.charAt(0))
      ? ORDER_LESS
      : compareSpecialForms(NUMBER_PLACEHOLDER, remaining)
  }

  return ORDER_EQUAL
}

const evaluateOperator = function (
  comparison: number,
  operator: VersionOperator
): boolean {
  switch (operator) {
    case '<':
    case 'lt':
      return comparison < ORDER_EQUAL
    case '<=':
    case 'le':
      return comparison <= ORDER_EQUAL
    case '>':
    case 'gt':
      return comparison > ORDER_EQUAL
    case '>=':
    case 'ge':
      return comparison >= ORDER_EQUAL
    case '==':
    case 'eq':
      return comparison === ORDER_EQUAL
    case '!=':
    case '<>':
    case 'ne':
      return comparison !== ORDER_EQUAL
    default:
      throw new TypeError(`Invalid operator: ${String(operator)}`)
  }
}

interface VersionCompare {
  (version1: string, version2: string): -1 | 0 | 1
  (version1: string, version2: string, operator: VersionOperator): boolean
}

export const versionCompare: VersionCompare = (
  version1: string,
  version2: string,
  operator?: VersionOperator
): -1 | 0 | 1 | boolean => {
  const comparison = compareVersions(version1, version2)

  if (operator === undefined) {
    return comparison
  }

  return evaluateOperator(comparison, operator)
}

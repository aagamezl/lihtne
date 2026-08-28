import type { ConcreteConstructor, Trait } from "../../Support/Traits"

/**
 * The default path segment delimiter, matching PHP's `$delimiter = '->'`
 * default parameter on wrapJsonPath().
 */
const DEFAULT_JSON_PATH_DELIMITER = '->'

/**
 * Matches one or more trailing bracketed array-index groups, e.g. "[0]" or
 * "[0][1]", at the end of a path segment. Mirrors the PHP pattern
 * '/(\[[^\]]+\])+$/'.
 */
const TRAILING_ARRAY_INDEX_PATTERN = /(\[[^\]]+\])+$/

/**
 * Matches a single (optionally backslash-escaped) apostrophe, used to
 * escape quotes inside a JSON path value. Mirrors the PHP pattern
 * "/([\\\\]+)?\\'/".
 */
const ESCAPED_APOSTROPHE_PATTERN = /(\\+)?'/g

/**
 * Replacement used to turn an escaped or bare apostrophe into a doubled
 * SQL-style apostrophe, matching PHP's replacement string "''".
 */
const DOUBLED_APOSTROPHE_REPLACEMENT = "''"

/**
 * Any class that wants to use the CompilesJsonPaths trait must provide a
 * `wrap` method. In the PHP original this comes from the base Grammar
 * class that CompilesJsonPaths is mixed into.
 */
export interface Wrappable {
  wrap(value: string): string
}

/**
 * Returns everything in `subject` before the last occurrence of `search`.
 * If `search` does not occur, the original subject is returned.
 *
 * Equivalent to Laravel's Illuminate\Support\Str::beforeLast().
 */
function beforeLast(subject: string, search: string): string {
  if (search === '') {
    return subject
  }

  const lastIndex = subject.lastIndexOf(search)

  if (lastIndex === -1) {
    return subject
  }

  return subject.slice(0, lastIndex)
}

/**
 * The CompilesJsonPaths trait/mixin.
 *
 * Adds JSON path compilation helpers (wrapJsonFieldAndPath, wrapJsonPath,
 * wrapJsonPathSegment) to any base class that satisfies Wrappable.
 */
export class CompilesJsonPaths {
  /**
   * Split the given JSON selector into the field and the optional path,
   * and wrap them separately.
   */
  wrapJsonFieldAndPath(column: string): [string, string] {
    const JSON_FIELD_PATH_SEPARATOR = '->'
    const MAX_SPLIT_PARTS = 2

    const parts = column.split(JSON_FIELD_PATH_SEPARATOR, MAX_SPLIT_PARTS)

    const field = this.wrap(parts[0]!)

    let path = ''

    if (parts.length > 1) {
      path = ', ' + this.wrapJsonPath(parts[1]!, JSON_FIELD_PATH_SEPARATOR)
    }

    return [field, path]
  }

  /**
   * Wrap the given JSON path.
   */
  wrapJsonPath(value: string, delimiter: string = DEFAULT_JSON_PATH_DELIMITER): string {
    const escapedValue = value.replace(
      ESCAPED_APOSTROPHE_PATTERN,
      DOUBLED_APOSTROPHE_REPLACEMENT
    )

    const jsonPath = escapedValue
      .split(delimiter)
      .map((segment) => {
        return this.wrapJsonPathSegment(segment)
      })
      .join('.')

    const JSON_PATH_ROOT_PREFIX = '$'
    const JSON_PATH_SEPARATOR = '.'
    const ARRAY_INDEX_OPEN_BRACKET = '['

    let prefix = JSON_PATH_ROOT_PREFIX

    if (!jsonPath.startsWith(ARRAY_INDEX_OPEN_BRACKET)) {
      prefix += JSON_PATH_SEPARATOR
    }

    return `'${prefix}${jsonPath}'`
  }

  /**
   * Wrap the given JSON path segment.
   */
  wrapJsonPathSegment(segment: string): string {
    const match = segment.match(TRAILING_ARRAY_INDEX_PATTERN)

    if (match !== null) {
      const arrayIndexSuffix = match[0]
      const key = beforeLast(segment, arrayIndexSuffix)

      if (key !== '') {
        return `"${key}"${arrayIndexSuffix}`
      }

      return arrayIndexSuffix
    }

    return `"${segment}"`
  }
}

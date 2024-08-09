import Str from './../../Support/Str.js'
import { collect } from '../../Collections/helpers.js'
import { explode } from '../../Support/helpers.js'

// export const CompilesJsonPaths = {
// export default class CompilesJsonPaths {
const CompilesJsonPaths = (superclass) => class extends superclass {
  /**
   * Split the given JSON selector into the field and the optional path and wrap them separately.
   *
   * @param  {string}  column
   * @return {array}
   */
  wrapJsonFieldAndPath (column) {
    // const parts = column.split('->', 2)
    const parts = explode('->', column, 2)

    const field = this.wrap(parts[0])

    const path = parts.length > 1 ? ', ' + this.wrapJsonPath(parts[1], '->') : ''

    return [field, path]
  }

  /**
   * Wrap the given JSON path.
   *
   * @param  {string}  value
   * @param  {string}  delimiter
   * @return {string}
   */
  wrapJsonPath (value, delimiter = '->') {
    value = value.replace(/([\\]+)?'/g, '\'\'')

    const jsonPath = collect(value.split(delimiter))
      .map((segment) => this.wrapJsonPathSegment(segment))
      .join('.')

    return "'$" + (jsonPath.startsWith('[') ? '' : '.') + jsonPath + "'"
  }

  /**
   * Wrap the given JSON path segment.
   *
   * @protected
   * @param  {string}  segment
   * @return {string}
   */
  wrapJsonPathSegment (segment) {
    const parts = segment.match(/(\[[^\]]+\])+/)

    if (parts !== null) {
      const key = Str.beforeLast(segment, parts[0])

      if (key.length !== 0) {
        return '"' + key + '"' + parts[0]
      }

      return parts[0]
    }

    return '"' + segment + '"'
  }
}

export default CompilesJsonPaths

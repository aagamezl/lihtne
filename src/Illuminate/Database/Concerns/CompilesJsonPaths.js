import { isNil } from '@devnetic/utils'

import { collect } from '../../Collections/helpers.js'
import Str from './../../Support/Str.js'

// export const CompilesJsonPaths = {
export default class CompilesJsonPaths {
  /**
   * Split the given JSON selector into the field and the optional path and wrap them separately.
   *
   * @param  {string}  column
   * @return {array}
   */
  wrapJsonFieldAndPath (column) {
    const parts = column.split('->', 2)
    /**
     * The wrap method exists on the trait target prototype
     *
     * @ts-expect-error */
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
      .map((segment) => this.wrapJsonPathSegment(String(segment)))
      .join('.')
    return "'$" + (jsonPath.startsWith('[') ? '' : '.') + jsonPath + "'"
  }

  /**
   * Wrap the given JSON path segment.
   *
   * @param  {string}  segment
   * @return {string}
   */
  wrapJsonPathSegment (segment) {
    const parts = segment.match(/(\[[^\]]+\])+/)
    if (parts !== null) {
      const key = Str.beforeLast(segment, parts[0])
      if (!isNil(key)) {
        return '"' + key + '"' + parts[0]
      }
      return parts[0]
    }
    return '"' + segment + '"'
  }
}

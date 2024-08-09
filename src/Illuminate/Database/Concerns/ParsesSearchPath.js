/**
 * @classdesc Parse the Postgres "search_path" configuration value into an array.
 *
 * @mixin
 */
// export default class ParsesSearchPath {
const ParsesSearchPath = (superclass) => class extends superclass {
  /**
   * Parse the Postgres "search_path" configuration value into an array.
   *
   * @mixin
   * @param  {string|any[]}  [searchPath]
   * @return {Record<string, any>}
   */
  parseSearchPath (searchPath) {
    if (typeof searchPath === 'string') {
      const matches = searchPath.match(/[^\s,"']+/g)

      searchPath = matches || []
    }

    return (searchPath || []).map(schema => schema.trim().replace(/['"]/g, ''))
  }
}

export default ParsesSearchPath

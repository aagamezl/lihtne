/**
 * @classdesc Parse the Postgres "search_path" configuration value into an array.
 *
 * @class
 * @mixin
 */
export default class ParsesSearchPath {
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

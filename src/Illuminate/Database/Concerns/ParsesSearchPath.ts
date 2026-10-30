export class ParsesSearchPath {
  /**
   * Parse the Postgres "search_path" configuration value into an array.
   *
   * @param  string|array|null  $searchPath
   * @return array
   */
  protected parseSearchPath (searchPath: string | string[] | undefined): string[] {
    if (typeof searchPath === 'string') {
      const matches = searchPath.match(/[^\s,"']+/g)
      return matches?.map((match) => match.trim()) ?? []
    }

    return searchPath?.map((schema) => schema.trim()) ?? []
  }
}

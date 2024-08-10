import { isNumeric } from '@devnetic/utils'

/**
 * @typedef {Object} ViewResult
 * @property {string} name - The name of the view.
 * @property {string|null} schema - The schema of the view (null for databases where schema is not applicable).
 * @property {string} definition - The definition of the view.
 */

export default class Processor {
  /**
   * Process the results of a columns query.
   *
   * @param  {Array<Record<string, any>>}  results
   * @return {Array<Record<string, any>>}
   */
  processColumns (results) {
    return results
  }

  /**
   * Process an  "insert get ID" query.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {string}  sql
   * @param  {Record<string, unknown>}  values
   * @param  {string}  [sequence]
   * @return {Promise<number|string>}
   */
  async processInsertGetId (query, sql, values, sequence) {
    query.getConnection().insert(sql, values)

    // TODO: verify the lastInsertId method, I think need refactoring or proper
    // definition
    const id = query.getConnection().getNdo().lastInsertId(sequence)

    return isNumeric(id) ? Number(id) : id
  }

  /**
   * Process the results of a foreign keys query.
   *
   * @param  {Array<Record<string, any>>}  results
   * @return {Array<Record<string, any>>}
   */
  processForeignKeys (results) {
    return results
  }

  /**
   * Process the results of an indexes query.
   *
     * @param  {Record<string, any>[]}  results
     * @return {Record<string, any>[]}
   */
  processIndexes (results) {
    return results
  }

  /**
   * Process the results of a "select" query.
   *
   * @param  {import('../Builder.js').default}  query
   * @param  {unknown[]}  results
   * @return {unknown[]}
   */
  processSelect (query, results) {
    return results
  }

  /**
 * Process the results of a tables query.
 *
 * @param {Array<Object>} results
 * @returns {Array<Object>}
 */
  processTables (results) {
    return results.map(result => {
      return {
        name: result.name,
        schema: result.schema ?? null, // PostgreSQL and SQL Server
        size: typeof result.size !== 'undefined' ? parseInt(result.size) : null,
        comment: result.comment ?? null, // MySQL and PostgreSQL
        collation: result.collation ?? null, // MySQL only
        engine: result.engine ?? null // MySQL only
      }
    })
  }

  /**
   * Process the results of a types query.
   *
   * @param  {Array<Object>}  results
   * @return {Array<Object>}
   */
  processTypes (results) {
    return results
  }

  /**
   * Process the results of a views query.
   *
   * @param {Array<ViewResult>} results
   * @returns {Array<ViewResult>}
   */
  processViews (results) {
    return results.map(result => {
      return {
        name: result.name,
        schema: result.schema ?? null, // PostgreSQL and SQL Server
        definition: result.definition
      }
    })
  }
}

import { isNumeric } from '@devnetic/utils'

export default class Processor {
  /**
   * Process the results of a column listing query.
   *
   * @param  {Array}  results
   * @return {Array}
   */
  processColumnListing (results) {
    return results
  }

  /**
   * Process an  "insert get ID" query.
   *
   * @param  {import('./../Builder.js').default}  query
   * @param  {string}  sql
   * @param  {Array}  values
   * @param  {string}  [sequence]
   * @return {number}
   */
  processInsertGetId (query, sql, values, sequence) {
    query.getConnection().insert(sql, values)

    const id = query.getConnection().getNdo().lastInsertId(sequence)

    return isNumeric(id) ? Number(id) : id
  }

  /**
   * Process the results of a "select" query.
   *
   * @param  {\Illuminate\Database\Query\Builder}  query
   * @param  {Array}  results
   * @return {Array}
   */
  processSelect (query, results) {
    return results
  }
}

import { isNumeric } from '@devnetic/utils'

import Processor from './Processor.js'

export default class PostgresProcessor extends Processor {
  /**
   * Process the results of a columns query.
   *
   * @param {Array<Object>} results
   * @returns {Array<Object>}
   */
  processColumns (results) {
    return results.map(result => {
      const autoincrement = result.default !== null && result.default.startsWith('nextval(')

      return {
        name: result.name,
        type_name: result.type_name,
        type: result.type,
        collation: result.collation,
        nullable: Boolean(result.nullable),
        default: result.generated ? null : result.default,
        auto_increment: autoincrement,
        comment: result.comment,
        generation: result.generated
          ? {
              type: {
                s: 'stored'
              }[result.generated] ?? null,
              expression: result.default
            }
          : null
      }
    })
  }

  /**
   * Process an "insert get ID" query.
   *
   * @param  {import('./../Builder').default}  query
   * @param  {string}  sql
   * @param  {Record<string, unknown>}  values
   * @param  {string}  [sequence]
   * @return {Promise<number|string>}
   */
  async processInsertGetId (query, sql, values, sequence) {
    const connection = query.getConnection()

    connection.recordsHaveBeenModified()

    const result = await connection.selectFromWriteConnection(sql, values)

    sequence = sequence ?? 'id'

    const id = result[0][sequence]

    return isNumeric(id) ? Number(id) : id
  }
}

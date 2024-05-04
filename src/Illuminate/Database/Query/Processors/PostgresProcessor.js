import { isNumeric } from '@devnetic/utils'

import Processor from './Processor.js'

export default class PostgresProcessor extends Processor {
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

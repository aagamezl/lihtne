import Processor from './Processor.js'

export default class SQLiteProcessor extends Processor {
  /**
   * Process the results of a columns query.
   *
   * @param {Record<string, unknown>[]} results - The results of the columns query.
   * @param {string} sql - The SQL query.
   * @returns {Record<string, unknown>[]} - Processed column results.
   */
  processColumns (results, sql = '') {
    const hasPrimaryKey = results.reduce((acc, result) => acc + Number(result.primary), 0) === 1

    return results.map(result => {
      const type = result.type.toLowerCase()

      const collationMatch = sql.match(new RegExp(`\\b${result.name}\\b[^,(]+(?:\\([^()]+\\)[^,]*)?(?:(?:default|check|as)\\s*(?:\\(.*?\\))?[^,]*)*collate\\s+["'\`]?(\\w+)`, 'i'))
      const collation = collationMatch ? collationMatch[1].toLowerCase() : null

      const isGenerated = [2, 3].includes(result.extra)

      const expressionMatch = isGenerated && sql.match(new RegExp(`\\b${result.name}\\b[^,]+\\s+as\\s+\\(((?:[^()]+|\\((?:[^()]+|\\([^()]*\\))*\\))*)\\)`, 'i'))
      const expression = expressionMatch ? expressionMatch[1] : null

      return {
        name: result.name,
        type_name: type.split('(')[0] || '',
        type,
        collation,
        nullable: Boolean(parseInt(result.nullable, 10)),
        default: result.default,
        auto_increment: hasPrimaryKey && result.primary && type === 'integer',
        comment: null,
        generation: isGenerated
          ? {
              type: (() => {
                switch (Number(result.extra)) {
                  case 3:
                    return 'stored'
                  case 2:
                    return 'virtual'
                  default:
                    return null
                }
              })(),
              expression
            }
          : null
      }
    })
  }

  /**
   * Process the results of a foreign keys query.
   *
   * @param {Record<string, unknown>[]} results - The results of the foreign keys query.
   * @returns {Record<string, unknown>[]} - Processed foreign key results.
   */
  processForeignKeys (results) {
    return results.map(result => ({
      name: null,
      columns: result.columns.split(','),
      foreign_schema: null,
      foreign_table: result.foreign_table,
      foreign_columns: result.foreign_columns.split(','),
      on_update: result.on_update.toLowerCase(),
      on_delete: result.on_delete.toLowerCase()
    }))
  }

  /**
   * Process the results of an indexes query.
   *
   * @param {Record<string, unknown[]} results - The results of the indexes query.
   * @returns {Record<string, unknown[]} - Processed index results.
   */
  processIndexes (results) {
    let primaryCount = 0

    let indexes = results.map(result => {
      const isPrimary = Boolean(result.primary)

      if (isPrimary) {
        primaryCount += 1
      }

      return {
        name: result.name.toLowerCase(),
        columns: result.columns.split(','),
        type: null,
        unique: Boolean(result.unique),
        primary: isPrimary
      }
    })

    if (primaryCount > 1) {
      indexes = indexes.filter(index => index.name !== 'primary')
    }

    return indexes
  }
}

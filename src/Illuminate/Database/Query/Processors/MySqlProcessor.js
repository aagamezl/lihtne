import Processor from './Processor.js'

export default class MySqlProcessor extends Processor {
  /**
   * Process the results of a columns query.
   *
   * @param {Array<Object>} results
   * @returns {Array<Object>}
   */
  processColumns (results) {
    return results.map(result => {
      return {
        name: result.name,
        type_name: result.type_name,
        type: result.type,
        collation: result.collation,
        nullable: result.nullable === 'YES',
        default: result.default,
        auto_increment: result.extra === 'auto_increment',
        comment: result.comment || null,
        generation: result.expression
          ? {
              type: {
                'STORED GENERATED': 'stored',
                'VIRTUAL GENERATED': 'virtual'
              }[result.extra] ?? null,
              expression: result.expression
            }
          : null
      }
    })
  }
}

import MySqlGrammar from './MySqlGrammar.js'

/**
 * MariaDbGrammar class, extends MySqlGrammar.
 */
export default class MariaDbGrammar extends MySqlGrammar {
  /**
   * Compile a "lateral join" clause.
   *
   * @param  {import('../../Query/JoinLateralClause.js').default}  join
   * @param  {string}  expression
   * @return {string}
   * @throws {Error}
   */
  compileJoinLateral (join, expression) {
    throw new Error('RuntimeException: This database engine does not support lateral joins.')
  }

  /**
   * Determine whether to use a legacy group limit clause for MySQL < 8.0.
   *
   * @param {import('../../Query/Builder.js').default} query The query builder
   * @returns {boolean} Whether to use legacy group limit
   * @protected
   */
  useLegacyGroupLimit (query) {
    return false
  }
}

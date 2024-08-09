import { versionCompare } from '../../../Support/helpers.js'
import Grammar from './Grammar.js'

export default class SQLiteGrammar extends Grammar {
  /**
   * Get the commands to be compiled on the alter command.
   *
   * @param {Object} connection
   * @returns {Array}
   */
  getAlterCommands (connection) {
    const alterCommands = ['change', 'primary', 'dropPrimary', 'foreign', 'dropForeign']

    if (versionCompare(connection.getServerVersion(), '3.35', '<')) {
      alterCommands.push('dropColumn')
    }

    return alterCommands
  }
}

import Repository from '../../Config/Repository.js'
import ConnectionFactory from '../../Database/Connectors/ConnectionFactory.js'
import DatabaseManager from '../../Database/DatabaseManager.js'

/**
 *
 * @returns {import('../../Database/Connection.js').default}
 */
const DB = () => {
  const databaseManager = new DatabaseManager(
    new ConnectionFactory(),
    new Repository()
  )

  return databaseManager.connection()
}

export default DB

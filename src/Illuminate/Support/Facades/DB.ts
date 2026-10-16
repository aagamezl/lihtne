import { Repository } from '../../Config/Repository'
import { ConnectionFactory } from '../../Database/Connectors/ConnectionFactory'
import { DatabaseManager } from '../../Database/DatabaseManager'

export const DB = () => {
  // TODO: avoid the databaseManager variable instantiation
  const databaseManager = new DatabaseManager(
    new ConnectionFactory(),
    new Repository()
  )

  return databaseManager.connection()
}

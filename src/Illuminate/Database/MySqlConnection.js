import Connection from './Connection.js'
import MySqlDriver from '../Database/Drivers/MySqlDriver.js'
import { MySqlGrammar as QueryGrammar } from '../Database/Query/Grammars/index.js'
// import MySqlGrammar as SchemaGrammar from './Schema/Grammars/MySqlGrammar.js'

export default class MySqlConnection extends Connection {
  /**
   * Get the default query grammar instance.
   *
   * @return {\Illuminate\Database\Query\Grammars\MySqlGrammar}
   */
  getDefaultQueryGrammar () {
    return this.withTablePrefix(new QueryGrammar())
  }

  /**
   * Get the Doctrine DBAL driver.
   *
   * @return {import('./Drivers/MySqlDriver.js').default}
   */
  getDoctrineDriver () {
    return new MySqlDriver()
  }
}

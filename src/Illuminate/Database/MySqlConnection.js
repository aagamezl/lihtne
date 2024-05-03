import Connection from './Connection.js'
import MySqlDriver from '../Database/PDO/MySqlDriver.js'
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
   * Get the default schema grammar instance.
   *
   * @return {\Illuminate\Database\Schema\Grammars\SQLiteGrammar}
   */
  // getDefaultSchemaGrammar () {
  //   return this.withTablePrefix(new SchemaGrammar())
  // }

  /**
   * Get the Doctrine DBAL driver.
   *\Illuminate\Database\PDO\MySqlDriver
   * @return {import('./PDO/MySqlDriver.js').default}
   */
  getDoctrineDriver () {
    return new MySqlDriver()
  }
}

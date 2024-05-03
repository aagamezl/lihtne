// import { isNil } from '@devnetic/utils'

import Connection from './Connection.js'
// import PostgresBuilder from './Schema/PostgresBuilder.js'
// import PostgresDriver from './../Database/PDO/PostgresDriver.js'
import QueryGrammar from '../Database/Query/Grammars/PostgresGrammar.js'
import PostgresProcessor from './../Database/Query/Processors/PostgresProcessor.js'
import PostgresStatement from './../Database/Statements/PostgresStatement.js'

export default class PostgresConnection extends Connection {
  /**
   * Get the default query grammar instance.
   *
   * @return {import('./Query/Grammars/PostgresGrammar.js').default}
   */
  getDefaultQueryGrammar () {
    const grammar = new QueryGrammar()
    grammar.setConnection(this)

    return this.withTablePrefix(grammar)
  }

  /**
   * Get the default post processor instance.
   *
   * @return {\Illuminate\Database\Query\Processors\PostgresProcessor}
   */
  getDefaultPostProcessor () {
    return new PostgresProcessor()
  }

  /**
   * Get the default schema grammar instance.
   *
   * @return {\Illuminate\Database\Schema\Grammars\PostgresGrammar}
   */
  // getDefaultSchemaGrammar() {
  //   return this.withTablePrefix(new SchemaGrammar())
  // }

  /**
   * Get the Doctrine DBAL driver.
   *
   * @return {\Illuminate\Database\PDO\PostgresDriver}
   */
  // getDoctrineDriver () {
  //   return new PostgresDriver()
  // }

  /**
   *
   *
   * @param {string} dsn
   * @param {string} options
   * @return {import('./Statements/Statement.js').default}
   * @memberof {PostgresConnection}
   */
  getPrepareStatement (dsn, options) {
    return new PostgresStatement(dsn, options)
  }

  /**
   * Get a schema builder instance for the connection.
   *
   * @return {\Illuminate\Database\Schema\PostgresBuilder}
   */
  // getSchemaBuilder () {
  //   if (isNil(this.schemaGrammar)) {
  //     this.useDefaultSchemaGrammar()
  //   }

  //   return new PostgresBuilder(this)
  // }
}

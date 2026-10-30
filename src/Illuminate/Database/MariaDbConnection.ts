import type { Filesystem } from '../Filesystem/Filesystem'

import { Str } from '../Support/Str'
import { MySqlConnection } from './MySqlConnection'
import { MariaDbGrammar as QueryGrammar } from './Query/Grammars/MariaDbGrammar'
import { MariaDbProcessor } from './Query/Processors/MariaDbProcessor'
import { MariaDbGrammar as SchemaGrammar } from './Schema/Grammars/MariaDbGrammar'
import { MariaDbBuilder } from './Schema/MariaDbBuilder'
import { MariaDbSchemaState } from './Schema/MariaDbSchemaState'

export class MariaDbConnection extends MySqlConnection {
  /**
   * {@inheritdoc}
   */
  public override async getDriverTitle (): Promise<string> {
    return 'MariaDB'
  }

  /**
   * Get a schema builder instance for the connection.
   *
   * @return \Illuminate\Database\Schema\MariaDbBuilder
   */
  public override getSchemaBuilder (): MariaDbBuilder {
    if (this.schemaGrammar === undefined) {
      this.useDefaultSchemaGrammar()
    }

    return new MariaDbBuilder(this)
  }

  /**
   * Get the schema state for the connection.
   *
   * @param  \Illuminate\Filesystem\Filesystem|null  $files
   * @param  callable|null  $processFactory
   * @return \Illuminate\Database\Schema\MariaDbSchemaState
   */
  public override getSchemaState (
    files?: Filesystem,
    processFactory?: (...args: unknown[]) => unknown
  ): MariaDbSchemaState {
    return new MariaDbSchemaState(this, files, processFactory)
  }

  /**
   * Get the server version for the connection.
   *
   * @return string
   */
  public override async getServerVersion (): Promise<string> {
    return Str.between(await super.getServerVersion(), '5.5.5-', '-MariaDB')
  }

  /**
   * Determine if the connected database is a MariaDB database.
   *
   * @return bool
   */
  public override async isMaria (): Promise<boolean> {
    return true
  }

  /**
   * Get the default post processor instance.
   *
   * @return \Illuminate\Database\Query\Processors\MariaDbProcessor
   */
  protected override getDefaultPostProcessor (): MariaDbProcessor {
    return new MariaDbProcessor()
  }

  /**
   * Get the default query grammar instance.
   *
   * @return \Illuminate\Database\Query\Grammars\MariaDbGrammar
   */
  protected override getDefaultQueryGrammar (): QueryGrammar {
    return new QueryGrammar(this)
  }

  /**
   * Get the default schema grammar instance.
   *
   * @return \Illuminate\Database\Schema\Grammars\MariaDbGrammar
   */
  protected override getDefaultSchemaGrammar (): SchemaGrammar {
    return new SchemaGrammar(this)
  }
}

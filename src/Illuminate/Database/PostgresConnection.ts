import { Connection } from './Connection'

export class PostgresConnection extends Connection {
  /**
   * {@inheritdoc}
   */
  public getDriverTitle (): string {
    return 'PostgreSQL'
  }
}

/**
 * One entry under `database.connections` in `lihtne-config.json`.
 */
export interface DatabaseConnectionConfig {
  driver: string
  host?: string
  database: string
  username: string
  password: string
  url?: string
  port?: number | string
}

/**
 * A connection config before URL parsing. Every field is optional because
 * the URL can supply the missing values, and query options add extra keys.
 */
export type DatabaseConfig = Partial<DatabaseConnectionConfig> &
  Record<string, unknown>

/**
 * Shape of `lihtne-config.json`.
 */
export type LihtneConfig = {
  database: {
    default: string
    connections: Record<string, DatabaseConnectionConfig>
  }
}

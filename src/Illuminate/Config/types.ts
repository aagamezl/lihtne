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
  connect_via_database?: string
  connect_via_port?: number | string
  schema?: string | string[]
  search_path?: string | string[]
  isolation_level?: string
  timezone?: string
  server_options?: Record<string, string>
  options?: Record<string, unknown>
  synchronous_commit?: string
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

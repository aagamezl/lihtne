/**
 * One entry under `database.connections` in `lihtne-config.json`.
 */
export interface DatabaseConfig {
  driver: string
  host?: string
  database: string
  username: string
  password: string
  prefix?: string
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
 * A connection config. Every field is optional, so `{}` is a valid default.
 */
// export type DatabaseConfig = Partial<DatabaseConnectionConfig>
// export type DatabaseConfig = DatabaseConnectionConfig

/**
 * Shape of `lihtne-config.json`.
 */
export type LihtneConfig = {
  database: {
    default: string
    connections: Record<string, DatabaseConfig>
  }
}

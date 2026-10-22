// Opens Postgres through ConnectionFactory, not DB(), so these options are not
// the ones in lihtne.config.ts. Each call is its own connection. The SELECT
// reads the session back, which only matches the config when the SET and the
// URL options applied to that same client.
//
// 1. String search_path, isolation, timezone, synchronous_commit, charset,
//    application_name, sslmode, keepalive, server_options, and connect_via_*.
// 2. schema is used when search_path is absent. Same SET, other input.
// 3. search_path as a list, and port is omitted so the URL has no :5432.
//
// process.exit() runs because the shared client would otherwise keep Node alive.
import type { DatabaseConfig } from '../../../src/Illuminate/Config/types'

import { ConnectionFactory } from '../../../src/Illuminate/Database/Connectors/ConnectionFactory'

const factory = new ConnectionFactory()

const base = {
  driver: 'pgsql',
  host: '127.0.0.1',
  port: 5432,
  database: 'lihtne',
  username: 'lihtne',
  password: 'lihtne'
} satisfies DatabaseConfig

const sessionSql = `
  select
    current_setting('transaction_isolation') as isolation,
    current_setting('TimeZone') as timezone,
    current_setting('search_path') as search_path,
    current_setting('synchronous_commit') as synchronous_commit,
    current_setting('client_encoding') as client_encoding,
    current_setting('application_name') as application_name,
    current_setting('statement_timeout') as statement_timeout
`

const show = async (label: string, config: DatabaseConfig) => {
  const connection = factory.make({ ...base, ...config }, label)
  const rows = await connection.select<Record<string, string>>(sessionSql, [])

  console.log(label, rows[0])
}

try {
  await show('string search_path and dsn options', {
    ...base,
    isolation_level: 'read committed',
    timezone: 'UTC',
    search_path: 'public',
    synchronous_commit: 'on',
    charset: 'UTF8',
    application_name: 'lihtne example',
    sslmode: 'disable',
    keepalives: 1,
    keepalives_idle: 60,
    keepalives_interval: 10,
    keepalives_count: 5,
    server_options: { statement_timeout: '0' },
    connect_via_database: 'lihtne',
    connect_via_port: 5432
  } as DatabaseConfig)

  await show('schema instead of search_path', {
    ...base,
    schema: 'public'
  })

  await show('search_path list and default port', {
    ...base,
    port: undefined,
    search_path: ['public', 'pg_catalog']
  })
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  process.exit()
}

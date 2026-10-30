// Opens MySQL through ConnectionFactory, not DB(), so these options are not the
// ones in lihtne.config.ts. Each call is its own connection. The SELECT reads
// the session back, which only matches the config when the SET ran on that
// same client.
//
// 1. strict true, charset plus collation, isolation, and timezone.
//    sql_mode is the MySQL 8 list.
// 2. strict false and charset without a collation.
//    sql_mode is NO_ENGINE_SUBSTITUTION and the collation stays the server default.
// 3. modes replaces strict, and port is omitted so the URL has no :3306.
//
// process.exit() runs because the shared client would otherwise keep Node alive.
import type { DatabaseConfig } from '../../../src/Illuminate/Config/types'

import { ConnectionFactory } from '../../../src/Illuminate/Database/Connectors/ConnectionFactory'

const factory = new ConnectionFactory()

const base = {
  driver: 'mysql',
  host: '127.0.0.1',
  port: 3306,
  database: 'lihtne',
  username: 'lihtne',
  password: 'lihtne'
} satisfies DatabaseConfig

const sessionSql = `
  select
    @@session.transaction_isolation as isolation,
    @@session.time_zone as timezone,
    @@session.character_set_client as charset,
    @@session.collation_connection as collation,
    @@session.sql_mode as sql_mode
`

const show = async (label: string, config: DatabaseConfig) => {
  const connection = factory.make({ ...base, ...config }, label)
  const rows = await connection.select<Record<string, string>>(sessionSql, [])

  console.log(label, rows[0])
}

try {
  await show('strict, charset and collation', {
    ...base,
    isolation_level: 'READ COMMITTED',
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci',
    timezone: '+00:00',
    strict: true
  })

  await show('strict off and charset only', {
    ...base,
    charset: 'utf8mb4',
    strict: false
  })

  await show('explicit modes and default port', {
    ...base,
    port: undefined,
    modes: ['ANSI']
  })
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  process.exit()
}

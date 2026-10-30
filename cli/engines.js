import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

export const root = path.resolve(here, '..')
export const envFile = path.join(root, 'docker', '.env')
export const composeFile = path.join(root, 'docker', 'docker-compose.yml')
export const sqliteFile = path.join(
  root,
  'storage',
  'databases',
  'database.sqlite'
)

export const DEV_DB = 'lihtne'
export const DEV_USER = 'lihtne'
export const DEV_PASSWORD = 'lihtne'
export const SQLSRV_PASSWORD = 'Lihtne_dev_1'

export const NETWORKED = ['mysql', 'mariadb', 'pgsql', 'sqlsrv']
export const ALL_ENGINES = [...NETWORKED, 'sqlite']

export const ARM_INCOMPATIBLE = [
  {
    engine: 'sqlsrv',
    reason: 'The SQL Server container image is built for x86-64 CPUs.'
  }
]

const ALIASES = {
  mysql: 'mysql',
  mariadb: 'mariadb',
  pgsql: 'pgsql',
  postgres: 'pgsql',
  postgresql: 'pgsql',
  sqlsrv: 'sqlsrv',
  sqlserver: 'sqlsrv',
  mssql: 'sqlsrv',
  sqlite: 'sqlite',
  all: 'all'
}

export function armIncompatible (engine) {
  return ARM_INCOMPATIBLE.find((item) => item.engine === engine) ?? null
}

export function canonicalEngine (name) {
  return ALIASES[String(name).toLowerCase()] ?? null
}

export function engineTitle (engine) {
  switch (engine) {
    case 'mysql':
      return 'MySQL'
    case 'mariadb':
      return 'MariaDB'
    case 'pgsql':
      return 'Postgres'
    case 'sqlsrv':
      return 'SQL Server'
    case 'sqlite':
      return 'SQLite'
    default:
      return engine
  }
}

export function enginePort (engine) {
  switch (engine) {
    case 'mysql':
      return '3306'
    case 'mariadb':
      return '3307'
    case 'pgsql':
      return '5432'
    case 'sqlsrv':
      return '1433'
    default:
      return ''
  }
}

export function engineInternalPort (engine) {
  switch (engine) {
    case 'mysql':
    case 'mariadb':
      return '3306'
    case 'pgsql':
      return '5432'
    case 'sqlsrv':
      return '1433'
    default:
      return ''
  }
}

export function engineUser (engine) {
  if (engine === 'sqlsrv') {
    return 'sa'
  }
  if (engine === 'sqlite') {
    return '—'
  }
  return DEV_USER
}

export function enginePassword (engine) {
  if (engine === 'sqlsrv') {
    return SQLSRV_PASSWORD
  }
  if (engine === 'sqlite') {
    return '—'
  }
  return DEV_PASSWORD
}

export function pinKey (engine) {
  switch (engine) {
    case 'mysql':
      return 'MYSQL_VERSION'
    case 'mariadb':
      return 'MARIADB_VERSION'
    case 'pgsql':
      return 'POSTGRES_VERSION'
    case 'sqlsrv':
      return 'SQLSRV_VERSION'
    default:
      return ''
  }
}

export function imageTemplate (engine) {
  switch (engine) {
    case 'mysql':
      return 'mysql:${MYSQL_VERSION}'
    case 'mariadb':
      return 'mariadb:${MARIADB_VERSION}'
    case 'pgsql':
      return 'postgres:${POSTGRES_VERSION}'
    case 'sqlsrv':
      return 'mcr.microsoft.com/mssql/server:${SQLSRV_VERSION}'
    default:
      return ''
  }
}

export function hubRepo (engine) {
  if (engine === 'pgsql') {
    return 'postgres'
  }
  return engine
}

export function dataPath (engine) {
  switch (engine) {
    case 'mysql':
    case 'mariadb':
      return '/var/lib/mysql'
    case 'pgsql':
      return '/var/lib/postgresql'
    case 'sqlsrv':
      return '/var/opt/mssql'
    default:
      return ''
  }
}

export function containerName (engine) {
  return `lihtne-${engine}`
}

export function volumeName (engine) {
  return `lihtne_${engine}-data`
}

export function emptyPins () {
  return {
    mysql: '',
    mariadb: '',
    pgsql: '',
    sqlsrv: ''
  }
}

export function loadPins () {
  const pins = emptyPins()
  if (!fs.existsSync(envFile)) {
    return pins
  }

  const lines = fs.readFileSync(envFile, 'utf8').split('\n')
  for (const line of lines) {
    if (line.startsWith('MYSQL_VERSION=')) {
      pins.mysql = line.slice('MYSQL_VERSION='.length)
    } else if (line.startsWith('MARIADB_VERSION=')) {
      pins.mariadb = line.slice('MARIADB_VERSION='.length)
    } else if (line.startsWith('POSTGRES_VERSION=')) {
      pins.pgsql = line.slice('POSTGRES_VERSION='.length)
    } else if (line.startsWith('SQLSRV_VERSION=')) {
      pins.sqlsrv = line.slice('SQLSRV_VERSION='.length)
    }
  }
  return pins
}

export function anyPins (pins) {
  return NETWORKED.some((engine) => pins[engine])
}

export function sqliteInstalled () {
  return fs.existsSync(sqliteFile)
}

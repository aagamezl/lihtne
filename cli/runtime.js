import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import {
  anyPins,
  composeFile,
  containerName,
  dataPath,
  DEV_DB,
  DEV_PASSWORD,
  DEV_USER,
  engineInternalPort,
  enginePort,
  envFile,
  imageTemplate,
  NETWORKED,
  pinKey,
  root,
  sqliteFile,
  SQLSRV_PASSWORD,
  volumeName
} from './engines.js'
import { boxLines, boxRow } from './ui.js'

let composeText = 'docker compose'

export function composeCommand () {
  return composeText
}

function removeDirIfEmpty (dir) {
  try {
    fs.rmdirSync(dir)
  } catch {
    // The directory is already gone or still holds other files.
  }
}

function commandExists (name) {
  return new Promise((resolve) => {
    execFile('which', [name], (error) => {
      resolve(!error)
    })
  })
}

function run (command, args) {
  return new Promise((resolve) => {
    execFile(
      command,
      args,
      {
        encoding: 'utf8',
        maxBuffer: 20 * 1024 * 1024
      },
      (error, stdout, stderr) => {
        const output = `${stdout || ''}${stderr || ''}`.replace(/\r/g, '\n')
        resolve({
          ok: !error,
          output,
          code: error ? (error.code ?? 1) : 0
        })
      }
    )
  })
}

export async function runLabeled (label, command, args) {
  boxRow('cyan', `› ${label}`)
  const result = await run(command, args)
  boxLines('dim', result.output.trimEnd())
  return result.ok
}

export async function detectCompose () {
  const plugin = await run('docker', ['compose', 'version'])
  if (plugin.ok) {
    composeText = 'docker compose'
    return true
  }
  if (await commandExists('docker-compose')) {
    const standalone = await run('docker-compose', ['version'])
    if (standalone.ok) {
      composeText = 'docker-compose'
      return true
    }
  }
  return false
}

export async function dockerDaemonUp () {
  const result = await run('docker', ['info'])
  return result.ok
}

export async function containerExists (engine) {
  const result = await run('docker', ['inspect', containerName(engine)])
  return result.ok
}

let dockerReady = ''

async function dockerAvailability () {
  if (dockerReady) {
    return dockerReady
  }
  if (!(await commandExists('docker'))) {
    dockerReady = 'missing'
    return dockerReady
  }
  dockerReady = (await dockerDaemonUp()) ? 'yes' : 'down'
  return dockerReady
}

export async function containerState (engine) {
  const availability = await dockerAvailability()
  if (availability === 'missing') {
    return 'docker is not installed'
  }
  if (availability === 'down') {
    return 'Docker is not running'
  }
  const name = containerName(engine)
  const status = await run('docker', [
    'inspect',
    '-f',
    '{{.State.Status}}',
    name
  ])
  if (!status.ok) {
    return 'absent'
  }
  const health = await run('docker', [
    'inspect',
    '-f',
    '{{if .State.Health}}{{.State.Health.Status}}{{end}}',
    name
  ])
  const statusText = status.output.trim()
  const healthText = health.ok ? health.output.trim() : ''
  return healthText ? `${statusText} (${healthText})` : statusText
}

function healthTest (engine) {
  switch (engine) {
    case 'mysql':
      return '["CMD", "mysqladmin", "ping", "-h", "127.0.0.1", "-uroot", "-plihtne"]'
    case 'mariadb':
      return '["CMD", "healthcheck.sh", "--connect", "--innodb_initialized"]'
    case 'pgsql':
      return '["CMD-SHELL", "pg_isready -U lihtne -d lihtne"]'
    case 'sqlsrv':
      return '["CMD-SHELL", "/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P Lihtne_dev_1 -C -Q \'SELECT 1\' >/dev/null 2>&1 || /opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P Lihtne_dev_1 -Q \'SELECT 1\' >/dev/null 2>&1"]'
    default:
      return '["NONE"]'
  }
}

function serviceEnvironment (engine) {
  switch (engine) {
    case 'mysql':
      return [
        `      MYSQL_ROOT_PASSWORD: ${DEV_PASSWORD}`,
        `      MYSQL_DATABASE: ${DEV_DB}`,
        `      MYSQL_USER: ${DEV_USER}`,
        `      MYSQL_PASSWORD: ${DEV_PASSWORD}`
      ]
    case 'mariadb':
      return [
        `      MARIADB_ROOT_PASSWORD: ${DEV_PASSWORD}`,
        `      MARIADB_DATABASE: ${DEV_DB}`,
        `      MARIADB_USER: ${DEV_USER}`,
        `      MARIADB_PASSWORD: ${DEV_PASSWORD}`
      ]
    case 'pgsql':
      return [
        `      POSTGRES_USER: ${DEV_USER}`,
        `      POSTGRES_PASSWORD: ${DEV_PASSWORD}`,
        `      POSTGRES_DB: ${DEV_DB}`
      ]
    case 'sqlsrv':
      return [
        '      ACCEPT_EULA: "Y"',
        `      MSSQL_SA_PASSWORD: "${SQLSRV_PASSWORD}"`,
        '      MSSQL_PID: Developer'
      ]
    default:
      return []
  }
}

function serviceYaml (engine) {
  const start = engine === 'sqlsrv' ? '40s' : '20s'
  const lines = [
    `  ${engine}:`,
    `    image: ${imageTemplate(engine)}`,
    `    container_name: ${containerName(engine)}`,
    `    profiles: ["${engine}"]`,
    '    restart: unless-stopped',
    '    ports:',
    `      - "${enginePort(engine)}:${engineInternalPort(engine)}"`,
    '    environment:',
    ...serviceEnvironment(engine),
    '    volumes:'
  ]
  if (engine === 'pgsql') {
    lines.push('      # Postgres 18 and newer keep data under this directory.')
  }
  lines.push(
    `      - ${engine}-data:${dataPath(engine)}`,
    '    healthcheck:',
    `      test: ${healthTest(engine)}`,
    '      interval: 10s',
    '      timeout: 5s',
    '      retries: 18',
    `      start_period: ${start}`
  )
  return lines.join('\n')
}

function writeEnv (pins) {
  const lines = []
  for (const engine of NETWORKED) {
    if (pins[engine]) {
      lines.push(`${pinKey(engine)}=${pins[engine]}`)
    }
  }
  fs.mkdirSync(path.dirname(envFile), { recursive: true })
  fs.writeFileSync(envFile, `${lines.join('\n')}\n`)
}

function writeCompose (pins) {
  const services = []
  const volumes = []
  for (const engine of NETWORKED) {
    if (!pins[engine]) {
      continue
    }
    services.push(serviceYaml(engine))
    volumes.push(`  ${engine}-data:`)
  }
  const body = [
    '# Generated by bin/lihtne. Do not edit.',
    'name: lihtne',
    'services:',
    ...services,
    'volumes:',
    ...volumes,
    ''
  ].join('\n')
  fs.mkdirSync(path.dirname(composeFile), { recursive: true })
  fs.writeFileSync(composeFile, body)
}

export function persistGeneratedFiles (pins, dryRun) {
  if (dryRun) {
    if (anyPins(pins)) {
      boxRow('yellow', '› dry run  write docker/.env')
      boxRow('yellow', '› dry run  write docker/docker-compose.yml')
    } else {
      boxRow('yellow', '› dry run  delete docker/.env')
      boxRow('yellow', '› dry run  delete docker/docker-compose.yml')
    }
    return
  }

  if (anyPins(pins)) {
    writeEnv(pins)
    writeCompose(pins)
    boxRow('green', '✓ Wrote docker/.env')
    boxRow('green', '✓ Wrote docker/docker-compose.yml')
    return
  }

  fs.rmSync(envFile, { force: true })
  fs.rmSync(composeFile, { force: true })
  removeDirIfEmpty(path.dirname(composeFile))
  boxRow('green', '✓ Removed generated Docker files')
}

function composeInvocation (extra) {
  const base = [
    '--project-name',
    'lihtne',
    '--project-directory',
    path.join(root, 'docker'),
    '--env-file',
    envFile,
    '-f',
    composeFile
  ]
  if (composeText === 'docker-compose') {
    return { command: 'docker-compose', args: [...base, ...extra] }
  }
  return { command: 'docker', args: ['compose', ...base, ...extra] }
}

export async function startContainers (engines, dryRun) {
  const services = engines.filter((engine) => engine !== 'sqlite')
  if (services.length === 0) {
    return true
  }
  const profiles = services.flatMap((engine) => ['--profile', engine])
  const extra = [...profiles, 'up', '-d', '--wait', ...services]
  const label = [
    composeText,
    '-f docker/docker-compose.yml',
    '--env-file docker/.env',
    ...profiles,
    'up -d --wait',
    ...services
  ].join(' ')
  if (dryRun) {
    boxRow('yellow', `› dry run  ${label}`)
    return true
  }
  const invocation = composeInvocation(extra)
  return runLabeled(label, invocation.command, invocation.args)
}

export async function ensureSqlsrvDatabase (selected, dryRun) {
  if (!selected.includes('sqlsrv')) {
    return true
  }
  if (dryRun) {
    boxRow('yellow', '› dry run  create database lihtne on sqlsrv')
    return true
  }
  const query = "IF DB_ID(N'lihtne') IS NULL CREATE DATABASE lihtne"
  const script =
    'if [ -x /opt/mssql-tools18/bin/sqlcmd ]; then /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "$1" -C -b -Q "$2"; else /opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P "$1" -b -Q "$2"; fi'
  return runLabeled('create database lihtne', 'docker', [
    'exec',
    containerName('sqlsrv'),
    'sh',
    '-c',
    script,
    'sh',
    SQLSRV_PASSWORD,
    query
  ])
}

export async function removeContainer (engine, dryRun) {
  const container = containerName(engine)
  const volume = volumeName(engine)
  if (dryRun) {
    boxRow('yellow', `› dry run  docker rm -f ${container}`)
    boxRow('yellow', `› dry run  docker volume rm ${volume}`)
    return true
  }
  if (await containerExists(engine)) {
    const removed = await runLabeled(`docker rm -f ${container}`, 'docker', [
      'rm',
      '-f',
      container
    ])
    if (!removed) {
      return false
    }
  } else {
    boxRow('dim', `· ${container} is absent`)
  }
  const volumeCheck = await run('docker', ['volume', 'inspect', volume])
  if (!volumeCheck.ok) {
    return true
  }
  return runLabeled(`docker volume rm ${volume}`, 'docker', [
    'volume',
    'rm',
    volume
  ])
}

export async function downProject (dryRun) {
  const label = `${composeText} -f docker/docker-compose.yml down --volumes --remove-orphans`
  if (dryRun) {
    boxRow('yellow', `› dry run  ${label}`)
    return true
  }
  if (!fs.existsSync(composeFile)) {
    return true
  }
  const invocation = composeInvocation([
    'down',
    '--volumes',
    '--remove-orphans'
  ])
  return runLabeled(label, invocation.command, invocation.args)
}

export async function installSqlite (dryRun) {
  const relative = 'storage/databases/database.sqlite'
  if (fs.existsSync(sqliteFile)) {
    boxRow('green', '✓ SQLite file already exists')
    boxRow('', `  ${relative}`)
    return
  }
  if (dryRun) {
    boxRow('yellow', `› dry run  create ${relative}`)
    return
  }
  fs.mkdirSync(path.dirname(sqliteFile), { recursive: true })
  const created = await run('sqlite3', [sqliteFile, 'PRAGMA user_version = 0;'])
  if (!created.ok) {
    throw new Error(created.output.trim() || 'sqlite3 failed')
  }
  boxRow('green', `✓ Created ${relative}`)
}

export function uninstallSqlite (dryRun) {
  const relative = 'storage/databases/database.sqlite'
  if (!fs.existsSync(sqliteFile)) {
    boxRow('yellow', '· SQLite is not installed')
    return false
  }
  if (dryRun) {
    boxRow('yellow', `› dry run  delete ${relative}`)
    return true
  }
  fs.rmSync(sqliteFile, { force: true })
  removeDirIfEmpty(path.dirname(sqliteFile))
  boxRow('green', `✓ Deleted ${relative}`)
  return true
}

export async function requireTool (name) {
  if (!(await commandExists(name))) {
    boxRow('red', `✗ ${name} is not installed.`)
    return false
  }
  boxRow('green', `✓ ${name}`)
  return true
}

export async function requireDocker (dryRun) {
  let ok = true
  if (!(await commandExists('docker'))) {
    boxRow('red', '✗ docker is not installed.')
    return false
  }
  boxRow('green', '✓ docker')
  if (!(await detectCompose())) {
    boxRow('red', '✗ docker compose is not available.')
    ok = false
  } else {
    boxRow('green', `✓ ${composeText}`)
  }
  if (!dryRun) {
    if (!(await dockerDaemonUp())) {
      boxRow('red', '✗ Docker is not running.')
      ok = false
    } else {
      boxRow('green', '✓ Docker daemon is running')
    }
  }
  return ok
}

export async function armHost () {
  if (process.platform === 'darwin') {
    if (process.arch === 'arm64') {
      return 'Apple Silicon'
    }
    const result = await run('sysctl', ['-n', 'hw.optional.arm64'])
    if (result.ok && result.output.trim() === '1') {
      return 'Apple Silicon'
    }
    return ''
  }
  if (process.arch === 'arm64' || process.arch === 'arm') {
    return 'ARM'
  }
  return ''
}

import fs from 'node:fs'

import {
  ALL_ENGINES,
  ARM_INCOMPATIBLE,
  armIncompatible,
  composeFile,
  DEV_DB,
  enginePassword,
  enginePort,
  engineTitle,
  engineUser,
  loadPins,
  NETWORKED,
  sqliteFile,
  sqliteInstalled
} from './engines.js'
import { resolveHubEngine, resolveSqlsrv } from './registry.js'
import {
  containerExists,
  containerState,
  dockerDaemonUp,
  downProject,
  ensureSqlsrvDatabase,
  installSqlite,
  persistGeneratedFiles,
  removeContainer,
  requireDocker,
  requireTool,
  armHost,
  startContainers,
  uninstallSqlite
} from './runtime.js'
import {
  banner,
  boxRow,
  chooseWidth,
  fieldRow,
  finish,
  sectionClose,
  sectionOpen
} from './ui.js'

const DB_SUBTITLE = 'Install, uninstall, and list development databases.'

function joinWords (words) {
  return words.join(', ')
}

export function showRoot () {
  chooseWidth(['lihtne <group> [command]', 'lihtne db --help'])
  banner('Development tasks for this repository.')
  sectionOpen('Usage', 'yellow')
  boxRow('bold', 'lihtne <group> [command]')
  boxRow('', '')
  boxRow('', 'Groups')
  boxRow('', '  db    Development databases')
  boxRow('', '')
  boxRow('dim', 'lihtne db --help')
  sectionClose()
}

export function showDb () {
  chooseWidth([
    'lihtne db install [engine|all] [--version TAG] [--dry-run]',
    'lihtne db uninstall [engine|all] [--dry-run]',
    'lihtne db list'
  ])
  banner(DB_SUBTITLE)
  sectionOpen('Usage', 'yellow')
  boxRow('bold', 'lihtne db install [engine|all] [--version TAG] [--dry-run]')
  boxRow('bold', 'lihtne db uninstall [engine|all] [--dry-run]')
  boxRow('bold', 'lihtne db list')
  boxRow('', '')
  boxRow('', 'Engines')
  boxRow('', '  mysql     port 3306')
  boxRow('', '  mariadb   port 3307')
  boxRow('', '  pgsql     port 5432. Aliases: postgres, postgresql')
  boxRow('', '  sqlsrv    port 1433. Aliases: sqlserver, mssql')
  boxRow('', '  sqlite    local file. No container and no --version')
  boxRow('', '  all       every engine above')
  boxRow('', '')
  boxRow('dim', 'Omit --version to pin the newest stable tag.')
  boxRow('dim', 'The latest tag is never used.')
  boxRow('dim', armHelpLine())
  boxRow('dim', '--dry-run resolves versions and prints actions.')
  sectionClose()
}

function failDb (message) {
  showDb()
  finish(1, 'red', 'Result', [message])
}

function openInstallBanner (selected) {
  chooseWidth([
    'lihtne db install [engine|all] [--version TAG] [--dry-run]',
    `Engines      ${joinWords(selected)}`
  ])
  banner(DB_SUBTITLE)
}

function showParameters (command, selected, engine, version, dryRun) {
  sectionOpen('1 · Parameters', 'blue')
  fieldRow('', 'Command', command)
  fieldRow('', 'Engines', joinWords(selected))
  if (command === 'db install') {
    let versionLabel = 'newest stable tag'
    if (version) {
      versionLabel = version
    } else if (engine === 'sqlite') {
      versionLabel = 'local file'
    }
    fieldRow('', 'Version', versionLabel)
  }
  fieldRow(dryRun ? 'yellow' : '', 'Dry run', dryRun ? 'yes' : 'no')
  sectionClose()
}

function armHelpLine () {
  const names = ARM_INCOMPATIBLE.map((item) => engineTitle(item.engine))
  return `${names.join(', ')} can't be installed on ARM or Apple Silicon.`
}

function armRefusalLines (host, denied) {
  const lines = []
  for (const [index, engine] of denied.entries()) {
    if (index > 0) {
      lines.push('')
    }
    const title = engineTitle(engine)
    lines.push(`✗ ${title} installation stopped.`)
    lines.push(`  This host is ${host}.`)
    lines.push(`  ${armIncompatible(engine).reason}`)
    lines.push(`  ${title} can't be installed on ARM and Apple Silicon.`)
  }
  return lines
}

function recordInstall (lines, engine, version) {
  if (engine === 'sqlite') {
    lines.push('✓ Installed SQLite.')
    lines.push(`  File      ${sqliteFile}`)
    return
  }
  lines.push(`✓ Installed ${engineTitle(engine)} ${version}.`)
  lines.push('  Host      127.0.0.1')
  lines.push(`  Port      ${enginePort(engine)}`)
  lines.push(`  Database  ${DEV_DB}`)
  lines.push(`  User      ${engineUser(engine)}`)
  lines.push(`  Password  ${enginePassword(engine)}`)
}

function coversAllPins (pins, selected) {
  return NETWORKED.every((engine) => !pins[engine] || selected.includes(engine))
}

async function selectedNetworkInstalled (pins, selected) {
  for (const engine of selected) {
    if (engine === 'sqlite') {
      continue
    }
    if (pins[engine]) {
      return true
    }
    if ((await dockerDaemonUp()) && (await containerExists(engine))) {
      return true
    }
  }
  return false
}

export async function install (engine, selected, version, dryRun) {
  let engines = selected
  openInstallBanner(engines)
  showParameters('db install', engines, engine, version, dryRun)

  const denied = []
  let host = ''
  if (engines.some((item) => armIncompatible(item))) {
    host = await armHost()
    if (host) {
      denied.push(...engines.filter((item) => armIncompatible(item)))
      engines = engines.filter((item) => !armIncompatible(item))
      if (engines.length === 0) {
        finish(1, 'red', 'Result', armRefusalLines(host, denied))
      }
    }
  }

  sectionOpen('2 · Preflight', 'blue')
  if (host && denied.length > 0) {
    for (const line of armRefusalLines(host, denied)) {
      boxRow('red', line)
    }
    boxRow('yellow', '· The other selected engines will still be installed.')
  }
  let ok = true
  const networked = engines.some((item) => item !== 'sqlite')
  if (networked) {
    ok = (await requireDocker(dryRun)) && ok
  }
  if (engines.includes('sqlite')) {
    ok = (await requireTool('sqlite3')) && ok
  }
  if (!ok) {
    finish(1, 'red', 'Result', [
      '✗ Install the missing tools and run this command again.'
    ])
  }
  if (!networked && !engines.includes('sqlite')) {
    boxRow('green', '✓ Nothing to check')
  }
  sectionClose()

  const pins = loadPins()
  const resolved = { mysql: '', mariadb: '', pgsql: '', sqlsrv: '' }

  sectionOpen('3 · Versions', 'cyan')
  for (const item of engines) {
    if (item === 'sqlite') {
      fieldRow('', 'sqlite', 'local file')
      continue
    }
    if (item === 'sqlsrv') {
      await resolveSqlsrv(version, resolved)
    } else {
      await resolveHubEngine(item, version, resolved)
    }
  }
  sectionClose()

  sectionOpen('4 · Install', 'cyan')
  if (networked) {
    for (const item of engines) {
      if (item !== 'sqlite') {
        pins[item] = resolved[item]
      }
    }
    persistGeneratedFiles(pins, dryRun)
    if (!(await startContainers(engines, dryRun))) {
      finish(3, 'red', 'Result', [
        '✗ Docker did not start the selected engines.'
      ])
    }
    if (!(await ensureSqlsrvDatabase(engines, dryRun))) {
      finish(3, 'red', 'Result', [
        '✗ SQL Server is up, and creating the lihtne database failed.'
      ])
    }
  }
  if (engines.includes('sqlite')) {
    try {
      await installSqlite(dryRun)
    } catch (error) {
      finish(3, 'red', 'Result', [`✗ ${error.message}`])
    }
  }
  sectionClose()

  if (dryRun) {
    finish(0, 'yellow', '5 · Result', [
      '✓ Dry run complete. Nothing was changed.'
    ])
  }

  const lines = []
  engines.forEach((item, index) => {
    if (index > 0) {
      lines.push('')
    }
    recordInstall(lines, item, item === 'sqlite' ? 'file' : resolved[item])
  })
  finish(0, 'green', '5 · Result', lines)
}

export async function uninstall (selected, dryRun) {
  chooseWidth([
    'lihtne db uninstall [engine|all] [--dry-run]',
    `Engines      ${joinWords(selected)}`
  ])
  banner(DB_SUBTITLE)
  showParameters('db uninstall', selected, '', '', dryRun)

  const pins = loadPins()
  const networked = selected.some((item) => item !== 'sqlite')
  const installed =
    networked && (await selectedNetworkInstalled(pins, selected))

  sectionOpen('2 · Preflight', 'blue')
  if (installed) {
    if (!(await requireDocker(dryRun))) {
      finish(1, 'red', 'Result', [
        '✗ Install the missing tools and run this command again.'
      ])
    }
  } else if (networked) {
    boxRow('green', '✓ No networked engines from this selection are installed')
  } else {
    boxRow('green', '✓ No extra tools required')
  }
  sectionClose()

  let removed = false
  sectionOpen('3 · Uninstall', 'cyan')
  if (installed) {
    removed = true
    if (coversAllPins(pins, selected) && fs.existsSync(composeFile)) {
      if (!(await downProject(dryRun))) {
        finish(3, 'red', 'Result', ['✗ Docker did not remove the engines.'])
      }
      for (const engine of selected) {
        if (engine !== 'sqlite') {
          pins[engine] = ''
        }
      }
    } else {
      for (const engine of selected) {
        if (engine === 'sqlite') {
          continue
        }
        const present =
          pins[engine] ||
          ((await dockerDaemonUp()) && (await containerExists(engine)))
        if (!present) {
          boxRow('yellow', `· ${engineTitle(engine)} is not installed`)
          continue
        }
        if (!(await removeContainer(engine, dryRun))) {
          finish(3, 'red', 'Result', [`✗ Docker did not remove ${engine}.`])
        }
        pins[engine] = ''
      }
    }
    persistGeneratedFiles(pins, dryRun)
  } else if (networked) {
    for (const engine of selected) {
      if (engine !== 'sqlite') {
        boxRow('yellow', `· ${engineTitle(engine)} is not installed`)
      }
    }
  }
  if (selected.includes('sqlite')) {
    if (sqliteInstalled()) {
      removed = true
    }
    if (uninstallSqlite(dryRun)) {
      removed = true
    }
  }
  sectionClose()

  if (dryRun) {
    finish(0, 'yellow', '4 · Result', [
      '✓ Dry run complete. Nothing was changed.'
    ])
  }
  if (removed) {
    finish(0, 'green', '4 · Result', ['✓ Uninstalled the selected engines.'])
  }
  finish(0, 'green', '4 · Result', ['✓ Nothing to uninstall.'])
}

export async function list () {
  chooseWidth(['lihtne db list'])
  banner(DB_SUBTITLE)
  const pins = loadPins()
  let installed = 0
  let missing = 0

  for (const [index, engine] of ALL_ENGINES.entries()) {
    sectionOpen(`${index + 1} · ${engineTitle(engine)}`, 'blue')
    const isInstalled =
      engine === 'sqlite' ? sqliteInstalled() : Boolean(pins[engine])
    if (isInstalled) {
      installed += 1
      fieldRow('green', 'State', 'installed')
    } else {
      missing += 1
      fieldRow('dim', 'State', 'not installed')
    }
    if (engine === 'sqlite') {
      fieldRow('', 'Version', '—')
      fieldRow('', 'File', sqliteInstalled() ? sqliteFile : '—')
      fieldRow('', 'Host', '—')
      fieldRow('', 'Port', '—')
      fieldRow('', 'Database', 'database.sqlite')
      fieldRow('', 'User', '—')
    } else {
      fieldRow('', 'Version', pins[engine] || '—')
      fieldRow('', 'Container', await containerState(engine))
      fieldRow('', 'Host', '127.0.0.1')
      fieldRow('', 'Port', enginePort(engine))
      fieldRow('', 'Database', 'lihtne')
      fieldRow('', 'User', engineUser(engine))
    }
    sectionClose()
  }

  sectionOpen('6 · Summary', 'cyan')
  fieldRow('', 'Installed', String(installed))
  fieldRow('', 'Not installed', String(missing))
  sectionClose()
}

export { failDb }

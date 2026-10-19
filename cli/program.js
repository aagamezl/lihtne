import { Command, CommanderError } from 'commander'

import { failDb, install, list, showDb, showRoot, uninstall } from './db.js'
import { ALL_ENGINES, canonicalEngine } from './engines.js'
import { ask } from './prompt.js'
import { finish } from './ui.js'

const TAG = /^[A-Za-z0-9._-]+$/

function failRoot (message) {
  showRoot()
  finish(1, 'red', 'Result', [message])
}

async function engineName (engine) {
  if (engine) {
    return engine
  }
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    failDb('✗ Choose an engine or all.')
  }
  const answer = await ask([
    {
      type: 'list',
      name: 'engine',
      message: 'Database engine',
      choices: [
        { name: 'MySQL', value: 'mysql' },
        { name: 'MariaDB', value: 'mariadb' },
        { name: 'Postgres', value: 'pgsql' },
        { name: 'SQL Server', value: 'sqlsrv' },
        { name: 'SQLite', value: 'sqlite' },
        { name: 'All', value: 'all' }
      ]
    }
  ])
  return answer.engine
}

function selection (engine) {
  const canonical = canonicalEngine(engine)
  if (!canonical) {
    failDb(`✗ Unknown engine '${engine}'.`)
  }
  return {
    engine: canonical,
    selected: canonical === 'all' ? [...ALL_ENGINES] : [canonical]
  }
}

function validateVersion (engine, version) {
  if (!version) {
    return
  }
  if (version.includes('latest')) {
    failDb('✗ The latest tag is not used. Pass a version number.')
  }
  if (!TAG.test(version)) {
    failDb('✗ Version tag contains unsupported characters.')
  }
  if (engine === 'all') {
    failDb('✗ --version applies to a single engine.')
  }
  if (engine === 'sqlite') {
    failDb('✗ sqlite has no image tag. Omit --version.')
  }
}

function buildProgram () {
  const program = new Command()
  program
    .name('lihtne')
    .helpOption(false)
    .exitOverride()
    .configureOutput({
      writeOut () {},
      writeErr () {}
    })
    .option('-h, --help')
    .action(() => {
      showRoot()
      process.exit(0)
    })

  const db = program.command('db').helpOption(false).option('-h, --help')
  db.action(() => {
    showDb()
    process.exit(0)
  })

  db.command('install')
    .helpOption(false)
    .argument('[engine]')
    .option('--version <tag>')
    .option('--dry-run')
    .option('-h, --help')
    .allowExcessArguments(false)
    .action(async (engine, options) => {
      if (options.help) {
        showDb()
        process.exit(0)
      }
      const chosen = selection(await engineName(engine))
      validateVersion(chosen.engine, options.version)
      await install(
        chosen.engine,
        chosen.selected,
        options.version ?? '',
        Boolean(options.dryRun)
      )
    })

  db.command('uninstall')
    .helpOption(false)
    .argument('[engine]')
    .option('--dry-run')
    .option('-h, --help')
    .allowExcessArguments(false)
    .action(async (engine, options) => {
      if (options.help) {
        showDb()
        process.exit(0)
      }
      const chosen = selection(await engineName(engine))
      await uninstall(chosen.selected, Boolean(options.dryRun))
    })

  db.command('list')
    .helpOption(false)
    .option('-h, --help')
    .allowExcessArguments(false)
    .action((options) => {
      if (options.help) {
        showDb()
        process.exit(0)
      }
      return list()
    })

  return program
}

function report (error) {
  if (!(error instanceof CommanderError)) {
    throw error
  }
  if (error.code === 'commander.helpDisplayed' || error.exitCode === 0) {
    process.exit(0)
  }

  const args = process.argv.slice(2)
  const group = args[0] ?? ''
  const command = args[1] ?? ''
  const unknown = /unknown command '([^']+)'/i.exec(error.message)
  const unknownOption = /unknown option '([^']+)'/i.exec(error.message)

  if (error.code === 'commander.unknownCommand' && group !== 'db') {
    failRoot(`✗ Unknown group '${unknown?.[1] ?? group}'.`)
  }
  if (error.code === 'commander.unknownCommand') {
    failDb(`✗ Unknown command '${unknown?.[1] ?? command}'.`)
  }
  if (
    group === 'db' &&
    command === 'list' &&
    error.code === 'commander.excessArguments'
  ) {
    failDb('✗ list does not take arguments.')
  }
  if (
    group === 'db' &&
    command === 'uninstall' &&
    unknownOption?.[1]?.includes('version')
  ) {
    failDb('✗ This command does not take --version.')
  }
  if (error.code === 'commander.optionMissingArgument') {
    failDb('✗ --version needs a tag.')
  }
  if (unknownOption) {
    failDb(`✗ Unknown argument '${unknownOption[1]}'.`)
  }
  if (error.code === 'commander.excessArguments') {
    const commandName = /for '([^']+)'/.exec(error.message)?.[1]
    const listed = error.message.split(': ').pop()?.replace(/\.$/, '') ?? ''
    const tokens = listed
      .split(', ')
      .map((token) => token.trim())
      .filter(Boolean)
    const extra = tokens.at(-1) ?? ''
    if (!commandName) {
      failRoot(`✗ Unknown group '${extra || group}'.`)
    }
    if (commandName === 'db') {
      failDb(`✗ Unknown command '${extra || command}'.`)
    }
    if (commandName === 'list') {
      failDb('✗ list does not take arguments.')
    }
    failDb(`✗ Unexpected argument '${extra}'.`)
  }
  if (group === 'db') {
    failDb(`✗ ${error.message}`)
  }
  failRoot(`✗ ${error.message}`)
}

export async function main () {
  try {
    await buildProgram().parseAsync(process.argv)
  } catch (error) {
    report(error)
  }
}

import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import type { LihtneConfig } from '../../Config/types'

import { Repository } from '../../Config/Repository'
import { ConnectionFactory } from '../../Database/Connectors/ConnectionFactory'
import { DatabaseManager } from '../../Database/DatabaseManager'

const CONFIG_FILES = [
  'lihtne.config.ts',
  'lihtne.config.js',
  'lihtne.config.mjs'
]

interface ConfigRecord {
  database?: unknown
  default?: unknown
}

const isConfigRecord = (value: unknown): value is ConfigRecord => {
  return typeof value === 'object' && value !== null
}

const isLihtneConfig = (value: unknown): value is LihtneConfig => {
  return isConfigRecord(value) && isConfigRecord(value.database)
}

const isMissingModule = (error: unknown): boolean => {
  return error instanceof Error && 'code' in error && error.code === 'ERR_MODULE_NOT_FOUND'
}

/**
 * Import the configuration module from the project directory.
 */
const loadConfiguration = async (configFiles: string[]): Promise<LihtneConfig> => {
  for (const configFile of configFiles) {
    try {
      const configPath = join(process.cwd(), configFile)
      const imported: unknown = await import(pathToFileURL(configPath).href)

      const exported = isConfigRecord(imported) && 'default' in imported
        ? imported.default
        : imported

      const config = typeof exported === 'function' ? await exported() : exported

      if (!isLihtneConfig(config)) {
        throw new Error(`InvalidArgumentException: Configuration file [${configFile}] must export a database configuration.`)
      }

      return config
    } catch (error) {
      if (!isMissingModule(error)) {
        throw error
      }
    }
  }

  throw new Error(`InvalidArgumentException: Configuration file [${configFiles.join(', ')}] must export a database configuration.`)
}

export const DB = async () => {
  const config = await loadConfiguration(CONFIG_FILES)

  // TODO: avoid the databaseManager variable instantiation several times; a
  // cached instance would be better.
  const databaseManager = new DatabaseManager(
    new ConnectionFactory(),
    new Repository(),
    config
  )

  return databaseManager.connection()
}

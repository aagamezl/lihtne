import type { DatabaseConfig } from '../../Config/types'
import { objectDiffKey } from '../../Support'
import { DetectsLostConnections } from '../DetectsLostConnections'
import type { Driver, DriverOptions } from '../Drivers/Driver'

export abstract class Connector extends DetectsLostConnections {
  /**
   * Establish a database connection.
   *
   * @param  {Record<string, any>}  config
   * @returns {Driver}
   */
  // @ts-expect-error - expected error, value is not used in this method
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public connect(config: DatabaseConfig): Driver {
    throw new Error('ConcreteMethodException: Method connect must be implemented.')
  }

  /**
   * Get the PDO options based on the configuration.
   *
   * @param  {Record<string, any>}  config
   * @return {Record<string, any>}
   */
  getOptions (config: DatabaseConfig): DriverOptions {
    const options = config.options ?? {}

    return { ...objectDiffKey(this.options, options), ...options }
  }

  /**
   * Create a new Driver connection.
   *
   * @param  {string}  dsn
   * @param  {Record<string, any>}  config
   * @param  {Record<string, unknown>}  options
   * @return {Driver}
   *
   * @throws {Error}
   */
  protected createConnection(dsn: string, config: DatabaseConfig, options: DriverOptions): Driver {
    try {
      return this.createDriverConnection(dsn, options)
    } catch (error) {
      return this.tryAgainIfCausedByLostConnection(
        error, dsn, options
      )
    }
  }

  protected createDriverConnection(dsn: string, options: DriverOptions): Driver {
    throw new Error('ConcreteMethodException: Method createDriverConnection must be implemented.')
  }

  protected tryAgainIfCausedByLostConnection(error: Error, dsn: string, options: DriverOptions): Driver {
    if (this.causedByLostConnection(error)) {
      return this.createDriverConnection(dsn, options)
    }

    throw error
  }
}

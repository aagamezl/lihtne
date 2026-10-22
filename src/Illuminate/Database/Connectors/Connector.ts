import type { DatabaseConfig } from '../../Config/types'
import type { Driver, DriverOptions } from '../Drivers/Driver'

import { objectDiffKey } from '../../Support'
import { DetectsLostConnections } from '../DetectsLostConnections'

export class Connector extends DetectsLostConnections {
  /**
   * The default PDO connection options.
   *
   * @var array
   */
  protected options: Record<string, unknown> = {}

  /**
   * Establish a database connection.
   *
   * @param  {Record<string, any>}  config
   * @returns {Driver}
   */
  // @ts-expect-error - expected error, value is not used in this method
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async connect (config: DatabaseConfig): Promise<Driver> {
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
  protected createConnection (
    dsn: string,
    // @ts-expect-error - expected error, value is not used in this method
    config: DatabaseConfig,
    options: DriverOptions
  ): Driver {
    try {
      return this.createDriverConnection(dsn, options)
    } catch (error) {
      return this.tryAgainIfCausedByLostConnection(error, dsn, options)
    }
  }

  // @ts-expect-error - expected error, value is not used in this method
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected createDriverConnection (dsn: string, options: DriverOptions): Driver {
    throw new Error('ConcreteMethodException: Method createDriverConnection must be implemented.')
  }

  protected tryAgainIfCausedByLostConnection (
    error: Error,
    dsn: string,
    options: DriverOptions
  ): Driver {
    if (this.causedByLostConnection(error)) {
      return this.createDriverConnection(dsn, options)
    }

    throw error
  }
}

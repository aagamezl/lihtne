import type { Statement } from '../Statements'

export type DriverOptions = Record<string, unknown>

export type DriverType = 'mysql' | 'mariadb' | 'pgsql' | 'sqlsrv' | 'sqlite'

export class Driver {
  static ATTR_SERVER_VERSION: number = 4

  protected driverTitle?: DriverType

  protected dsn: string

  protected options: DriverOptions = {}

  protected serverVersion?: string

  protected client: unknown | undefined

  public isConnected(): boolean {
    return this.client !== undefined
  }

  /**
   * Creates an instance of Statement.
   * @param {string} dsn
   * @param {Record<string, unknown>} options
   * @memberof Driver
   */
  constructor (dsn: string, options: DriverOptions) {
    this.dsn = dsn
    this.options = options
  }

  /**
   * Open a session with the database client.
   *
   * Concrete drivers call the client library's own method (`Client.connect`,
   * `mysql.createConnection`, and so on) and return that client.
   */
  public async connect (): Promise<unknown> {
    throw new Error(`RuntimeException: Implement 'connect' method on concrete class.`)
  }

  /**
   * Close the session opened by connect().
   *
   * Concrete drivers call the client library's own method (`end`, and so on).
   */
  public async disconnect (): Promise<void> {
    throw new Error(`RuntimeException: Implement 'disconnect' method on concrete class.`)
  }

  /**
   *
   * @param {number} attribute
   * @returns {any}
   */
  // @ts-expect-error expected error; attribute is not used in this method
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- required by the base getAttribute signature
  public async getAttribute (attribute: string | number): Promise<string> {
    throw new Error(
      `RuntimeException: Implement 'getAttribute' method on concrete class.`
    )
  }

  public getDriverTitle (): DriverType | undefined {
    return this.driverTitle
  }

  /**
   * Get the last inserted ID.
   * @param {string | undefined} sequence
   * @returns {string | undefined }
   */
  public lastInsertId (
    // @ts-expect-error expected error; sequence is not used in this method
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- required by the base lastInsertId signature
    sequence: string | undefined = undefined
  ): string | number | Promise<string | number> {
    throw new Error(
      `RuntimeException: Implement 'lastInsertId' method on concrete class`
    )
  }

  /**
   * Prepares a statement for execution and returns a statement object
   * @param {string} query
   * @returns {Statement}
   * @throws {Error}
   */
  public prepare<
    TRow extends Record<string, unknown> = Record<string, unknown>
  > (query: string): Statement<TRow> {
    throw new Error(
      `RuntimeException: Implement 'prepare' method on concrete class for query: ${query}`
    )
  }
}

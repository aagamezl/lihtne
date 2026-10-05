import type { Statement } from '../Statements'

export type DriverOptions = Record<string, unknown>

export type DriverType = 'mysql' | 'mariadb' | 'pgsql' | 'sqlsrv' | 'sqlite'

export class Driver {
  protected dsn: string

  protected options: DriverOptions = {}

  protected driverTitle?: DriverType

  static FETCH_OBJ: number = 5

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

  public getDriverTitle (): DriverType | undefined {
    return this.driverTitle
  }

  /**
   *
   * @param {number} attribute
   * @returns {any}
   */
  // @ts-expect-error expected error; attribute is not used in this method
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- required by the base getAttribute signature
  public getAttribute (attribute: string | number): unknown {
    throw new Error(
      `RuntimeException: Implement 'getAttribute' method on concrete class.`
    )
  }

  /**
   * Prepares a statement for execution and returns a statement object
   * @param {string} query
   * @returns {Statement}
   * @throws {Error}
   */
  public prepare (query: string): Statement {
    throw new Error(
      `RuntimeException: Implement 'prepare' method on concrete class for query: ${query}`
    )
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
  ): string | undefined {
    throw new Error(
      `RuntimeException: Implement 'lastInsertId' method on concrete class`
    )
  }
}

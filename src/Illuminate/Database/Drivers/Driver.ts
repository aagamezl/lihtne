export type DriverOptions = Record<string, unknown>

export class Driver {
  protected dsn: string

  protected options: DriverOptions

  /** @type {number} */
  static ATTR_SERVER_VERSION: number = 4

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

  /**
   *
   * @param {number} attribute
   * @returns {any}
   */
  // @ts-ignore expected error must be implemented in concrete class
  public getAttribute (attribute: string | number) {
    return new Error(`RuntimeException: Implement 'getAttribute' method on concrete class.`)
  }

  /**
   * Prepares a statement for execution and returns a statement object
   * @param {string} query
   * @returns {Statement}
   * @throws {Error}
   */
  // @ts-ignore expected error must be implemented in concrete class
  public prepare (query: string) {
    return new Error(`RuntimeException: Implement 'prepare' method on concrete class.`)
  }
}

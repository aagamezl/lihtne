import type { DriverOptions } from '../Drivers/Driver'
import type { BindingValue, BindingValues } from '../Query'

export type Result = {
  rows: unknown[]
  rowCount: number | undefined
}

// export type PreparedStatement = {
//   name: string
//   text: string
//   values?: BindingValues
// }

// export abstract class Statement<
//   TRow extends Record<string, unknown> = Record<string, unknown>
// > {
export abstract class Statement {
  protected bindings: Record<string, BindingValue> = {}

  protected abstract client: unknown

  protected dsn: string

  protected options: DriverOptions

  protected query: string

  /**
   * @protected
   * @type {any}
   */
  protected result: Result = { rows: [], rowCount: 0 }

  // protected statement!: PreparedStatement
  protected  abstract statement: unknown

  /**
   * Creates an instance of Statement.
   * @param {string} dsn
   * @param {Record<string, unknown>} options
   * @param {string} query
   * @memberof Statement
   */
  constructor (dsn: string, options: DriverOptions, query: string) {
    this.dsn = dsn
    this.options = options
    this.query = query

    this.prepare(query)
  }

  /**
   *
   * @param {string|number} param
   * @param {*} value
   * @return {boolean}
   */
  public bindValue (param: string | number, value: BindingValue): boolean {
    try {
      this.bindings[param] = value

      return true
    } catch (error) {
      return false
    }
  }

  /**
   * Executes the statement and returns the result.
   * @param values {BindingValues}
   * @returns {Promise<unknown[]>}
   */
  public abstract execute (values?: BindingValues): Promise<unknown[]>

  public abstract fetchAll (): unknown[]

  public abstract parameterize (query: string): string

  /**
   * Prepares a statement for execution and returns a statement object
   *
   * @param {string} query
   * @returns {Statement}
   */
  public abstract prepare (query: string): Promise<this>

  public abstract rowCount (): number
}

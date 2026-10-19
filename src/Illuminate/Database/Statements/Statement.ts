import type { DriverOptions } from '../Drivers/Driver'
import type { BindingValue, BindingValues } from '../Query'

export type Result<
  TRow extends Record<string, unknown> = Record<string, unknown>
> = {
  rows: TRow[]
  rowCount: number | undefined
}

export type PreparedStatement = {
  name: string
  text: string
  values?: BindingValues
}

export abstract class Statement<
  TRow extends Record<string, unknown> = Record<string, unknown>
> {
  protected bindings: Record<string, BindingValue> = {}

  protected statement!: PreparedStatement

  protected abstract client: unknown

  protected dsn: string

  protected options: DriverOptions

  protected query: string

  /**
   * @protected
   * @type {any}
   */
  protected result: Result<TRow> = { rows: [], rowCount: 0 }

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

  public abstract parameterize (query: string): string

  public abstract execute (values?: BindingValues): Promise<TRow[]>

  public abstract fetchAll (): TRow[]

  public abstract rowCount (): number

  public abstract close (): Promise<void>

  /**
   * Prepares a statement for execution and returns a statement object
   *
   * @param {string} query
   * @returns {Statement}
   */
  public abstract prepare (query: string): this
}

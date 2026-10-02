import type { BindingValue, BindingValues } from '../Query'

export type Result = {
  rows: Record<string, unknown>[]
}

export class Statement {
  protected bindings: Record<string, BindingValue> = {}

  /**
   * @protected
   * @type {any}
   */
  protected result: Result = { rows: [] }

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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- required by the base execute signature
  public execute (_params?: BindingValues) {
    throw new Error(
      `RuntimeException: Implement execute method on concrete class.`
    )
  }

  public fetchAll (): Result['rows'] {
    return this.result.rows
  }

  public rowCount (): number {
    throw new Error(
      `RuntimeException: Implement rowCount method on concrete class.`
    )
  }
}

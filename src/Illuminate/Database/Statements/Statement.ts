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

  // @ts-expect-error expected error must be implemented in concrete class
  public execute (params?: BindingValues) {
    throw new Error(
      `RuntimeException: Implement execute method on concrete class.`
    )
  }

  public fetchAll (): Result['rows'] {
    return this.result.rows
  }
}

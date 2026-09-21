import type { Bindings } from '../Query'

export type Result = {
  rows: Record<string, unknown>[]
}

export class Statement {
  protected bindings: Record<string, unknown> = {}

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
  public bindValue (param: string | number, value: unknown): boolean {
    try {
      this.bindings[param] = value

      return true
    } catch (error) {
      return false
    }
  }

  // @ts-expect-error expected error must be implemented in concrete class
  public execute (params?: Bindings) {
    throw new Error(
      `RuntimeException: Implement execute method on concrete class.`
    )
  }

  public fetchAll (): Result['rows'] {
    return this.result.rows
  }
}

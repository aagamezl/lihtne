import { CustomException } from "../../Support"
import { Bindings } from "../Query"

export type Result = {
  rows: Record<string, unknown>[]
}

export class Statement {
  /** @type {} */
  protected bindings: Record<string, unknown> = {}

  /**
   * @protected
   * @type {any}
   */
  protected result: Result = {rows:[]}

  /**
   *
   * @param {string|number} param
   * @param {*} value
   * @return {boolean}
   */
  bindValue(param: string | number, value: unknown) {
    try {
      this.bindings[param] = value

      return true
    } catch (error) {
      return false
    }
  }

  execute(params?: Bindings) {
    throw CustomException('concrete-method', 'execute')
  }

  fetchAll(): Result["rows"] {
    return this.result.rows
  }
}
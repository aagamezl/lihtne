import { uuid } from '@devnetic/utils'

import type { BindingValue, BindingValues } from '../Query'

export type Result = {
  rows: Record<string, unknown>[]
}

export type PreparedStatement = {
  name: string
  text: string
}

export class Statement {
  protected bindings: Record<string, BindingValue> = {}

  protected statement?: PreparedStatement

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

  prepare (query: string): Statement {
    this.statement = {
      // give the query a unique name
      name: `prepared-statement-${uuid()}`,
      text: this.parameterize(query)
    }

    this.bindings = {}

    return this
  }

  parameterize (query: string): string {
    const regex = /\?/gm

    if (query.match(regex) === null) {
      return query
    }

    let index = 0
    return query.replace(regex, () => `$${++index}`)
  }

  // @ts-expect-error expected error; params is not used in this method
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- required by the base execute signature
  public async execute (params?: BindingValues): Promise<boolean> {
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

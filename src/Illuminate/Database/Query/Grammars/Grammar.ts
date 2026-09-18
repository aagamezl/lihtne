import type { Builder } from '../Builder'

import { mixing } from '../../../Support/Traits'
import { CompilesJsonPaths } from '../../Concerns/CompilesJsonPaths'
import { Grammar as BaseGrammar } from '../../Grammar'
import { Expression } from '../Expression'

export interface Grammar extends BaseGrammar, CompilesJsonPaths { }

export class Grammar extends mixing(BaseGrammar).useTrait([CompilesJsonPaths]) implements Grammar {
  /**
   * Compile a select query into SQL.
   *
   * @param  \Illuminate\Database\Query\Builder  query
   * @return string
   */
  public compileSelect (query: Builder): string {
    const columns = query.columns.length > 0 ? query.columns : ['*']
    const compiledColumns = columns
      .map((column) => (column === '*' ? '*' : String(this.wrap(column))))
      .join(', ')
    const from =
      typeof query.fromProperty === 'string' ||
      query.fromProperty instanceof Expression
        ? query.fromProperty
        : String(query.fromProperty)

    return `select ${compiledColumns} from ${this.wrapTable(from)}`.trim()
  }
}

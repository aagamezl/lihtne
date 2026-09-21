import { isTruthy } from '@devnetic/utils'
import { isNil } from 'es-toolkit'

import type { Builder } from '../Builder'
import type { Expression } from '../Expression'

import { Grammar } from './Grammar'

export class PostgresGrammar extends Grammar {
  /**
  * Compile the "select *" portion of the query.
  *
  * @param  \Illuminate\Database\Query\Builder  $query
  * @param  array  $columns
  * @return string|null
  */
  protected compileColumns (
    query: Builder,
    columns: Array<Expression | string>
  ): string | null | undefined {
    // If the query is actually performing an aggregating select, we will let that
    // compiler handle the building of the select clauses, as it will need some
    // more syntax that is best handled by that function to keep things neat.
    if (!isNil(query.aggregateProperty)) {
      return
    }

    let select: string

    if (Array.isArray(query.distinctProperty)) {
      select = 'select distinct on (' + this.columnize(query.distinctProperty) + ') '
    } else if (isTruthy(query.distinctProperty)) {
      select = 'select distinct '
    } else {
      select = 'select '
    }

    return select + this.columnize(columns)
  }
}

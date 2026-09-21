import { isNil } from 'es-toolkit'

import type { Bindings, Builder } from '../Builder'

import { isValueSet, ucfirst } from '../../../Support'
import { mixing } from '../../../Support/Traits'
import { CompilesJsonPaths } from '../../Concerns/CompilesJsonPaths'
import { Grammar as BaseGrammar } from '../../Grammar'

/**
 * Array representing the select components for a query.
 */
type SelectComponent = {
  /**
   * The name of the select component.
   */
  name: string
  /**
   * The property associated with the select component.
   */
  property: string
}

export interface Grammar extends BaseGrammar, CompilesJsonPaths { }

export class Grammar extends mixing(BaseGrammar).useTrait([CompilesJsonPaths]) implements Grammar {
  /**
   * The components that make up a select clause.
   *
   * @type {SelectComponent[]}
   */
  selectComponents: SelectComponent[] = [
    { name: 'aggregate', property: 'aggregateProperty' },
    { name: 'columns', property: 'columns' },
    { name: 'from', property: 'fromProperty' },
    { name: 'indexHint', property: 'indexHint' },
    { name: 'joins', property: 'joins' },
    { name: 'wheres', property: 'wheres' },
    { name: 'groups', property: 'groups' },
    { name: 'havings', property: 'havings' },
    { name: 'orders', property: 'orders' },
    { name: 'limit', property: 'limitProperty' },
    { name: 'offset', property: 'offsetProperty' },
    { name: 'lock', property: 'lockProperty' }
  ]

  /**
 * Compile a select query into SQL.
 *
 * @param  \Illuminate\Database\Query\Builder  $query
 * @return string
 */
  public compileSelect(query: Builder): string {
    if ((query.unions || query.havings) && query.aggregate) {
      return this.compileUnionAggregate(query)
    }

    // If a "group limit" is in place, we will need to compile the SQL to use a
    // different syntax. This primarily supports limits on eager loads using
    // Eloquent. We'll also set the columns if they have not been defined.
    if (isValueSet(query.groupLimit)) {
      if (isNil(query.columns)) {
        query.columns = ['*']
      }

      return this.compileGroupLimit(query)
    }

    // If the query does not have any columns set, we'll set the columns to the
    // * character to just get all of the columns from the database. Then we
    // can build the query and concatenate all the pieces together as one.
    const original = query.columns

    if (isNil(query.columns)) {
      query.columns = ['*']
    }

    // To compile the query, we'll spin through each component of the query and
    // see if that component exists. If it does we'll just call the compiler
    // function for the component which is responsible for making the SQL.
    let sql = this.concatenate(this.compileComponents(query)).trim()

    if (query.unions) {
      sql = this.wrapUnion(sql) + ' ' + this.compileUnions(query)
    }

    query.columns = original

    return sql
  }

  /**
   * Compile the components necessary for a select clause.
   *
   * @param  \Illuminate\Database\Query\Builder  query
   * @return array
   */
  protected compileComponents(query: Builder) {
    const sql: Record<string, string> = {}

    for (const { name, property } of this.selectComponents) {
      if (this.isExecutable(query, property)) {
        const method = 'compile' + ucfirst(name)

        sql[name] = this[method](query, query[property as keyof Builder])
        // sql[name] = Reflect.get(this, method)(query, Reflect.get(query, property));
      }
    }

    return sql
  }

  protected isExecutable(query: Builder, property: string): boolean {
    const subject = Reflect.get(query, property)

    if (subject === undefined || subject === '') {
      return false
    }

    if (Array.isArray(subject) && subject.length === 0) {
      return false
    }

    return true
  }

  /**
 * Substitute the given bindings into the given raw SQL query.
 *
 * @param  string  sql
 * @param  array  bindings
 * @return string
 */
  public substituteBindingsIntoRawSql(sql: string, bindings: Bindings) {
    // bindings = bindings.map((value) => this.escape(value))
    bindings = Object.values((value) => this.escape(value, is_resource(value) || gettype(value) === 'resource (closed)'))

    let query = ''

    let isStringLiteral = false

    for (let i = 0; i < sql.length; i++) {
      const char = sql[i]
      const nextChar = sql[i + 1] ?? null

      // Single quotes can be escaped as '' according to the SQL standard while
      // MySQL uses \'. Postgres has operators like ?| that must get encoded
      // in PHP like ??|. We should skip over the escaped characters here.
      if (["\\'", "''", '??'].includes(char + nextChar)) {
        query += char + nextChar
        i += 1
      } else if (char === "'") {
        // Starting / leaving string literal...
        query += char
        isStringLiteral = !isStringLiteral
      } else if (char === '?' && !isStringLiteral) {
        // Substitutable binding...
        query += bindings.shift() ?? '?'
      } else {
        // Normal character...
        query += char
      }
    }

    return query
  }
}

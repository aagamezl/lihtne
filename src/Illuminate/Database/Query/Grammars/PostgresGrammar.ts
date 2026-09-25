import { isTruthy } from '@devnetic/utils'
import { isNil } from 'es-toolkit'

import type { Builder, WhereClause } from '../Builder'
import type { Expression } from '../Expression'

import { Collection } from '../../../Collections/Collection'
import { Str } from '../../../Support'
import { Grammar } from './Grammar'

export class PostgresGrammar extends Grammar {
  /**
   * All of the available clause operators.
   *
   * @var string[]
   */
  protected override operators = [
    '=', '<', '>', '<=', '>=', '<>', '!=',
    'like', 'not like', 'between', 'ilike', 'not ilike',
    '~', '&', '|', '#', '<<', '>>', '<<=', '>>=',
    '&&', '@>', '<@', '?', '?|', '?&', '||', '-', '@?', '@@', '#-',
    'is distinct from', 'is not distinct from'
  ]

  /**
   * The Postgres grammar specific custom operators.
   *
   * @var array
   */
  protected static customOperators = []

  /**
   * The grammar specific bitwise operators.
   *
   * @var array
   */
  protected override bitwiseOperators = [
    '~', '&', '|', '#', '<<', '>>', '<<=', '>>='
  ]

  /**
   * Indicates if the cascade option should be used when truncating.
   *
   * @var bool
   */
  protected static cascadeTruncate = true

  /**
   * Compile the "select *" portion of the query.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $columns
   * @return string|null
   */
  protected override compileColumns(
    query: Builder,
    columns: Array<Expression | string>
  ): string | null | undefined {
    // If the query is actually performing an aggregating select, we will let that
    // compiler handle the building of the select clauses, as it will need some
    // more syntax that is best handled by that function to keep things neat.
    if (!isNil(query.aggregateProperty)) {
      return ''
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

  /**
   * Compile a date based where clause.
   *
   * @param  string  $type
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $where
   * @return string
   */
  protected override dateBasedWhere(
    type: string,
    query: Builder,
    where: WhereClause
  ): string {
    const value = this.parameter(where.value)

    return 'extract(' + type + ' from ' + this.wrap(where.column) + ') ' + where.operator + ' ' + value
  }

  /**
   * Compile a "where date" clause.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $where
   * @return string
   */
  protected override whereDate(query: Builder, where: WhereClause): string {
    let column = this.wrap(where.column)
    const value = this.parameter(where.value)

    if (this.isJsonSelector(column)) {
      column = '(' + column + ')'
    }

    return column + '::date ' + where.operator + ' ' + value
  }

  /**
   * Compile a "where time" clause.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $where
   * @return string
   */
  protected override whereTime(query: Builder, where: WhereClause): string {
    let column = this.wrap(where.column)
    const value = this.parameter(where.value)

    if (this.isJsonSelector(column)) {
      column = '(' + column + ')'
    }

    return column + '::time ' + where.operator + ' ' + value
  }

  /**
   * Get an array of valid full text languages.
   *
   * @return array
   */
  protected validFullTextLanguages(): string[] {
    return [
      'simple',
      'arabic',
      'danish',
      'dutch',
      'english',
      'finnish',
      'french',
      'german',
      'hungarian',
      'indonesian',
      'irish',
      'italian',
      'lithuanian',
      'nepali',
      'norwegian',
      'portuguese',
      'romanian',
      'russian',
      'spanish',
      'swedish',
      'tamil',
      'turkish',
    ]
  }

  /**
   * Compile a "where fulltext" clause.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $where
   * @return string
   */
  public override whereFulltext(query: Builder, where: WhereClause): string {
    let language = where.options?.language ?? 'english';

    if (!this.validFullTextLanguages().includes(language)) {
      language = 'english';
    }

    const isVector = where.options?.vector ?? false;

    const columns = (new Collection(where.columns ?? []))
      .map((column: Expression | string) => isVector
        ? this.wrap(column)
        : `to_tsvector('${language}', ${this.wrap(column)})`)
      .implode(' || ')

    let mode = 'plainto_tsquery';

    if (where.options?.mode === 'phrase') {
      mode = 'phraseto_tsquery';
    }

    if (where.options?.mode === 'websearch') {
      mode = 'websearch_to_tsquery';
    }

    if (where.options?.mode === 'raw') {
      mode = 'to_tsquery';
    }

    return `(${columns}) @@ ${mode}('${language}', ${this.parameter(where.value)})`;
  }

  /**
   * Compile a basic where clause.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $where
   * @return string
   */
  protected override whereBasic(query: Builder, where: WhereClause): string {
    if (where.operator?.toLowerCase().includes('like')) {
      return `${this.wrap(where.column ?? '')}::text ${where.operator} ${this.parameter(where.value)}`
    }

    return super.whereBasic(query, where)
  }

  /**
   * Compile a "where like" clause.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $where
   * @return string
   */
  protected whereLike(query: Builder, where: WhereClause): string {
    where.operator = where.not ? 'not ' : ''
    where.operator += where.caseSensitive ? 'like' : 'ilike'

    return this.whereBasic(query, where)
  }

  /**
   * Wrap the given JSON selector.
   *
   * @param  string  $value
   * @return string
   */
  protected override wrapJsonSelector(value: string): string {
    const path = value.split('->')

    const field = this.wrapSegments(path.shift()?.split('.') ?? [])

    const wrappedPath = this.wrapJsonPathAttributes(path)

    const attribute = wrappedPath.pop()

    if (wrappedPath.length > 0) {
      return field + '->' + wrappedPath.join('->') + '->>' + attribute
    }

    return field + '->>' + attribute
  }

  /**
 * Wrap the given JSON selector for boolean values.
 *
 * @param  string  $value
 * @return string
 */
  protected wrapJsonBooleanSelector(value: string): string {
    const selector = this.wrapJsonSelector(value).replace('->>', '->')

    return '(' + selector + ')::jsonb'
  }

  /**
   * Wrap the given JSON boolean value.
   *
   * @param  string  $value
   * @return string
   */
  protected wrapJsonBooleanValue(value: string): string {
    return "'" + value + "'::jsonb"
  }

  /**
   * Wrap the attributes of the given JSON path.
   *
   * @param  array  $path
   * @return array
   */
  protected wrapJsonPathAttributes(path: string[]): string[] {
    const quote = arguments.length === 2 ? arguments[1] : "'"

    return new Collection<string, string[]>(path)
      .map((attribute: string) => this.parseJsonPathArrayKeys(attribute))
      .collapse()
      .map((attribute: string) => {
        if (Number.isInteger(attribute)) {
          return attribute
        }

        attribute = attribute.replace("'", "''")

        if (quote !== "'") {
          attribute = attribute.replace(quote, quote + quote)
        }

        return quote + attribute + quote
      })
      .all()
  }

  /**
   * Parse the given JSON path attribute for array keys.
   *
   * @param  string  $attribute
   * @return array
   */
  protected parseJsonPathArrayKeys(attribute: string): string[] {
    const parts = attribute.match(/(\[[^\]]+\])+$/)
    if (parts) {
      const key = Str.beforeLast(attribute, parts[0])

      const keys = parts[0].match(/\[([^\]]+)\]/g)

      return (new Collection<string, string[]>([key]))
        .merge(keys?.[1] ?? [])
        .diff('')
        .values()
        .all()
    }

    return [attribute]
  }
}

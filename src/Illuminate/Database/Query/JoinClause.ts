// import type { Constructor } from '../../Support'
import type { Connection } from '../Connection'
import { Builder } from './Builder'
import type { Expression } from './Expression'
import type { Grammar } from './Grammars'
import type { Processor } from './Processors'

type BuilderConstructor = new (
  connection: Connection,
  grammar: Grammar,
  processor: Processor
) => Builder

export class JoinClause extends Builder {
  /**
 * The type of join being performed.
 *
 * @var string
 */
  public type: string

  /**
   * The table the join clause is joining to.
   *
   * @var \Illuminate\Contracts\Database\Query\Expression|string
   */
  public table: Expression | string

  /**
   * The connection of the parent query builder.
   *
   * @var \Illuminate\Database\ConnectionInterface
   */
  protected parentConnection: Connection

  /**
   * The grammar of the parent query builder.
   *
   * @var \Illuminate\Database\Query\Grammars\Grammar
   */
  protected parentGrammar: Grammar

  /**
   * The processor of the parent query builder.
   *
   * @var \Illuminate\Database\Query\Processors\Processor
   */
  protected parentProcessor: Processor

  /**
   * The class name of the parent query builder.
   *
   * @var string
   */
  protected parentClass: BuilderConstructor

  /**
   * Create a new join clause instance.
   *
   * @param  \Illuminate\Database\Query\Builder  parentQuery
   * @param  string  type
   * @param  string  table
   */
  public constructor(parentQuery: Builder, type: string, table: Expression | string) {
    super(
      parentQuery.getConnection(),
      parentQuery.getGrammar(),
      parentQuery.getProcessor()
    )

    this.type = type
    this.table = table
    this.parentClass = parentQuery.constructor as BuilderConstructor
    this.parentGrammar = parentQuery.getGrammar()
    this.parentProcessor = parentQuery.getProcessor()
    this.parentConnection = parentQuery.getConnection()

  }

  /**
   * Add an "on" clause to the join.
   *
   * On clauses can be chained, e.g.
   *
   *  $join->on('contacts.user_id', '=', 'users.id')
   *       ->on('contacts.info_id', '=', 'info.id')
   *
   * will produce the following SQL:
   *
   * on `contacts`.`user_id` = `users`.`id` and `contacts`.`info_id` = `info`.`id`
   *
   * @param  \Closure|\Illuminate\Contracts\Database\Query\Expression|string  $first
   * @param  string|null  $operator
   * @param  \Illuminate\Contracts\Database\Query\Expression|string|null  $second
   * @param  string  $boolean
   * @return $this
   *
   * @throws \InvalidArgumentException
   */
  public on(
    first: Function | Expression | string,
    operator: string | undefined = undefined,
    second: string | Expression | undefined = undefined,
    boolean: string = 'and'
  ): this {
    if (first instanceof Function) {
      return this.whereNested(first, boolean)
    }

    return this.whereColumn(first, operator, second, boolean)
  }

  /**
   * Add an "or on" clause to the join.
   *
   * @param  \Closure|\Illuminate\Contracts\Database\Query\Expression|string  $first
   * @param  string|null  $operator
   * @param  \Illuminate\Contracts\Database\Query\Expression|string|null  $second
   * @return \Illuminate\Database\Query\JoinClause
   */
  public orOn(
    first: Function | Expression | string,
    operator: string | undefined = undefined,
    second: string | Expression | undefined = undefined
  ): this {
    return this.on(first, operator, second, 'or')
  }

  /**
 * Get a new instance of the join clause builder.
 *
 * @return \Illuminate\Database\Query\JoinClause
 */
  public override newQuery(): JoinClause {
    return new JoinClause(this.newParentQuery(), this.type, this.table);
  }

  /**
   * Create a new query instance for sub-query.
   *
   * @return \Illuminate\Database\Query\Builder
   */
  protected override forSubQuery(): Builder {
    return this.newParentQuery().newQuery();
  }

  /**
   * Create a new parent query instance.
   *
   * @return \Illuminate\Database\Query\Builder
   */
  protected newParentQuery(): Builder {
    return new this.parentClass(
      this.parentConnection,
      this.parentGrammar,
      this.parentProcessor
    )
  }
}
import Builder from './Builder.js'
/**
 *
 *
 * @export
 * @class JoinClause
 * @extends {Builder}
 */
export default class JoinClause extends Builder {
  /**
   * Create a new join clause instance.
   *
   * @constructor
   * @param  {{\Illuminate\Database\Query\Builder}}  parentQuery
   * @param  {string}  type
   * @param  {string}  table
   * @return {void}
   */
  constructor (parentQuery, type, table) {
    const parentConnection = parentQuery.getConnection()
    const parentGrammar = parentQuery.getGrammar()
    const parentProcessor = parentQuery.getProcessor()

    super(parentConnection, parentGrammar, parentProcessor)

    this.type = type
    this.table = table
    this.parentClass = parentQuery.constructor
    this.parentConnection = parentQuery.getConnection()
    this.parentGrammar = parentGrammar
    this.parentProcessor = parentProcessor
  }

  /**
   * Create a new query instance for sub-query.
   *
   * @return {\Illuminate\Database\Query\Builder}
   */
  forSubQuery () {
    return this.newParentQuery().newQuery()
  }

  /**
   * Create a new parent query instance.
   *
   * @return {\Illuminate\Database\Query\Builder}
   */
  newParentQuery () {
    const constructor = this.parentClass
    return new constructor(this.parentConnection, this.parentGrammar, this.parentProcessor)
  }

  /**
   * Get a new instance of the join clause builder.
   *
   * @return {\Illuminate\Database\Query\JoinClause}
   */
  newQuery () {
    return new JoinClause(this.newParentQuery(), this.type, this.table)
  }

  /**
   * Add an "on" clause to the join.
   *
   * On clauses can be chained, e.g.
   *
   *  join.on('contacts.user_id', '=', 'users.id')
   *      .on('contacts.info_id', '=', 'info.id')
   *
   * will produce the following SQL:
   *
   * on `contacts`.`user_id` = `users`.`id` and `contacts`.`info_id` = `info`.`id`
   *
   * @param  {\Function|string}  first
   * @param  {string}  [operator]
   * @param  {\Illuminate\Database\Query\Expression|string|undefined}  [second]
   * @param  {string}  [boolean=and]
   * @return {this}
   *
   * @throws {\InvalidArgumentException}
   */
  on (first, operator, second, boolean = 'and') {
    if (first instanceof Function) {
      return this.whereNested(first, boolean)
    }

    return this.whereColumn(first, operator, second, boolean)
  }

  /**
   * Add an "or on" clause to the join.
   *
   * @param  {Function|string}  first
   * @param  {string}  [operator=undefined]
   * @param  {string}  [second=undefined]
   * @return {\Illuminate\Database\Query\JoinClause}
   */
  orOn (first, operator, second) {
    return this.on(first, operator, second, 'or')
  }
}

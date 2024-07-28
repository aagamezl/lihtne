import BaseGrammar from '../../Grammar.js'
import Blueprint from '../Blueprint.js'
import Fluent from '../../../Support/Fluent.js'
import { CustomException, ucfirst } from '../../../Support/helpers.js'

/** @typedef {import('../../Query/Expression.js').default} Expression */

export default class Grammar extends BaseGrammar {
  /**
   * The commands to be executed outside of create or alter command.
   * @protected
   * @type {string[]}
   */
  fluentCommands = []

  /**
   * The possible column modifiers.
   *
   * @protected
   * @type {string[]}
   */
  modifiers = []

  constructor () {
    super()

    if (new.target === Grammar) {
      throw CustomException('abstract')
    }
  }

  /**
   * Add the column modifiers to the definition.
   *
   * @protected
   * @param  {string}  sql
   * @param  {Blueprint}  blueprint
   * @param  {Fluent}  column
   * @return {string}
   */
  addModifiers (sql, blueprint, column) {
    for (const modifier of this.modifiers) {
      const method = `modify${modifier}`

      if (Reflect.has(this, method)) {
        sql += this[method](blueprint, column) ?? ''
      }
    }

    return sql
  }

  /**
   * Compile the blueprint's column definitions.
   *
   * @protected
   * @param  {import('../Blueprint.js').default}  blueprint
   * @return {string[]}
   */
  getColumns (blueprint) {
    const columns = []

    for (const column of blueprint.getAddedColumns()) {
      // Each of the column types have their own compiler functions which are tasked
      // with turning the column definition into its SQL format for this platform
      // used by the connection. The column's modifiers are compiled and added.
      const sql = this.wrap(column) + ' ' + this.getType(column)

      columns.push(this.addModifiers(sql, blueprint, column))
    }

    return columns
  }

  /**
   * Get the fluent commands for the grammar.
   *
   * @return {string[]}
   */
  getFluentCommands () {
    return this.fluentCommands
  }

  /**
   * Get the SQL for the column data type.
   *
   * @protected
   * @param  {Fluent}  column
   * @return {string}
   */
  getType (column) {
    return this['type' + ucfirst(column.get('type'))](column)
  }

  /**
   * Determine if a command with a given name exists on the blueprint.
   *
   * @protected
   * @param  {Blueprint} blueprint
   * @param  {string} name
   * @return {boolean}
   */
  hasCommand (blueprint, name) {
    for (const command of blueprint.getCommands()) {
      if (command.get('name') === name) {
        return true
      }
    }

    return false
  }

  /**
   * Add a prefix to an array of values.
   *
   * @param {string} prefix
   * @param {string[]} values
   * @returns {string[]}
   */
  prefixArray (prefix, values) {
    return values.map(value => `${prefix} ${value}`)
  }

  /**
   * Wrap a value in keyword identifiers.
   *
   * @param  {Fluent|Expression|string}  value
   * @param  {boolean}  [prefixAlias=false]
   * @return {string}
   */
  wrap (value, prefixAlias = false) {
    return super.wrap(
      value instanceof Fluent ? value.get('name') : value, prefixAlias
    )
  }

  /**
   * Wrap a table in keyword identifiers.
   *
   * @param  {any}  table
   * @return {string}
   */
  wrapTable (table) {
    return super.wrapTable(
      table instanceof Blueprint ? table.getTable() : table
    )
  }
}

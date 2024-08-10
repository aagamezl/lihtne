import BaseGrammar from '../../Grammar.js'
import Blueprint from '../Blueprint.js'
import Fluent from '../../../Support/Fluent.js'
import { CustomException, ucfirst } from '../../../Support/helpers.js'
import { Expression } from '../../Query/internal.js'

/** @typedef {import('../../Connection.js').default} Connection */

export default class Grammar extends BaseGrammar {
  /**
   * The possible column modifiers.
   *
   * @protected
   * @type {string[]}
   */
  modifiers = []

  /**
   * If this Grammar supports schema changes wrapped in a transaction.
   *
   * @protected
   * @type {boolean}
   */
  transactions = false

  /**
   * The commands to be executed outside of create or alter command.
   * @protected
   * @type {string[]}
   */
  fluentCommands = []

  constructor () {
    super()

    if (new.target === Grammar) {
      throw CustomException('abstract')
    }
  }

  /**
   * Compile a create database command.
   *
   * @param {string} name
   * @param {Connection} connection
   * @throws {Error}
   */
  compileCreateDatabase (name, connection) {
    throw new Error('LogicException: This database driver does not support creating databases.')
  }

  /**
   * Compile a drop database if exists command.
   *
   * @param {string} name
   * @throws {Error}
   */
  compileDropDatabaseIfExists (name) {
    throw new Error('LogicException: This database driver does not support dropping databases.')
  }

  /**
   * Compile a rename column command.
   *
   * @param {Blueprint} blueprint
   * @param {Fluent} command
   * @param {Connection} connection
   * @returns {string}
   */
  compileRenameColumn (blueprint, command, connection) {
    return `alter table ${this.wrapTable(blueprint)} rename column ${this.wrap(command.get('from'))} to ${this.wrap(command.get('to'))}`
  }

  /**
   * Compile a change column command into a series of SQL statements.
   *
   * @param {Blueprint} blueprint
   * @param {Fluent} command
   * @param {Connection} connection
   * @throws {Error}
   */
  compileChange (blueprint, command, connection) {
    throw new Error('LogicException: This database driver does not support modifying columns.')
  }

  /**
   * Compile a fulltext index key command.
   *
   * @param {Blueprint} blueprint
   * @param {Fluent} command
   * @throws {Error}
   */
  compileFulltext (blueprint, command) {
    throw new Error('RuntimeException: This database driver does not support fulltext index creation.')
  }

  /**
   * Compile a drop fulltext index command.
   *
   * @param {Blueprint} blueprint
   * @param {Fluent} command
   * @throws {Error}
   */
  compileDropFullText (blueprint, command) {
    throw new Error('RuntimeException: This database driver does not support fulltext index removal.')
  }

  /**
   * Compile a foreign key command.
   *
   * @param {Blueprint} blueprint
   * @param {Fluent} command
   * @returns {string}
   */
  compileForeign (blueprint, command) {
    // We need to prepare several of the elements of the foreign key definition
    // before we can create the SQL, such as wrapping the tables and convert
    // an array of columns to comma-delimited strings for the SQL queries.
    let sql = `alter table ${this.wrapTable(blueprint)} add constraint ${this.wrap(command.get('index'))} `

    // Once we have the initial portion of the SQL statement we will add on the
    // key name, table name, and referenced columns. These will complete the
    // main portion of the SQL statement and this SQL will almost be done.
    sql += `foreign key (${this.columnize(command.get('columns'))}) references ${this.wrapTable(command.get('on'))} (${this.columnize(command.get('references'))})`

    // Once we have the basic foreign key creation statement constructed we can
    // build out the syntax for what should happen on an update or delete of
    // the affected columns, which will get something like "cascade", etc.
    if (command.get('onDelete') !== null) {
      sql += ` on delete ${command.get('onDelete')}`
    }

    if (command.get('onUpdate') !== null) {
      sql += ` on update ${command.get('onUpdate')}`
    }

    return sql
  }

  /**
   * Compile a drop foreign key command.
   *
   * @param {Blueprint} blueprint
   * @param {Fluent} command
   * @returns {string}
   * @throws {RuntimeException} This database driver does not support dropping foreign keys.
   */
  compileDropForeign (blueprint, command) {
    throw new Error('RuntimeException: This database driver does not support dropping foreign keys.')
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
   * Compile the column definition.
   *
   * @protected
   * @param {Blueprint} blueprint
   * @param {import('../ColumnDefinition.js').default} column
   * @returns {string}
   */
  getColumn (blueprint, column) {
    // Each of the column types has their own compiler functions, which are tasked
    // with turning the column definition into its SQL format for this platform
    // used by the connection. The column's modifiers are compiled and added.
    const sql = this.wrap(column) + ' ' + this.getType(column)

    return this.addModifiers(sql, blueprint, column)
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
   * Create the column definition for a generated, computed column type.
   *
   * @protected
   * @param {Object} column - The column definition object.
   * @throws {Error}
   */
  typeComputed (column) {
    throw new Error('RuntimeException: This database driver does not support the computed type.')
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
   * Get the command with a given name if it exists on the blueprint.
   *
   * @protected
   * @param {Blueprint} blueprint - The blueprint object.
   * @param {string} name - The command name.
   * @return {Fluent|null}
   */
  getCommandByName (blueprint, name) {
    const commands = this.getCommandsByName(blueprint, name)

    return commands.length > 0 ? commands[0] : null
  }

  /**
   * Get all of the commands with a given name.
   *
   * @protected
   * @param {Blueprint} blueprint - The blueprint object.
   * @param {string} name - The command name.
   * @return {Array}
   */
  getCommandsByName (blueprint, name) {
    return blueprint.getCommands().filter(value => value.get('name') === name)
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
   * Format a value so that it can be used in "default" clauses.
   *
   * @protected
   * @param {any} value
   * @return {string}
   */
  getDefaultValue (value) {
    if (value instanceof Expression) {
      return this.getValue(value)
    }

    // if (value instanceof BackedEnum) {
    //   return `'${value.value}'`
    // }

    return typeof value === 'boolean'
      ? `'${Number(value)}'`
      : `'${String(value)}'`
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
   * Check if this Grammar supports schema changes wrapped in a transaction.
   *
   * @return {boolean}
   */
  supportsSchemaTransactions () {
    return this.transactions
  }
}

import { isNil } from '@devnetic/utils'

import { tap } from '../../Support/helpers.js'
import Blueprint from './Blueprint.js'

/** @typedef {import('../Connection.js').default} Connection */
/** @typedef {import('./Grammars/Grammar.js').default} Grammar */

export default class Builder {
  /**
   * The database connection instance.
   *
   * @protected
   * @type {import('../Connection.js').default}
   */
  connection

  /**
   * The schema grammar instance.'
   *
   * @protected
   * @type {Grammar}
   */
  grammar

  /**
   * The Blueprint resolver callback.
   *
   * @protected
   * @type {Function}
   */
  resolver

  /**
   * The default string length for migrations.
   *
   * @type {number|undefined}
   */
  static defaultStringLengthProperty = 255

  /**
   * The default relationship morph key type.
   *
   * @type {string}
   */
  static defaultMorphKeyTypeProperty = 'int'

  /**
   * Create a new database Schema manager.
   *
   * @param  {import('../Connection.js').default}  connection
   */
  constructor (connection) {
    this.connection = connection
    this.grammar = connection.getSchemaGrammar()
  }

  /**
   * Set the default string length for migrations.
   *
   * @param  {number}  length
   * @return {void}
   */
  static defaultStringLength (length) {
    this.defaultStringLengthProperty = length
  }

  /**
   * Set the default morph key type for migrations.
   *
   * @param  {string}  type
   * @return {void}
   *
   * @throws {InvalidArgumentException}
   */
  static defaultMorphKeyType (type) {
    if (!['int', 'uuid', 'ulid'].includes(type)) {
      throw new Error("InvalidArgumentException: Morph key type must be 'int', 'uuid', or 'ulid'.")
    }

    this.defaultMorphKeyTypeProperty = type
  }

  /**
   * Set the default morph key type for migrations to UUIDs.
   *
   * @return {void}
   */
  static morphUsingUuids () {
    return this.defaultMorphKeyType('uid')
  }

  /**
   * Set the default morph key type for migrations to ULIDs.
   *
   * @return {void}
   */
  static morphUsingUlids () {
    return this.defaultMorphKeyType('ulid')
  }

  /**
   * Create a database in the schema.
   *
   * @param  {string}  name
   * @return {boolean}
   *
   * @throws {LogicException}
   */
  createDatabase (name) {
    throw new Error('LogicException: This database driver does not support creating databases.')
  }

  /**
   * Drop a database from the schema if the database exists.
   *
   * @param  {string}  name
   * @return {boolean}
   *
   * @throws {LogicException}
   */
  dropDatabaseIfExists (name) {
    throw new Error('LogicException: This database driver does not support dropping databases.')
  }

  /**
   * Determine if the given table exists.
   *
   * @param  {string}  table
   * @return {Promise<boolean>}
   */
  async hasTable (table) {
    table = this.connection.getTablePrefix() + table

    const tables = await this.getTables(false)

    for (const value of tables) {
      if (table.toLowerCase() === value.name.toLowerCase()) {
        return true
      }
    }

    return false
  }

  /**
   * Determine if the given view exists.
   *
   * @param  {string}  view
   * @return {Promise<boolean>}
   */
  async hasView (view) {
    view = this.connection.getTablePrefix() + view

    const views = await this.getViews()

    for (const value of views) {
      if (view.toLowerCase() === value.name.toLowerCase()) {
        return true
      }
    }

    return false
  }

  /**
   * Get the tables that belong to the database.
   *
   * @return {Promise<string[]>}
   */
  async getTables () {
    return this.connection.getPostProcessor().processTables(
      await this.connection.select(this.grammar.compileTables())
    )
  }

  /**
   * Get the names of the tables that belong to the database.
   *
   * @return {Promise<string[]>}
   */
  async getTableListing () {
    const tables = await this.getTables()

    return tables.reduce((names, table) => {
      names.push(table.name)

      return names
    }, [])
  }

  /**
   * Get the views that belong to the database.
   *
   * @return {Promise<array>}
   */
  async getViews () {
    return this.connection.getPostProcessor().processViews(
      await this.connection.select(this.grammar.compileViews())
    )
  }

  /**
   * Get the user-defined types that belong to the database.
   *
   * @return {Array}
   */
  getTypes () {
    throw new Error('LogicException: This database driver does not support user-defined types.')
  }

  /**
   * Determine if the given table has a given column.
   *
   * @param  {string}  table
   * @param  {string}  column
   * @return {Promise<boolean>}
   */
  async hasColumn (table, column) {
    const columns = await this.getColumnListing(table)

    return columns
      .map(column => column.toLowerCase())
      .includes(column.toLowerCase())
  }

  /**
   * Determine if the given table has given columns.
   *
   * @param  {string}  table
   * @param  {string[]}  columns
   * @return {Promise<boolean>}
   */
  async hasColumns (table, columns) {
    const tableColumns = (await this.getColumnListing(table)).map(column => column.toLowerCase())

    for (const column of columns) {
      if (!tableColumns.includes(column.toLowerCase())) {
        return false
      }
    }

    return true
  }

  /**
   * Execute a table builder callback if the given table has a given column.
   *
   * @param  {string}  table
   * @param  {string}  column
   * @param  {Function}  callback
   * @return {Promise<void>}
   */
  async whenTableHasColumn (table, column, callback) {
    const hasColumn = await this.hasColumn(table, column)

    if (hasColumn) {
      this.table(table, (table) => callback(table))
    }
  }

  /**
   * Execute a table builder callback if the given table doesn't have a given column.
   *
   * @param  {string}  table
   * @param  {string}  column
   * @param  {Function}  callback
   * @return {Promise<void>}
   */
  async whenTableDoesntHaveColumn (table, column, callback) {
    const hasColumn = await this.hasColumn(table, column)

    if (!hasColumn) {
      this.table(table, (table) => callback(table))
    }
  }

  /**
   * Get the data type for the given column name.
   *
   * @param  {string}  table
   * @param  {string}  column
   * @param  {boolean}  [fullDefinition=false]
   * @return {Promise<string>}
   */
  async getColumnType (table, column, fullDefinition = false) {
    const columns = await this.getColumns(table)

    for (const value of columns) {
      if (value.name.toLowerCase() === column.toLowerCase()) {
        return fullDefinition ? value.type : value.type_name
      }
    }

    throw new Error(`InvalidArgumentException: There is no column with name '${column}' on table '${table}'.`)
  }

  /**
   * Get the column listing for a given table.
   *
   * @param  {string}  table
   * @return {Promise<string[]>}
   */
  async getColumnListing (table) {
    const columnList = await this.getColumns(table)

    return columnList.reduce((columns, column) => {
      columns.push(column.name)

      return columns
    }, [])
  }

  /**
   * Get the columns for a given table.
   *
   * @param  {string}  table
   * @return {Promise<Array<Record<string, any>>>}
   */
  async getColumns (table) {
    table = this.connection.getTablePrefix() + table

    return this.connection.getPostProcessor().processColumns(
      await this.connection.select(this.grammar.compileColumns(table))
    )
  }

  /**
   * Get the indexes for a given table.
   *
   * @param  {string}  table
   * @return {Promise<Array<Record<string, string>>>}
   */
  async getIndexes (table) {
    table = this.connection.getTablePrefix() + table

    return this.connection.getPostProcessor().processIndexes(
      await this.connection.select(this.grammar.compileIndexes(table))
    )
  }

  /**
   * Get the names of the indexes for a given table.
   *
   * @param  {string}  table
   * @return {Promise<string[]>}
   */
  async getIndexListing (table) {
    const indexes = await this.getIndexes(table)

    return indexes.reduce((result, index) => {
      result.push(index.name)

      return result
    }, [])
  }

  /**
   * Determine if the given table has a given index.
   *
   * @param  {string}  table
   * @param  {string|array}  index
   * @param  {string|null}  type
   * @return {Promise<boolean>}
   */
  async hasIndex (table, index, type = null) {
    type = isNil(type) ? type : type.toLowerCase()

    const indexes = await this.getIndexes(table)

    for (const value of indexes) {
      const typeMatches = isNil(type) ||
        (type === 'primary' && value.primary) ||
        (type === 'unique' && value.unique) ||
        type === value.type

      if ((value.name === index || value.columns === index) && typeMatches) {
        return true
      }
    }

    return false
  }

  /**
   * Get the foreign keys for a given table.
   *
   * @param  {string}  table
   * @return {Promise<string[]>}
   */
  async getForeignKeys (table) {
    table = this.connection.getTablePrefix() + table

    return this.connection.getPostProcessor().processForeignKeys(
      await this.connection.select(this.grammar.compileForeignKeys(table))
    )
  }

  /**
   * Modify a table on the schema.
   *
   * @param  {string}  table
   * @param  {Function}  callback
   * @return {void}
   */
  table (table, callback) {
    this.build(this.createBlueprint(table, callback))
  }

  /**
   * Create a new table on the schema.
   *
   * @param  {string}  table
   * @param  {Function}  callback
   * @return {void}
   */
  create (table, callback) {
    this.build(tap(this.createBlueprint(table), (blueprint) => {
      blueprint.create()

      callback(blueprint)
    }))
  }

  /**
   * Drop a table from the schema.
   *
   * @param  {string}  table
   * @return {void}
   */
  drop (table) {
    this.build(tap(this.createBlueprint(table), (blueprint) => {
      blueprint.drop()
    }))
  }

  /**
   * Drop a table from the schema if it exists.
   *
   * @param  {string}  table
   * @return {void}
   */
  dropIfExists (table) {
    this.build(tap(this.createBlueprint(table), (blueprint) => {
      blueprint.dropIfExists()
    }))
  }

  /**
   * Drop columns from a table schema.
   *
   * @param  {string}  table
   * @param  {string|array}  columns
   * @return {void}
   */
  dropColumns (table, columns) {
    this.table(table, (blueprint) => {
      blueprint.dropColumn(columns)
    })
  }

  /**
   * Drop all tables from the database.
   *
   * @return {void}
   *
   * @throws {LogicException}
   */
  dropAllTables () {
    throw new Error('LogicException: This database driver does not support dropping all tables.')
  }

  /**
   * Drop all views from the database.
   *
   * @return {void}
   *
   * @throws {LogicException}
   */
  dropAllViews () {
    throw new Error('LogicException: This database driver does not support dropping all views.')
  }

  /**
   * Drop all types from the database.
   *
   * @return {void}
   *
   * @throws {LogicException}
   */
  dropAllTypes () {
    throw new Error('LogicException: This database driver does not support dropping all types.')
  }

  /**
   * Rename a table on the schema.
   *
   * @param  {string}  from
   * @param  {string}  to
   * @return {void}
   */
  rename (from, to) {
    this.build(tap(this.createBlueprint(from), (blueprint) => {
      blueprint.rename(to)
    }))
  }

  /**
   * Enable foreign key constraints.
   *
   * @return {Promise<boolean>}
   */
  enableForeignKeyConstraints () {
    return this.connection.statement(
      this.grammar.compileEnableForeignKeyConstraints()
    )
  }

  /**
   * Disable foreign key constraints.
   *
   * @return {Promise<boolean>}
   */
  disableForeignKeyConstraints () {
    return this.connection.statement(
      this.grammar.compileDisableForeignKeyConstraints()
    )
  }

  /**
   * Disable foreign key constraints during the execution of a callback.
   *
   * @param  {Function}  callback
   * @return {any}
   */
  withoutForeignKeyConstraints (callback) {
    this.disableForeignKeyConstraints()

    try {
      return callback()
    } finally {
      this.enableForeignKeyConstraints()
    }
  }

  /**
   * Execute the blueprint to build / modify the table.
   *
   * @protected
   * @param  {Blueprint}  blueprint
   * @return {void}
   */
  build (blueprint) {
    blueprint.build(this.connection, this.grammar)
  }

  /**
   * Create a new command set with a Closure.
   *
   * @protected
   * @param  {string}  table
   * @param  {Function|null}  [callback]
   * @return {Blueprint}
   */
  createBlueprint (table, callback = null) {
    const prefix = this.connection.getConfig('prefix_indexes')
      ? this.connection.getConfig('prefix')
      : ''

    if (!isNil(this.resolver)) {
      return this.resolver(table, callback, prefix)
    }

    return new Blueprint(table, callback, prefix)
  }

  /**
   * Get the database connection instance.
   *
   * @return {Connection}
   */
  getConnection () {
    return this.connection
  }

  /**
   * Set the database connection instance.
   *
   * @param  {Connection}  connection
   * @return {this}
   */
  setConnection (connection) {
    this.connection = connection

    return this
  }

  /**
   * Set the Schema Blueprint resolver callback.
   *
   * @param  {Function}  resolver
   * @return {void}
   */
  blueprintResolver (resolver) {
    this.resolver = resolver
  }
}

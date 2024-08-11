import { format } from 'node:util'

import { isNil } from '@devnetic/utils'

import Grammar from '../../Grammar.js'
import { addslashes, match, versionCompare } from '../../../Support/helpers.js'
import { collect } from '../../../Collections/helpers.js'
import ColumnDefinition from '../ColumnDefinition.js'
import { Expression } from '../../Query/internal.js'

/** @typedef {import('../Blueprint.js').default} Blueprint */
/** @typedef {import('../../Connection.js').default} Connection */
/** @typedef {import('../../../Support/Fluent.js').default} Fluent */

export default class MySqlGrammar extends Grammar {
  /**
   * The possible column modifiers.
   *
   * @protected
   * @type {string[]}
   */
  modifiers = [
    'Unsigned', 'Charset', 'Collate', 'VirtualAs', 'StoredAs', 'Nullable',
    'Default', 'OnUpdate', 'Invisible', 'Increment', 'Comment', 'After', 'First'
  ]

  /**
   * The possible column serials.
   *
   * @protected
   * @type {string[]}
   */
  serials = ['bigInteger', 'integer', 'mediumInteger', 'smallInteger', 'tinyInteger']

  /**
   * The commands to be executed outside of create or alter command.
   *
   * @protected
   * @type {string[]}
   */
  fluentCommands = ['AutoIncrementStartingValues']

  /**
   * Compile a create database command.
   *
   * @param  {string}  name
   * @param  {Connection}  connection
   * @return {string}
   */
  compileCreateDatabase (name, connection) {
    const charset = connection.getConfig('charset')
    const collation = connection.getConfig('collation')

    if (!charset || !collation) {
      return `create database ${this.wrapValue(name)}`
    }

    return format(
      'create database %s default character set %s default collate %s',
      this.wrapValue(name),
      this.wrapValue(charset),
      this.wrapValue(collation)
    )
  }

  /**
   * Compile a drop database if exists command.
   *
   * @param  {string}  name
   * @return {string}
   */
  compileDropDatabaseIfExists (name) {
    return format(
      'drop database if exists %s',
      this.wrapValue(name)
    )
  }

  /**
   * Compile the query to determine the tables.
   *
   * @param  {string}  database
   * @return {string}
   */
  compileTables (database) {
    return format(
      'select table_name as `name`, (data_length + index_length) as `size`, ' +
      'table_comment as `comment`, engine as `engine`, table_collation as `collation` ' +
      "from information_schema.tables where table_schema = %s and table_type in ('BASE TABLE', 'SYSTEM VERSIONED') " +
      'order by table_name',
      this.quoteString(database)
    )
  }

  /**
   * Compile the query to determine the views.
   *
   * @param  {string}  database
   * @return {string}
   */
  compileViews (database) {
    return format(
      'select table_name as `name`, view_definition as `definition` ' +
      'from information_schema.views where table_schema = %s ' +
      'order by table_name',
      this.quoteString(database)
    )
  }

  /**
   * Compile the query to determine the columns.
   *
   * @param  {string}  database
   * @param  {string}  table
   * @return {string}
   */
  compileColumns (database, table) {
    return format(
      'select column_name as `name`, data_type as `type_name`, column_type as `type`, ' +
      'collation_name as `collation`, is_nullable as `nullable`, ' +
      'column_default as `default`, column_comment as `comment`, ' +
      'generation_expression as `expression`, extra as `extra` ' +
      'from information_schema.columns where table_schema = %s and table_name = %s ' +
      'order by ordinal_position asc',
      this.quoteString(database),
      this.quoteString(table)
    )
  }

  /**
   * Compile the query to determine the indexes.
   *
   * @param  {string}  database
   * @param  {string}  table
   * @return {string}
   */
  compileIndexes (database, table) {
    return format(
      'select index_name as `name`, group_concat(column_name order by seq_in_index) as `columns`, ' +
      'index_type as `type`, not non_unique as `unique` ' +
      'from information_schema.statistics where table_schema = %s and table_name = %s ' +
      'group by index_name, index_type, non_unique',
      this.quoteString(database),
      this.quoteString(table)
    )
  }

  /**
   * Compile the query to determine the foreign keys.
   *
   * @param  {string}  database
   * @param  {string}  table
   * @return {string}
   */
  compileForeignKeys (database, table) {
    return format(
      'select kc.constraint_name as `name`, ' +
      'group_concat(kc.column_name order by kc.ordinal_position) as `columns`, ' +
      'kc.referenced_table_schema as `foreign_schema`, ' +
      'kc.referenced_table_name as `foreign_table`, ' +
      'group_concat(kc.referenced_column_name order by kc.ordinal_position) as `foreign_columns`, ' +
      'rc.update_rule as `on_update`, ' +
      'rc.delete_rule as `on_delete` ' +
      'from information_schema.key_column_usage kc join information_schema.referential_constraints rc ' +
      'on kc.constraint_schema = rc.constraint_schema and kc.constraint_name = rc.constraint_name ' +
      'where kc.table_schema = %s and kc.table_name = %s and kc.referenced_table_name is not null ' +
      'group by kc.constraint_name, kc.referenced_table_schema, kc.referenced_table_name, rc.update_rule, rc.delete_rule',
      this.quoteString(database),
      this.quoteString(table)
    )
  }

  /**
   * Compile a create table command.
   *
   * @param  {Blueprint}  blueprint
   * @param  {Fluent}  command
   * @param  {Connection}  connection
   * @return {string}
   */
  compileCreate (blueprint, command, connection) {
    let sql = this.compileCreateTable(
      blueprint, command, connection
    )

    // Once we have the primary SQL, we can add the encoding option to the SQL for
    // the table.  Then, we can check if a storage engine has been supplied for
    // the table. If so, we will add the engine declaration to the SQL query.
    sql = this.compileCreateEncoding(
      sql, connection, blueprint
    )

    // Finally, we will append the engine configuration onto this SQL statement as
    // the final thing we do before returning this finished SQL. Once this gets
    // added the query will be ready to execute against the real connections.
    return this.compileCreateEngine(sql, connection, blueprint)
  }

  /**
   * Create the main create table clause.
   *
   * @protected
   * @param  {Blueprint}  blueprint
   * @param  {Fluent}  command
   * @param  {Connection}  connection
   * @return {string}
   */
  compileCreateTable (blueprint, command, connection) {
    const tableStructure = this.getColumns(blueprint)
    const primaryKey = this.getCommandByName(blueprint, 'primary')

    if (primaryKey) {
      tableStructure.push(format(
        'primary key %s(%s)',
        primaryKey.get('algorithm') ? 'using ' + primaryKey.get('algorithm') : '',
        this.columnize(primaryKey.get('columns'))
      ))

      primaryKey.set('shouldBeSkipped', true)
    }

    // return `${blueprint.temporaryProperty ? 'create temporary' : 'create'} table ${this.wrapTable(blueprint)} (${tableStructure.join(', ')})`
    return format('%s table %s (%s)',
      blueprint.temporaryProperty ? 'create temporary' : 'create',
      this.wrapTable(blueprint),
      tableStructure.join(', ')
    )
  }

  /**
   * Append the character set specifications to a command.
   *
   * @protected
   * @param  {string}  sql
   * @param  {Connection}  connection
   * @param  {Blueprint}  blueprint
   * @return {string}
   */
  compileCreateEncoding (sql, connection, blueprint) {
    // First we will set the character set if one has been set on either the create
    // blueprint itself or on the root configuration for the connection that the
    // table is being created on. We will add these to the create table query.
    if (!isNil(blueprint.charsetProperty)) {
      sql += ' default character set ' + blueprint.charsetProperty
    } else {
      const charset = connection.getConfig('charset')

      if (!isNil(charset)) {
        sql += ' default character set ' + charset
      }
    }

    // Next we will add the collation to the create table statement if one has been
    // added to either this create table blueprint or the configuration for this
    // connection that the query is targeting. We'll add it to this SQL query.
    if (!isNil(blueprint.collation)) {
      sql += ` collate '${blueprint.collation}'`
    } else {
      const collation = connection.getConfig('collation')

      if (!isNil(collation)) {
        sql += ` collate '${collation}'`
      }
    }

    return sql
  }

  /**
   * Append the engine specifications to a command.
   *
   * @protected
   * @param {string} sql
   * @param {Connection} connection
   * @param {Blueprint} blueprint
   * @return {string}
   */
  compileCreateEngine (sql, connection, blueprint) {
    if (blueprint.engineProperty !== undefined) {
      return `${sql} engine = ${blueprint.engineProperty}`
    } else if (connection.getConfig('engine') !== null) {
      const engine = connection.getConfig('engine')
      return `${sql} engine = ${engine}`
    }

    return sql
  }

  /**
   * Compile an add column command.
   *
   * @public
   * @param {Blueprint} blueprint
   * @param {Fluent} command
   * @return {string}
   */
  compileAdd (blueprint, command) {
    return format('alter table %s add %s',
      this.wrapTable(blueprint),
      this.getColumn(blueprint, command.get('column'))
    )
  }

  /**
   * Compile the auto-incrementing column starting values.
   *
   * @param  {Blueprint}  blueprint
   * @param  {Fluent}  command
   * @return {string|void}
   */
  compileAutoIncrementStartingValues (blueprint, command) {
    if (command.get('column').get('autoIncrement') && (command.get('column').get('startingValue') || command.get('column').get('from'))) {
      return `alter table ${this.wrapTable(blueprint)} auto_increment = ${command.get('column').get('startingValue')}`
    }
  }

  /**
   * Compile a rename column command.
   *
   * @param  {Blueprint}  blueprint
   * @param  {Fluent}  command
   * @param  {Connection}  connection
   * @return {array|string}
   */
  compileRenameColumn (blueprint, command, connection) {
    const version = connection.getServerVersion()

    if ((connection.isMaria() && versionCompare(version, '10.5.2', '<')) ||
      (!connection.isMaria() && versionCompare(version, '8.0.3', '<'))) {
      return this.compileLegacyRenameColumn(blueprint, command, connection)
    }

    return super.compileRenameColumn(blueprint, command, connection)
  }

  /**
   * Compile a rename column command for legacy versions of MySQL.
   *
   * @protected
   * @param  {Blueprint}  blueprint
   * @param  {Fluent}  command
   * @param  {Connection}  connection
   * @return {string}
   */
  compileLegacyRenameColumn (blueprint, command, connection) {
    const column = collect(connection.getSchemaBuilder().getColumns(blueprint.getTable()))
      .firstWhere('name', command.get('from'))

    const modifiers = this.addModifiers(column.type, blueprint, new ColumnDefinition({
      change: true,
      type: match(column.type_name, {
        bigint: 'bigInteger',
        int: 'integer',
        mediumint: 'mediumInteger',
        smallint: 'smallInteger',
        tinyint: 'tinyInteger',
        default: column.type_name
      }),
      nullable: column.nullable,
      default: column.default && (column.default.toLowerCase().startsWith('current_timestamp') || column.default === 'NULL')
        ? new Expression(column.default)
        : column.default,
      autoIncrement: column.auto_increment,
      collation: column.collation,
      comment: column.comment,
      virtualAs: !isNil(column.generation) && column.generation.type === 'virtual'
        ? column.generation.expression
        : null,
      storedAs: !isNil(column.generation) && column.generation.type === 'stored'
        ? column.generation.expression
        : null
    }))

    return format('alter table %s change %s %s %s',
      this.wrapTable(blueprint),
      this.wrap(command.get('from')),
      this.wrap(command.get('to')),
      modifiers
    )
  }

  /**
   * Compile a change column command into a series of SQL statements.
   *
   * @param  {Blueprint}  blueprint
   * @param  {Fluent}  command
   * @param  {Connection}  connection
   * @return {array|string}
   *
   * @throws {RuntimeException}
   */
  compileChange (blueprint, command, connection) {
    const column = command.get('column')

    // const sql = `alter table ${this.wrapTable(blueprint)} ${isNil(column.renameTo) ? 'modify' : 'change'} ${this.wrap(column)}${isNil(column.renameTo) ? '' : ' ' + this.wrap(column.renameTo)} ${this.getType(column)}`
    const sql = format('alter table %s %s %s%s %s',
      this.wrapTable(blueprint),
      isNil(column.renameTo) ? 'modify' : 'change',
      this.wrap(column),
      isNil(column.renameTo) ? '' : ' '.this.wrap(column.renameTo),
      this.getType(column)
    )

    return this.addModifiers(sql, blueprint, column)
  }

  /**
   * Compile a primary key command.
   *
   * @param  {Blueprint}  blueprint
   * @param  {Fluent}  command
   * @return {string}
   */
  compilePrimary (blueprint, command) {
    return format('alter table %s add primary key %s(%s)',
      this.wrapTable(blueprint),
      command.get('algorithm') ? 'using ' + command.get('algorithm') : '',
      this.columnize(command.get('columns'))
    )
  }

  /**
   * Compile a unique key command.
   *
   * @param  {Blueprint}  blueprint
   * @param  {Fluent}  command
   * @return {string}
   */
  compileUnique (blueprint, command) {
    return this.compileKey(blueprint, command, 'unique')
  }

  /**
   * Compile a plain index key command.
   *
   * @param  {Blueprint}  blueprint
   * @param  {Fluent}  command
   * @return {string}
   */
  compileIndex (blueprint, command) {
    return this.compileKey(blueprint, command, 'index')
  }

  /**
   * Compile a fulltext index key command.
   *
   * @param  {Blueprint}  blueprint
   * @param  {Fluent}  command
   * @return {string}
   */
  compileFullText (blueprint, command) {
    return this.compileKey(blueprint, command, 'fulltext')
  }

  /**
   * Compile a spatial index key command.
   *
   * @param  {Blueprint}  blueprint
   * @param  {Fluent}  command
   * @return {string}
   */
  compileSpatialIndex (blueprint, command) {
    return this.compileKey(blueprint, command, 'spatial index')
  }

  /**
   * Compile an index creation command.
   *
   * @protected
   * @param  {Blueprint}  blueprint
   * @param  {Fluent}  command
   * @param  {string}  type
   * @return {string}
   */
  compileKey (blueprint, command, type) {
    return format('alter table %s add %s %s%s(%s)',
      this.wrapTable(blueprint),
      type,
      this.wrap(command.get('index')),
      command.get('algorithm') ? ' using ' + command.get('algorithm') : '',
      this.columnize(command.get('columns'))
    )
  }

  /**
   * Compile a drop table command.
   *
   * @param  {Blueprint}  blueprint
   * @param  {Fluent}  command
   * @return {string}
   */
  compileDrop (blueprint, command) {
    return 'drop table ' + this.wrapTable(blueprint)
  }

  /**
   * Compile a drop table (if exists) command.
   *
   * @param  {Blueprint}  blueprint
   * @param  {Fluent}  command
   * @return {string}
   */
  compileDropIfExists (blueprint, command) {
    return 'drop table if exists ' + this.wrapTable(blueprint)
  }

  /**
   * Compile a drop column command.
   *
   * @param  {Blueprint}  blueprint
   * @param  {Fluent}  command
   * @return {string}
   */
  compileDropColumn (blueprint, command) {
    const columns = this.prefixArray('drop', this.wrapArray(command.columns))

    return 'alter table ' + this.wrapTable(blueprint) + ' ' + columns.join(', ')
  }

  /**
   * Compile a drop primary key command.
   *
   * @param  {Blueprint}  blueprint
   * @param  {Fluent}  command
   * @return {string}
   */
  compileDropPrimary (blueprint, command) {
    return 'alter table ' + this.wrapTable(blueprint) + ' drop primary key'
  }

  /**
   * Compile a drop unique key command.
   *
   * @param  {Blueprint}  blueprint
   * @param  {Fluent}  command
   * @return {string}
   */
  compileDropUnique (blueprint, command) {
    const index = this.wrap(command.get('index'))

    return `alter table ${this.wrapTable(blueprint)} drop index ${index}`
  }

  /**
   * Compile a drop index command.
   *
   * @param  {Blueprint}  blueprint
   * @param  {Fluent}  command
   * @return {string}
   */
  compileDropIndex (blueprint, command) {
    const index = this.wrap(command.get('index'))

    return `alter table ${this.wrapTable(blueprint)} drop index ${index}`
  }

  /**
   * Compile a drop fulltext index command.
   *
   * @param  {Blueprint}  blueprint
   * @param  {Fluent}  command
   * @return {string}
   */
  compileDropFullText (blueprint, command) {
    return this.compileDropIndex(blueprint, command)
  }

  /**
   * Compile a drop spatial index command.
   *
   * @param  {Blueprint}  blueprint
   * @param  {Fluent}  command
   * @return {string}
   */
  compileDropSpatialIndex (blueprint, command) {
    return this.compileDropIndex(blueprint, command)
  }

  /**
   * Compile a drop foreign key command.
   *
   * @param  {Blueprint}  blueprint
   * @param  {Fluent}  command
   * @return {string}
   */
  compileDropForeign (blueprint, command) {
    const index = this.wrap(command.get('index'))

    return `alter table ${this.wrapTable(blueprint)} drop foreign key ${index}`
  }

  /**
   * Compile a rename table command.
   *
   * @param  {Blueprint}  blueprint
   * @param  {Fluent}  command
   * @return {string}
   */
  compileRename (blueprint, command) {
    const from = this.wrapTable(blueprint)

    return `rename table ${from} to ` + this.wrapTable(command.get('to'))
  }

  /**
   * Compile a rename index command.
   *
   * @param  {Blueprint}  blueprint
   * @param  {Fluent}  command
   * @return {string}
   */
  compileRenameIndex (blueprint, command) {
    return format('alter table %s rename index %s to %s',
      this.wrapTable(blueprint),
      this.wrap(command.get('from')),
      this.wrap(command.get('to'))
    )
  }

  /**
   * Compile the SQL needed to drop all tables.
   *
   * @param  {string[]}  tables
   * @return {string}
   */
  compileDropAllTables (tables) {
    return 'drop table ' + this.wrapArray(tables).join(',')
  }

  /**
   * Compile the SQL needed to drop all views.
   *
   * @param  {string[]}  views
   * @return {string}
   */
  compileDropAllViews (views) {
    return 'drop view ' + this.wrapArray(views).join(',')
  }

  /**
   * Compile the command to enable foreign key constraints.
   *
   * @return {string}
   */
  compileEnableForeignKeyConstraints () {
    return 'SET FOREIGN_KEY_CHECKS=1;'
  }

  /**
   * Compile the command to disable foreign key constraints.
   *
   * @return {string}
   */
  compileDisableForeignKeyConstraints () {
    return 'SET FOREIGN_KEY_CHECKS=0;'
  }

  /**
   * Compile a table comment command.
   *
   * @param  {Blueprint}  blueprint
   * @param  {Fluent}  command
   * @return {string}
   */
  compileTableComment (blueprint, command) {
    return format('alter table %s comment = %s',
      this.wrapTable(blueprint),
      "'" + command.get('comment').replace("'", "''") + "'"
    )
  }

  /**
   * Create the column definition for a char type.
   *
   * @protected
   * @param  {Fluent}  column
   * @return {string}
   */
  typeChar (column) {
    return `char(${column.get('length')})`
  }

  /**
   * Create the column definition for a string type.
   *
   * @protected
   * @param  {Fluent}  column
   * @return {string}
   */
  typeString (column) {
    return `varchar(${column.get('length')})`
  }

  /**
   * Create the column definition for a tiny text type.
   *
   * @protected
   * @param  {Fluent}  column
   * @return {string}
   */
  typeTinyText (column) {
    return 'tinytext'
  }

  /**
   * Create the column definition for a text type.
   *
   * @protected
   * @param  {Fluent}  column
   * @return {string}
   */
  typeText (column) {
    return 'text'
  }

  /**
   * Create the column definition for a medium text type.
   *
   * @protected
   * @param  {Fluent}  column
   * @return {string}
   */
  typeMediumText (column) {
    return 'mediumtext'
  }

  /**
   * Create the column definition for a long text type.
   *
   * @protected
   * @param  {Fluent}  column
   * @return {string}
   */
  typeLongText (column) {
    return 'longtext'
  }

  /**
   * Create the column definition for a big integer type.
   *
   * @protected
   * @param  {Fluent}  column
   * @return {string}
   */
  typeBigInteger (column) {
    return 'bigint'
  }

  /**
   * Create the column definition for an integer type.
   *
   * @protected
   * @param  {Fluent}  column
   * @return {string}
   */
  typeInteger (column) {
    return 'int'
  }

  /**
   * Create the column definition for a medium integer type.
   *
   * @protected
   * @param  {Fluent}  column
   * @return {string}
   */
  typeMediumInteger (column) {
    return 'mediumint'
  }

  /**
   * Create the column definition for a tiny integer type.
   *
   * @protected
   * @param  {Fluent}  column
   * @return {string}
   */
  typeTinyInteger (column) {
    return 'tinyint'
  }

  /**
   * Create the column definition for a small integer type.
   *
   * @protected
   * @param  {Fluent}  column
   * @return {string}
   */
  typeSmallInteger (column) {
    return 'smallint'
  }

  /**
   * Create the column definition for a float type.
   *
   * @protected
   * @param  {Fluent}  column
   * @return {string}
   */
  typeFloat (column) {
    if (column.precision) {
      return `float(${column.get('precision')})`
    }

    return 'float'
  }

  /**
   * Create the column definition for a double type.
   *
   * @protected
   * @param  {Fluent}  column
   * @return {string}
   */
  typeDouble (column) {
    return 'double'
  }

  /**
   * Create the column definition for a decimal type.
   *
   * @protected
   * @param  {Fluent}  column
   * @return {string}
   */
  typeDecimal (column) {
    return `decimal(${column.get('total')}, ${column.get('places')})`
  }

  /**
   * Create the column definition for a boolean type.
   *
   * @protected
   * @param  {Fluent}  column
   * @return {string}
   */
  typeBoolean (column) {
    return 'tinyint(1)'
  }

  /**
   * Create the column definition for an enumeration type.
   *
   * @protected
   * @param  {Fluent}  column
   * @return {string}
   */
  typeEnum (column) {
    return format('enum(%s)', this.quoteString(column.get('allowed')))
  }

  /**
   * Create the column definition for a set enumeration type.
   *
   * @protected
   * @param  {Fluent}  column
   * @return {string}
   */
  typeSet (column) {
    return format('set(%s)', this.quoteString(column.get('allowed')))
  }

  /**
   * Create the column definition for a json type.
   *
   * @protected
   * @param  {Fluent}  column
   * @return {string}
   */
  typeJson (column) {
    return 'json'
  }

  /**
   * Create the column definition for a jsonb type.
   *
   * @protected
   * @param  {Fluent}  column
   * @return {string}
   */
  typeJsonb (column) {
    return 'json'
  }

  /**
   * Create the column definition for a date type.
   *
   * @protected
   * @param  {Fluent}  $column
   * @return {string}
   */
  typeDate (column) {
    return 'date'
  }

  /**
   * Create the column definition for a date-time type.
   *
   * @protected
   * @param  {Fluent}  column
   * @return {string}
   */
  typeDateTime (column) {
    const current = column.get('precision') ? `CURRENT_TIMESTAMP(${column.get('precision')})` : 'CURRENT_TIMESTAMP'

    if (column.get('useCurrent')) {
      column.default(new Expression(current))
    }

    if (column.get('useCurrentOnUpdate')) {
      column.onUpdate(new Expression(current))
    }

    return column.get('precision') ? `datetime(${column.get('precision')})` : 'datetime'
  }

  /**
   * Create the column definition for a date-time (with time zone) type.
   *
   * @protected
   * @param  {Fluent}  column
   * @return {string}
   */
  typeDateTimeTz (column) {
    return this.typeDateTime(column)
  }

  /**
   * Create the column definition for a time type.
   *
   * @protected
   * @param  {Fluent}  column
   * @return {string}
   */
  typeTime (column) {
    return column.get('precision') ? `time(${column.get('precision')})` : 'time'
  }

  /**
   * Create the column definition for a time (with time zone) type.
   *
   * @protected
   * @param  {Fluent}  column
   * @return {string}
   */
  typeTimeTz (column) {
    return this.typeTime(column)
  }

  /**
   * Create the column definition for a timestamp type.
   *
   * @protected
   * @param  {Fluent}  column
   * @return {string}
   */
  typeTimestamp (column) {
    const current = column.get('precision') ? `CURRENT_TIMESTAMP(${column.get('precision')})` : 'CURRENT_TIMESTAMP'

    if (column.get('useCurrent')) {
      column.default(new Expression(current))
    }

    if (column.get('useCurrentOnUpdate')) {
      column.onUpdate(new Expression(current))
    }

    return column.get('precision') ? `timestamp(${column.get('precision')})` : 'timestamp'
  }

  /**
   * Create the column definition for a timestamp (with time zone) type.
   *
   * @protected
   * @param  {Fluent}  column
   * @return {string}
   */
  typeTimestampTz (column) {
    return this.typeTimestamp(column)
  }

  /**
   * Create the column definition for a year type.
   *
   * @protected
   * @param  {Fluent}  column
   * @return {string}
   */
  typeYear (column) {
    return 'year'
  }

  /**
   * Create the column definition for a binary type.
   *
   * @protected
   * @param  {Fluent}  column
   * @return {string}
   */
  typeBinary (column) {
    if (column.get('length')) {
      return column.get('fixed') ? `binary(${column.get('length')})` : `varbinary(${column.get('length')})`
    }

    return 'blob'
  }

  /**
   * Create the column definition for a uuid type.
   *
   * @protected
   * @param  {Fluent}  column
   * @return {string}
   */
  typeUuid (column) {
    return 'char(36)'
  }

  /**
   * Create the column definition for an IP address type.
   *
   * @protected
   * @param  {Fluent}  column
   * @return {string}
   */
  typeIpAddress (column) {
    return 'varchar(45)'
  }

  /**
   * Create the column definition for a MAC address type.
   *
   * @protected
   * @param  {Fluent}  column
   * @return {string}
   */
  typeMacAddress (column) {
    return 'varchar(17)'
  }

  /**
   * Create the column definition for a spatial Geometry type.
   *
   * @protected
   * @param  {Fluent}  column
   * @return {string}
   */
  typeGeometry (column) {
    let subtype = column.get('subtype') ? column.get('subtype').toLowerCase() : null

    if (!['point', 'linestring', 'polygon', 'geometrycollection', 'multipoint', 'multilinestring', 'multipolygon'].includes(subtype)) {
      subtype = null
    }

    const geometryType = subtype ?? 'geometry'
    let sridClause = ''

    if (column.get('srid')) {
      if (this.connection?.isMaria?.()) {
        sridClause = ` ref_system_id=${column.get('srid')}`
      } else {
        sridClause = ` srid ${column.get('srid')}`
      }
    }

    return format('%s%s', geometryType, sridClause)
  }

  /**
   * Create the column definition for a spatial Geography type.
   *
   * @protected
   * @param  {Fluent}  column
   * @return {string}
   */
  typeGeography (column) {
    return this.typeGeometry(column)
  }

  /**
   * Create the column definition for a generated, computed column type.
   *
   * @@protected
   * @param  {Fluent}  column
   * @return void
   *
   * @throws \RuntimeException
   */
  typeComputed (column) {
    throw new Error('RuntimeException: This database driver requires a type, see the virtualAs / storedAs modifiers.')
  }

  /**
   * Get the SQL for a generated virtual column modifier.
   *
   * @protected
   * @param  {Blueprint}  blueprint
   * @param  {Fluent}  column
   * @return {string|null}
   */
  modifyVirtualAs (blueprint, column) {
    let virtualAs = column.get('virtualAsJson')

    if (!isNil(virtualAs)) {
      if (this.isJsonSelector(virtualAs)) {
        virtualAs = this.wrapJsonSelector(virtualAs)
      }

      return ` as (${virtualAs})`
    }

    virtualAs = column.get('virtualAs')

    if (!isNil(virtualAs)) {
      return ` as (${this.getValue(virtualAs)})`
    }
  }

  /**
   * Get the SQL for a generated stored column modifier.
   *
   * @protected
   * @param  {Blueprint}  blueprint
   * @param  {Fluent}  column
   * @return {string|null}
   */
  modifyStoredAs (blueprint, column) {
    let storedAs = column.get('storedAsJson')

    if (!isNil(storedAs)) {
      if (this.isJsonSelector(storedAs)) {
        storedAs = this.wrapJsonSelector(storedAs)
      }

      return ` as (${storedAs}) stored`
    }

    storedAs = column.get('storedAs')

    if (!isNil(storedAs)) {
      return ` as (${this.getValue(storedAs)}) stored`
    }
  }

  /**
   * Get the SQL for an unsigned column modifier.
   *
   * @protected
   * @param  {Blueprint}  blueprint
   * @param  {Fluent}  column
   * @return {string|null}
   */
  modifyUnsigned (blueprint, column) {
    if (column.get('unsigned')) {
      return ' unsigned'
    }
  }

  /**
   * Get the SQL for a character set column modifier.
   *
   * @protected
   * @param  {Blueprint}  blueprint
   * @param  {Fluent}  column
   * @return {string|null}
   */
  modifyCharset (blueprint, column) {
    if (!isNil(column.get('charset'))) {
      return ' character set ' + column.get('charset')
    }
  }

  /**
   * Get the SQL for a collation column modifier.
   *
   * @protected
   * @param  {Blueprint}  blueprint
   * @param  {Fluent}  column
   * @return {string|null}
   */
  modifyCollate (blueprint, column) {
    if (!isNil(column.get('collation'))) {
      return ` collate '${column.get('collation')}'`
    }
  }

  /**
   * Get the SQL for a nullable column modifier.
   *
   * @protected
   * @param  {Blueprint}  blueprint
   * @param  {Fluent}  column
   * @return {string|null}
   */
  modifyNullable (blueprint, column) {
    if (isNil(column.get('virtualAs')) &&
      isNil(column.get('virtualAsJson')) &&
      isNil(column.get('storedAs')) &&
      isNil(column.get('storedAsJson'))) {
      return column.get('nullable') ? ' null' : ' not null'
    }

    if (column.get('nullable') === false) {
      return ' not null'
    }
  }

  /**
   * Get the SQL for an invisible column modifier.
   *
   * @protected
   * @param  {Blueprint}  blueprint
   * @param  {Fluent}  column
   * @return {string|null}
   */
  modifyInvisible (blueprint, column) {
    if (!isNil(column.get('invisible'))) {
      return ' invisible'
    }
  }

  /**
   * Get the SQL for a default column modifier.
   *
   * @protected
   * @param  {Blueprint}  blueprint
   * @param  {Fluent}  column
   * @return {string|null}
   */
  modifyDefault (blueprint, column) {
    if (!isNil(column.get('default'))) {
      return ' default ' + this.getDefaultValue(column.get('default'))
    }
  }

  /**
   * Get the SQL for an "on update" column modifier.
   *
   * @protected
   * @param  {Blueprint}  blueprint
   * @param  {Fluent}  column
   * @return {string|null}
   */
  modifyOnUpdate (blueprint, column) {
    if (!isNil(column.get('onUpdate'))) {
      return ' on update ' + this.getValue(column.get('onUpdate'))
    }
  }

  /**
   * Get the SQL for an auto-increment column modifier.
   *
   * @protected
   * @param  {Blueprint}  blueprint
   * @param  {Fluent}  column
   * @return {string|null}
   */
  modifyIncrement (blueprint, column) {
    if (this.serials.includes(column.get('type')) && column.get('autoIncrement')) {
      return this.hasCommand(blueprint, 'primary') || (column.get('change') && !column.get('primary'))
        ? ' auto_increment'
        : ' auto_increment primary key'
    }
  }

  /**
   * Get the SQL for a "first" column modifier.
   *
   * @protected
   * @param  {Blueprint}  blueprint
   * @param  {Fluent}  column
   * @return {string|null}
   */
  modifyFirst (blueprint, column) {
    if (!isNil(column.get('first'))) {
      return ' first'
    }
  }

  /**
   * Get the SQL for an "after" column modifier.
   *
   * @protected
   * @param  {Blueprint}  blueprint
   * @param  {Fluent}  column
   * @return {string|null}
   */
  modifyAfter (blueprint, column) {
    if (!isNil(column.get('after'))) {
      return ' after ' + this.wrap(column.get('after'))
    }
  }

  /**
   * Get the SQL for a "comment" column modifier.
   *
   * @protected
   * @param  {Blueprint}  blueprint
   * @param  {Fluent}  column
   * @return {string|null}
   */
  modifyComment (blueprint, column) {
    if (!isNil(column.get('comment'))) {
      return " comment '" + addslashes(column.get('comment')) + "'"
    }
  }

  /**
   * Wrap a single string in keyword identifiers.
   *
   * @protected
   * @param  {string}  value
   * @return {string}
   */
  wrapValue (value) {
    if (value !== '*') {
      return '`' + value.replace('`', '``') + '`'
    }

    return value
  }

  /**
   * Wrap the given JSON selector.
   *
   * @protected
   * @param  {string}  value
   * @return {string}
   */
  wrapJsonSelector (value) {
    const [field, path] = this.wrapJsonFieldAndPath(value)

    return 'json_unquote(json_extract(' + field + path + '))'
  }
}

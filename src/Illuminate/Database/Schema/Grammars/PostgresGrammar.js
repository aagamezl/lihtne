import { isNil } from '@devnetic/utils'

import Grammar from './Grammar.js'
import { Expression } from '../../Query/internal.js'

/** @typedef {import ('../../Connection.js').default} Connection */
/** @typedef {import('../Blueprint.js').default} Blueprint */
/** @typedef {import('../../../Support/Fluent.js').default} Fluent */

export default class PostgresGrammar extends Grammar {
  /**
   * If this Grammar supports schema changes wrapped in a transaction.
   *
   * @protected
   * @type {boolean}
   */
  transactions = true

  /**
   * The possible column modifiers.
   *
   * @protected
   * @type {string[]}
   */
  modifiers = ['Collate', 'Nullable', 'Default', 'VirtualAs', 'StoredAs', 'GeneratedAs', 'Increment']

  /**
   * The columns available as serials.
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
  fluentCommands = ['AutoIncrementStartingValues', 'Comment']

  /**
   * Compile a create database command.
   *
   * @param  {string} name
   * @param  {Connection} connection
   * @return {string}
   */
  compileCreateDatabase (name, connection) {
    return `create database ${this.wrapValue(name)} encoding ${this.wrapValue(connection.getConfig('charset'))}`
  }

  /**
   * Compile a drop database if exists command.
   *
   * @param  {string} name
   * @return {string}
   */
  compileDropDatabaseIfExists (name) {
    return `drop database if exists ${this.wrapValue(name)}`
  }

  /**
   * Compile the query to determine the tables.
   *
   * @return {string}
   */
  compileTables () {
    return `select c.relname as name, n.nspname as schema, pg_total_relation_size(c.oid) as size, ' +
      'obj_description(c.oid, 'pg_class') as comment from pg_class c, pg_namespace n ' +
      'where c.relkind in ('r', 'p') and n.oid = c.relnamespace and n.nspname not in ('pg_catalog', 'information_schema') ' +
      'order by c.relname`
  }

  /**
   * Compile the query to determine the views.
   *
   * @return {string}
   */
  compileViews () {
    return 'select viewname as name, schemaname as schema, definition from pg_views ' +
      'where schemaname not in (\'pg_catalog\', \'information_schema\') order by viewname'
  }

  /**
   * Compile the query to determine the user-defined types.
   *
   * @return {string}
   */
  compileTypes () {
    return 'select t.typname as name, n.nspname as schema, t.typtype as type, t.typcategory as category, ' +
      "((t.typinput = 'array_in'::regproc and t.typoutput = 'array_out'::regproc) or t.typtype = 'm') as implicit " +
      'from pg_type t join pg_namespace n on n.oid = t.typnamespace ' +
      'left join pg_class c on c.oid = t.typrelid ' +
      'left join pg_type el on el.oid = t.typelem ' +
      'left join pg_class ce on ce.oid = el.typrelid ' +
      "where ((t.typrelid = 0 and (ce.relkind = 'c' or ce.relkind is null)) or c.relkind = 'c') " +
      "and not exists (select 1 from pg_depend d where d.objid in (t.oid, t.typelem) and d.deptype = 'e') " +
      "and n.nspname not in ('pg_catalog', 'information_schema')"
  }

  /**
   * Compile the query to determine the columns.
   *
   * @param  {string} schema
   * @param  {string} table
   * @return {string}
   */
  compileColumns (schema, table) {
    return 'select a.attname as name, t.typname as type_name, format_type(a.atttypid, a.atttypmod) as type, ' +
      '(select tc.collcollate from pg_catalog.pg_collation tc where tc.oid = a.attcollation) as collation, ' +
      'not a.attnotnull as nullable, ' +
      '(select pg_get_expr(adbin, adrelid) from pg_attrdef where c.oid = pg_attrdef.adrelid and pg_attrdef.adnum = a.attnum) as default, ' +
      `${this.connection?.getServerVersion() < '12.0' ? "'' as generated, " : 'a.attgenerated as generated, '}` +
      'col_description(c.oid, a.attnum) as comment ' +
      'from pg_attribute a, pg_class c, pg_type t, pg_namespace n ' +
      `where c.relname = ${this.quoteString(table)} and n.nspname = ${this.quoteString(schema)} and a.attnum > 0 and a.attrelid = c.oid and a.atttypid = t.oid and n.oid = c.relnamespace ` +
      'order by a.attnum'
  }

  /**
   * Compile the query to determine the indexes.
   *
   * @param  {string} schema
   * @param  {string} table
   * @return {string}
   */
  compileIndexes (schema, table) {
    return 'select ic.relname as name, string_agg(a.attname, \',\' order by indseq.ord) as columns, ' +
       'am.amname as "type", i.indisunique as "unique", i.indisprimary as "primary" ' +
       'from pg_index i ' +
       'join pg_class tc on tc.oid = i.indrelid ' +
       'join pg_namespace tn on tn.oid = tc.relnamespace ' +
       'join pg_class ic on ic.oid = i.indexrelid ' +
       'join pg_am am on am.oid = ic.relam ' +
       'join lateral unnest(i.indkey) with ordinality as indseq(num, ord) on true ' +
       'left join pg_attribute a on a.attrelid = i.indrelid and a.attnum = indseq.num ' +
       `where tc.relname = ${this.quoteString(table)} and tn.nspname = ${this.quoteString(schema)} ` +
       'group by ic.relname, am.amname, i.indisunique, i.indisprimary'
  }

  /**
   * Compile the query to determine the foreign keys.
   *
   * @param  {string} schema
   * @param  {string} table
   * @return {string}
   */
  compileForeignKeys (schema, table) {
    return 'select c.conname as name, ' +
      'string_agg(la.attname, \',\' order by conseq.ord) as columns, ' +
      'fn.nspname as foreign_schema, fc.relname as foreign_table, ' +
      'string_agg(fa.attname, \',\' order by conseq.ord) as foreign_columns, ' +
      'c.confupdtype as on_update, c.confdeltype as on_delete ' +
      'from pg_constraint c ' +
      'join pg_class tc on c.conrelid = tc.oid ' +
      'join pg_namespace tn on tn.oid = tc.relnamespace ' +
      'join pg_class fc on c.confrelid = fc.oid ' +
      'join pg_namespace fn on fn.oid = fc.relnamespace ' +
      'join lateral unnest(c.conkey) with ordinality as conseq(num, ord) on true ' +
      'join pg_attribute la on la.attrelid = c.conrelid and la.attnum = conseq.num ' +
      'join pg_attribute fa on fa.attrelid = c.confrelid and fa.attnum = c.confkey[conseq.ord] ' +
      `where c.contype = 'f' and tc.relname = ${this.quoteString(table)} and tn.nspname = ${this.quoteString(schema)} ` +
      'group by c.conname, fn.nspname, fc.relname, c.confupdtype, c.confdeltype'
  }

  /**
   * Compile a create table command.
   *
   * @param  {Blueprint} blueprint
   * @param  {Fluent} command
   * @return {string}
   */
  compileCreate (blueprint, command) {
    return `${blueprint.temporaryProperty ? 'create temporary' : 'create'} table ${this.wrapTable(blueprint)} (${this.getColumns(blueprint).join(', ')})`
  }

  /**
   * Compile a column addition command.
   *
   * @param  {Blueprint} blueprint
   * @param  {Fluent} command
   * @return {string}
   */
  compileAdd (blueprint, command) {
    return `alter table ${this.wrapTable(blueprint)} add column ${this.getColumn(blueprint, command.get('column'))}`
  }

  /**
   * Compile the auto-incrementing column starting values.
   *
   * @param  {Blueprint} blueprint
   * @param  {Fluent} command
   * @return {string|undefined}
   */
  compileAutoIncrementStartingValues (blueprint, command) {
    if (command.get('column').get('autoIncrement')) {
      const value = command.get('column').get('startingValue') || command.get('column').get('from')

      if (value) {
        const table = blueprint.getTable().split('.').pop()

        return `alter sequence ${blueprint.getPrefix()}${table}_${command.get('column').get('name')}_seq restart with ${value}`
      }
    }
  }

  /**
   * Compile a change column command into a series of SQL statements.
   *
   * @param  {Blueprint} blueprint
   * @param  {Fluent} command
   * @param  {Connection} connection
   * @return {string|string[]}
   *
   * @throws {RuntimeException}
   */
  compileChange (blueprint, command, connection) {
    const columns = []

    for (const column of blueprint.getChangedColumns()) {
      const changes = [`type ${this.getType(column)}${this.modifyCollate(blueprint, column)}`]

      for (const modifier of this.modifiers) {
        if (modifier === 'Collate') {
          continue
        }

        const method = `modify${modifier}`

        if (typeof this[method] === 'function') {
          const result = this[method](blueprint, column)
          const constraints = result ? Array.isArray(result) ? result : [result] : []

          changes.push(...constraints)
        }
      }

      columns.push(this.prefixArray(`alter column ${this.wrap(column)}`, changes).join(', '))
    }

    return `alter table ${this.wrapTable(blueprint)} ${columns.join(', ')}`
  }

  /**
   * Compile a primary key command.
   *
   * @param  {Blueprint} blueprint
   * @param  {Fluent} command
   * @return {string}
   */
  compilePrimary (blueprint, command) {
    const columns = this.columnize(command.get('columns'))

    return `alter table ${this.wrapTable(blueprint)} add primary key (${columns})`
  }

  /**
   * Compile a unique key command.
   *
   * @param  {Blueprint} blueprint
   * @param  {Fluent} command
   * @return {string}
   */
  compileUnique (blueprint, command) {
    let sql = `alter table ${this.wrapTable(blueprint)} add constraint ${this.wrap(command.get('index'))} unique (${this.columnize(command.get('columns'))})`

    if (command.get('deferrable') !== undefined) {
      sql += command.get('deferrable') ? ' deferrable' : ' not deferrable'
    }

    if (command.get('deferrable') && command.get('initiallyImmediate') !== undefined) {
      sql += command.get('initiallyImmediate') ? ' initially immediate' : ' initially deferred'
    }

    return sql
  }

  /**
   * Compile a plain index key command.
   *
   * @param  {Blueprint} blueprint
   * @param  {Fluent} command
   * @return {string}
   */
  compileIndex (blueprint, command) {
    return `create index ${this.wrap(command.get('index'))} on ${this.wrapTable(blueprint)}${command.get('algorithm') ? ' using ' + command.get('algorithm') : ''} (${this.columnize(command.get('columns'))})`
  }

  /**
   * Compile a fulltext index key command.
   *
   * @param  {Blueprint} blueprint
   * @param  {Fluent} command
   * @return {string}
   *
   * @throws {RuntimeException}
   */
  compileFulltext (blueprint, command) {
    const language = command.get('language') || 'english'

    const columns = command.get('columns').map(column =>
      `to_tsvector(${this.quoteString(language)}, ${this.wrap(column)})`
    )

    return `create index ${this.wrap(command.get('index'))} on ${this.wrapTable(blueprint)} using gin ((${columns.join(' || ')}))`
  }

  /**
   * Compile a spatial index key command.
   *
   * @param  {Blueprint} blueprint
   * @param  {Fluent} command
   * @return {string}
   */
  compileSpatialIndex (blueprint, command) {
    command.set('algorithm', 'gist')

    return this.compileIndex(blueprint, command)
  }

  /**
   * Compile a foreign key command.
   *
   * @param  {Blueprint} blueprint
   * @param  {Fluent} command
   * @return {string}
   */
  compileForeign (blueprint, command) {
    let sql = super.compileForeign(blueprint, command)

    const deferrable = command.get('deferrable')

    if (deferrable !== undefined) {
      sql += deferrable ? ' deferrable' : ' not deferrable'
    }

    const initiallyImmediate = command.get('initiallyImmediate')

    if (deferrable && initiallyImmediate !== undefined) {
      sql += initiallyImmediate ? ' initially immediate' : ' initially deferred'
    }

    if (command.get('notValid') !== undefined) {
      sql += ' not valid'
    }

    return sql
  }

  /**
   * Compile a drop table command.
   *
   * @param  {Blueprint} blueprint
   * @param  {Fluent} command
   * @return {string}
   */
  compileDrop (blueprint, command) {
    return 'drop table ' + this.wrapTable(blueprint)
  }

  /**
   * Compile a drop table (if exists) command.
   *
   * @param  {Blueprint} blueprint
   * @param  {Fluent} command
   * @return {string}
   */
  compileDropIfExists (blueprint, command) {
    return 'drop table if exists ' + this.wrapTable(blueprint)
  }

  /**
   * Compile the SQL needed to drop all tables.
   *
   * @param  {Array<string>} tables
   * @return {string}
   */
  compileDropAllTables (tables) {
    return 'drop table ' + this.escapeNames(tables).join(',') + ' cascade'
  }

  /**
   * Compile the SQL needed to drop all views.
   *
   * @param  {Array<string>} views
   * @return {string}
   */
  compileDropAllViews (views) {
    return 'drop view ' + this.escapeNames(views).join(',') + ' cascade'
  }

  /**
   * Compile the SQL needed to drop all types.
   *
   * @param  {Array<string>} types
   * @return {string}
   */
  compileDropAllTypes (types) {
    return 'drop type ' + this.escapeNames(types).join(',') + ' cascade'
  }

  /**
   * Compile the SQL needed to drop all domains.
   *
   * @param  {string[]} domains
   * @return {string}
   */
  compileDropAllDomains (domains) {
    return 'drop domain ' + this.escapeNames(domains).join(',') + ' cascade'
  }

  /**
   * Compile a drop column command.
   *
   * @param  {Blueprint} blueprint
   * @param  {Fluent} command
   * @return {string}
   */
  compileDropColumn (blueprint, command) {
    const columns = this.prefixArray('drop column', this.wrapArray(command.get('columns')))

    return 'alter table ' + this.wrapTable(blueprint) + ' ' + columns.join(', ')
  }

  /**
   * Compile a drop primary key command.
   *
   * @param  {Blueprint} blueprint
   * @param  {Fluent} command
   * @return {string}
   */
  compileDropPrimary (blueprint, command) {
    const table = blueprint.getTable().split('.').pop()
    const index = this.wrap(`${blueprint.getPrefix()}${table}_pkey`)

    return `alter table ${this.wrapTable(blueprint)} drop constraint ${index}`
  }

  /**
   * Compile a drop unique key command.
   *
   * @param  {Blueprint} blueprint
   * @param  {Fluent} command
   * @return {string}
   */
  compileDropUnique (blueprint, command) {
    const index = this.wrap(command.get('index'))

    return `alter table ${this.wrapTable(blueprint)} drop constraint ${index}`
  }

  /**
   * Compile a drop index command.
   *
   * @param  {Blueprint} blueprint
   * @param  {Fluent} command
   * @return {string}
   */
  compileDropIndex (blueprint, command) {
    return `drop index ${this.wrap(command.get('index'))}`
  }

  /**
   * Compile a drop fulltext index command.
   *
   * @param  {Blueprint} blueprint
   * @param  {Fluent} command
   * @return {string}
   */
  compileDropFullText (blueprint, command) {
    return this.compileDropIndex(blueprint, command)
  }

  /**
   * Compile a drop spatial index command.
   *
   * @param  {Blueprint} blueprint
   * @param  {Fluent} command
   * @return {string}
   */
  compileDropSpatialIndex (blueprint, command) {
    return this.compileDropIndex(blueprint, command)
  }

  /**
   * Compile a drop foreign key command.
   *
   * @param  {Blueprint} blueprint
   * @param  {Fluent} command
   * @return {string}
   */
  compileDropForeign (blueprint, command) {
    const index = this.wrap(command.get('index'))

    return `alter table ${this.wrapTable(blueprint)} drop constraint ${index}`
  }

  /**
   * Compile a rename table command.
   *
   * @param  {Blueprint} blueprint
   * @param  {Fluent} command
   * @return {string}
   */
  compileRename (blueprint, command) {
    const from = this.wrapTable(blueprint)

    return `alter table ${from} rename to ${this.wrapTable(command.get('to'))}`
  }

  /**
   * Compile a rename index command.
   *
   * @param  {Blueprint} blueprint
   * @param  {Fluent} command
   * @return {string}
   */
  compileRenameIndex (blueprint, command) {
    return `alter index ${this.wrap(command.get('from'))} rename to ${this.wrap(command.get('to'))}`
  }

  /**
   * Compile the command to enable foreign key constraints.
   *
   * @return {string}
   */
  compileEnableForeignKeyConstraints () {
    return 'SET CONSTRAINTS ALL IMMEDIATE;'
  }

  /**
   * Compile the command to disable foreign key constraints.
   *
   * @return {string}
   */
  compileDisableForeignKeyConstraints () {
    return 'SET CONSTRAINTS ALL DEFERRED;'
  }

  /**
   * Compile a comment command.
   *
   * @param  {Blueprint} blueprint
   * @param  {Fluent} command
   * @return {string|undefined}
   */
  compileComment (blueprint, command) {
    const column = command.get('column')
    const comment = column.get('comment')

    if (comment !== undefined || column.get('change')) {
      return `comment on column ${this.wrapTable(blueprint)}.${this.wrap(column.get('name'))} is ${comment === undefined ? 'NULL' : `'${comment.replace(/'/g, "''")}'`}`
    }
  }

  /**
   * Compile a table comment command.
   *
   * @param  {Blueprint} blueprint
   * @param  {Fluent} command
   * @return {string}
   */
  compileTableComment (blueprint, command) {
    return `comment on table ${this.wrapTable(blueprint)} is '${command.get('comment').replace(/'/g, "''")}'`
  }

  /**
   * Quote-escape the given tables, views, or types.
   *
   * @param  {Array<string>} names
   * @return {Array<string>}
   */
  escapeNames (names) {
    return names.map(name => {
      return '"' + name.split('.')
        .map(segment => segment.trim().replace(/^['"\s]+|['"\s]+$/g, ''))
        .join('"."') + '"'
    })
  }

  /**
   * Create the column definition for a char type.
   *
   * @protected
   * @param  {Fluent} column
   * @return {string}
   */
  typeChar (column) {
    if (column.get('length')) {
      return `char(${column.get('length')})`
    }

    return 'char'
  }

  /**
   * Create the column definition for a string type.
   *
   * @protected
   * @param  {Fluent} column
   * @return {string}
   */
  typeString (column) {
    if (column.get('length')) {
      return `varchar(${column.get('length')})`
    }

    return 'varchar'
  }

  /**
   * Create the column definition for a tiny text type.
   *
   * @protected
   * @param  {Fluent} column
   * @return {string}
   */
  typeTinyText (column) {
    return 'varchar(255)'
  }

  /**
   * Create the column definition for a text type.
   *
   * @protected
   * @param  {Fluent} column
   * @return {string}
   */
  typeText (column) {
    return 'text'
  }

  /**
   * Create the column definition for a medium text type.
   *
   * @protected
   * @param  {Fluent} column
   * @return {string}
   */
  typeMediumText (column) {
    return 'text'
  }

  /**
   * Create the column definition for a long text type.
   *
   * @protected
   * @param  {Fluent} column
   * @return {string}
   */
  typeLongText (column) {
    return 'text'
  }

  /**
   * Create the column definition for an integer type.
   *
   * @protected
   * @param  {Fluent} column
   * @return {string}
   */
  typeInteger (column) {
    return column.get('autoIncrement') && column.get('generatedAs') === undefined && !column.get('change') ? 'serial' : 'integer'
  }

  /**
   * Create the column definition for a big integer type.
   *
   * @protected
   * @param  {Fluent} column
   * @return {string}
   */
  typeBigInteger (column) {
    return column.get('autoIncrement') && column.get('generatedAs') === undefined && !column.get('change') ? 'bigserial' : 'bigint'
  }

  /**
   * Create the column definition for a medium integer type.
   *
   * @protected
   * @param  {Fluent} column
   * @return {string}
   */
  typeMediumInteger (column) {
    return this.typeInteger(column)
  }

  /**
   * Create the column definition for a tiny integer type.
   *
   * @protected
   * @param  {Fluent} column
   * @return {string}
   */
  typeTinyInteger (column) {
    return this.typeSmallInteger(column)
  }

  /**
   * Create the column definition for a small integer type.
   *
   * @protected
   * @param  {Fluent} column
   * @return {string}
   */
  typeSmallInteger (column) {
    return column.get('autoIncrement') && column.get('generatedAs') === null && !column.get('change') ? 'smallserial' : 'smallint'
  }

  /**
   * Create the column definition for a float type.
   *
   * @protected
   * @param  {Fluent} column
   * @return {string}
   */
  typeFloat (column) {
    return column.get('precision') ? `float(${column.get('precision')})` : 'float'
  }

  /**
   * Create the column definition for a double type.
   *
   * @protected
   * @param  {Fluent} column
   * @return {string}
   */
  typeDouble (column) {
    return 'double precision'
  }

  /**
   * Create the column definition for a real type.
   *
   * @protected
   * @param  {Fluent} column
   * @return {string}
   */
  typeReal (column) {
    return 'real'
  }

  /**
   * Create the column definition for a decimal type.
   *
   * @protected
   * @param  {Fluent} column
   * @return {string}
   */
  typeDecimal (column) {
    return `decimal(${column.get('total')}, ${column.get('places')})`
  }

  /**
   * Create the column definition for a boolean type.
   *
   * @protected
   * @param  {Fluent} column
   * @return {string}
   */
  typeBoolean (column) {
    return 'boolean'
  }

  /**
   * Create the column definition for an enumeration type.
   *
   * @protected
   * @param  {Fluent} column
   * @return {string}
   */
  typeEnum (column) {
    return `varchar(255) check ("${column.get('name')}" in (${this.quoteString(column.get('allowed'))}))`
  }

  /**
   * Create the column definition for a json type.
   *
   * @protected
   * @param  {Fluent} column
   * @return {string}
   */
  typeJson (column) {
    return 'json'
  }

  /**
   * Create the column definition for a jsonb type.
   *
   * @protected
   * @param  {Fluent} column
   * @return {string}
   */
  typeJsonb (column) {
    return 'jsonb'
  }

  /**
   * Create the column definition for a date type.
   *
   * @protected
   * @param  {Fluent} column
   * @return {string}
   */
  typeDate (column) {
    return 'date'
  }

  /**
   * Create the column definition for a date-time type.
   *
   * @protected
   * @param  {Fluent} column
   * @return {string}
   */
  typeDateTime (column) {
    return this.typeTimestamp(column)
  }

  /**
   * Create the column definition for a date-time (with time zone) type.
   *
   * @protected
   * @param  {Fluent} column
   * @return {string}
   */
  typeDateTimeTz (column) {
    return this.typeTimestampTz(column)
  }

  /**
   * Create the column definition for a time type.
   *
   * @protected
   * @param  {Fluent} column
   * @return {string}
   */
  typeTime (column) {
    return `time${column.get('precision') ? `(${column.get('precision')})` : ''} without time zone`
  }

  /**
   * Create the column definition for a time (with time zone) type.
   *
   * @protected
   * @param  {Fluent} column
   * @return {string}
   */
  typeTimeTz (column) {
    return `time${column.get('precision') ? `(${column.get('precision')})` : ''} with time zone`
  }

  /**
   * Create the column definition for a timestamp type.
   *
   * @protected
   * @param  {Fluent} column
   * @return {string}
   */
  typeTimestamp (column) {
    if (column.get('useCurrent')) {
      column.set('default', new Expression('CURRENT_TIMESTAMP'))
    }

    return `timestamp${column.get('precision') ? `(${column.get('precision')})` : ''} without time zone`
  }

  /**
   * Create the column definition for a timestamp (with time zone) type.
   *
   * @protected
   * @param  {Fluent} column
   * @return {string}
   */
  typeTimestampTz (column) {
    if (column.get('useCurrent')) {
      column.set('default', new Expression('CURRENT_TIMESTAMP'))
    }

    return `timestamp${column.get('precision') ? `(${column.get('precision')})` : ''} with time zone`
  }

  /**
   * Create the column definition for a year type.
   *
   * @protected
   * @param  {Fluent} column
   * @return {string}
   */
  typeYear (column) {
    return this.typeInteger(column)
  }

  /**
   * Create the column definition for a binary type.
   *
   * @protected
   * @param  {Fluent} column
   * @return {string}
   */
  typeBinary (column) {
    return 'bytea'
  }

  /**
   * Create the column definition for a uuid type.
   *
   * @protected
   * @param  {Fluent} column
   * @return {string}
   */
  typeUuid (column) {
    return 'uuid'
  }

  /**
   * Create the column definition for an IP address type.
   *
   * @protected
   * @param  {Fluent} column
   * @return {string}
   */
  typeIpAddress (column) {
    return 'inet'
  }

  /**
   * Create the column definition for a MAC address type.
   *
   * @protected
   * @param  {Fluent} column
   * @return {string}
   */
  typeMacAddress (column) {
    return 'macaddr'
  }

  /**
   * Create the column definition for a spatial Geometry type.
   *
   * @protected
   * @param  {Fluent} column
   * @return {string}
   */
  typeGeometry (column) {
    const subtype = column.get('subtype')
    const srid = column.get('srid')

    return subtype
      ? `geometry(${subtype.toLowerCase()}${srid ? `,${srid}` : ''})`
      : 'geometry'
  }

  /**
   * Create the column definition for a spatial Geography type.
   *
   * @protected
   * @param  {Fluent} column
   * @return {string}
   */
  typeGeography (column) {
    const subtype = column.get('subtype')
    const srid = column.get('srid')

    return subtype
      ? `geography(${subtype.toLowerCase()}${srid ? `,${srid}` : ''})`
      : 'geography'
  }

  /**
   * Get the SQL for a collation column modifier.
   *
   * @protected
   * @param  {Blueprint} blueprint
   * @param  {Fluent} column
   * @return {string|undefined}
   */
  modifyCollate (blueprint, column) {
    const collation = column.get('collation')

    // return collation
    //   ? ` collate ${this.wrapValue(collation)}`
    //   : ''
    if (!isNil(collation)) {
      return ` collate ${this.wrapValue(collation)}`
    }
  }

  /**
   * Get the SQL for a nullable column modifier.
   *
   * @protected
   * @param  {Blueprint} blueprint
   * @param  {Fluent} column
   * @return {string}
   */
  modifyNullable (blueprint, column) {
    if (column.get('change')) {
      return column.get('nullable') ? 'drop not null' : 'set not null'
    }

    return column.get('nullable') ? ' null' : ' not null'
  }

  /**
   * Get the SQL for a default column modifier.
   *
   * @protected
   * @param  {Blueprint} blueprint
   * @param  {Fluent} column
   * @return {string|undefined}
   */
  modifyDefault (blueprint, column) {
    if (column.get('change')) {
      if (!column.get('autoIncrement') || column.get('generatedAs') !== undefined) {
        return column.get('default') === undefined
          ? 'drop default'
          : `set default ${this.getDefaultValue(column.get('default'))}`
      }
      return undefined
    }

    return column.get('default') !== undefined
      ? `default ${this.getDefaultValue(column.get('default'))}`
      : undefined
  }

  /**
   * Get the SQL for an auto-increment column modifier.
   *
   * @protected
   * @param  {Blueprint} blueprint
   * @param  {Fluent} column
   * @return {string|undefined}
   */
  modifyIncrement (blueprint, column) {
    if (!column.get('change') &&
      !this.hasCommand(blueprint, 'primary') &&
      (this.serials.includes(column.get('type')) || column.get('generatedAs') !== undefined) &&
      column.get('autoIncrement')) {
      return ' primary key'
    }

    return undefined
  }

  /**
   * Get the SQL for a generated virtual column modifier.
   *
   * @protected
   * @param  {Blueprint} blueprint
   * @param  {Fluent} column
   * @return {string|undefined}
   */
  modifyVirtualAs (blueprint, column) {
    if (column.get('change')) {
      if (Reflect.has(column.getAttributes(), 'virtualAs')) {
        if (column.get('virtualAs') === undefined) {
          return 'drop expression if exists'
        }

        throw new Error('LogicException: This database driver does not support modifying generated columns.')
      }

      return undefined
    }

    const virtualAs = column.get('virtualAs')

    return virtualAs !== undefined
      ? `generated always as (${this.getValue(virtualAs)})`
      : undefined
  }

  /**
   * @protected
   * @param {Blueprint} blueprint
   * @param {Fluent} column
   * @return {string|undefined}
   */
  modifyStoredAs (blueprint, column) {
    if (column.get('change')) {
      if (Reflect.has(column.get('attributes'), 'storedAs')) {
        return column.get('storedAs') === undefined
          ? 'drop expression if exists'
          : (() => { throw new Error('LogicException: This database driver does not support modifying generated columns.') })()
      }

      return undefined
    }

    if (column.get('storedAs') !== undefined) {
      return ` generated always as (${this.getValue(column.get('storedAs'))}) stored`
    }
  }

  /**
   * @protected
   * @param {Blueprint} blueprint
   * @param {Fluent} column
   * @return {string|string[]|undefined}
   */
  modifyGeneratedAs (blueprint, column) {
    let sql

    if (column.get('generatedAs') !== undefined) {
      sql = ` generated ${column.get('always') ? 'always' : 'by default'} as identity${(typeof column.get('generatedAs') !== 'boolean' && column.get('generatedAs') !== '') ? ` (${column.get('generatedAs')})` : ''}`
    }

    if (column.get('change')) {
      const changes = column.get('autoIncrement') && sql === undefined ? [] : ['drop identity if exists']

      if (sql !== undefined) {
        changes.push(`add ${sql}`)
      }

      return changes
    }

    return sql
  }
}

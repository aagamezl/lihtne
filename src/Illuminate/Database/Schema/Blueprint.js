import { isNil } from '@devnetic/utils'

import Builder from './Builder.js'
import ColumnDefinition from './ColumnDefinition.js'
import Fluent from './../../Support/Fluent.js'
import Macroable from '../../Macroable/Traits/Macroable.js'
import { mix } from '../../Support/Traits/use.js'
import { collect } from '../../Collections/helpers.js'
import MySqlGrammar from './Grammars/MySqlGrammar.js'
import { classUsesRecursive, ucfirst } from '../../Support/helpers.js'
import { Expression } from '../Query/internal.js'
import ForeignKeyDefinition from './ForeignKeyDefinition.js'
import ForeignIdColumnDefinition from './ForeignIdColumnDefinition.js'
import BlueprintState from './BlueprintState.js'
import SQLiteGrammar from './Grammars/SQLiteGrammar.js'

/** @typedef {import('../Connection.js').default} Connection */
/** @typedef {import('./Grammars/Grammar.js').default} Grammar */
/** @typedef {import('../Eloquent/Model.js').default} Model */
/** @typedef {import('./IndexDefinition.js').default} IndexDefinition */

export default class Blueprint extends mix().use(Macroable) {
  /**
   * The table the blueprint describes.
   *
   * @protected
   * @type {string}
   */
  table = ''

  /**
   * The prefix of the table.
   *
   * @protected
   * @type {string}
   */
  prefix = ''

  /**
   * The columns that should be added to the table.
   *
   * @protected
   * @type {ColumnDefinition[]}
   */
  columns = []

  /**
   * The commands that should be run for the table.
   *
   * @protected
   * @type {Fluent[]}
   */
  commands = []

  /**
   * The storage engine that should be used for the table.
   *
   * @type {string}
   */
  engineProperty = ''

  /**
   * The default character set that should be used for the table.
   *
   * @type {string}
   */
  charsetProperty = ''

  /**
   * The collation that should be used for the table.
   *
   * @type {string}
   */
  collationProperty = ''

  /**
   * Whether to make the table temporary.
   *
   * @type {boolean}
   */
  temporaryProperty = false

  /**
   * The column to add new columns after.
   *
   * @type {string|null}
   */
  afterProperty = null

  /**
   * The blueprint state instance.
   *
   * @protected
   * @type {\Illuminate\Database\Schema\BlueprintState|null}
   */
  state

  /**
   * Create a new schema blueprint.
   *
   * @param  {string}  table
   * @param  {Function}  [callbackFunction]
   * @param  {string}  [prefix='']
   */
  constructor (table, callbackFunction = undefined, prefix = '') {
    // use(Blueprint, [Macroable])
    super()

    this.table = table
    this.prefix = prefix

    if (callbackFunction) {
      callbackFunction(this)
    }
  }

  /**
   * @param {Connection} connection
   * @param {Grammar} grammar
   * @returns {void}
   */
  build (connection, grammar) {
    for (const statement of this.toSql(connection, grammar)) {
      connection.statement(statement)
    }
  }

  /**
   * @param {Connection} connection
   * @param {Grammar} grammar
   * @returns {Array}
   */
  toSql (connection, grammar) {
    this.addImpliedCommands(connection, grammar)

    const statements = []

    // Each type of command has a corresponding compiler function on the schema
    // grammar which is used to build the necessary SQL statements to build
    // the blueprint element, so we'll just call that compiler's function.
    this.ensureCommandsAreValid(connection)

    for (const command of this.commands) {
      if (command.get('shouldBeSkipped')) {
        continue
      }

      // const method = `compile${command.get('name')[0].toUpperCase()}${command.get('name').slice(1)}`
      const method = `compile${ucfirst(command.get('name'))}`

      if (typeof grammar[method] === 'function'/*  || grammar.constructor.hasMacro(method) */) {
        if (this.hasState()) {
          this.state.update(command)
        }

        const sql = grammar[method](this, command, connection)

        if (!isNil(sql)) {
          // statements = statements.concat(sql)
          statements.push(...[].concat(sql))
        }
      }
    }

    return statements
  }

  /**
   * @protected
   * @param {Connection} connection
   * @returns {void}
   * @throws {BadMethodCallException}
   */
  ensureCommandsAreValid (connection) {
    // Implementation here
  }

  /**
   * @protected
   * @param {string[]} names
   * @returns {import('../../Collections/Collection.js').default}
   */
  commandsNamed (names) {
    return collect(this.commands).filter((/** @type {Fluent} */ command) => {
      return names.includes(command.get('name'))
    })
  }

  /**
   * @protected
   * @param {Connection} connection
   * @param {Grammar} grammar
   * @returns {void}
   */
  addImpliedCommands (connection, grammar) {
    // if (this.getAddedColumns().length > 0 && !this.creating()) {
    //   this.commands.unshift(this.createCommand('add'))
    // }

    // if (this.getChangedColumns().length > 0 && !this.creating()) {
    //   this.commands.unshift(this.createCommand('change'))
    // }

    // this.addFluentIndexes(connection, grammar)

    // this.addFluentCommands(connection, grammar)
    this.addFluentIndexes(connection, grammar)
    this.addFluentCommands(connection, grammar)

    if (!this.creating()) {
      this.commands = this.commands.map(command =>
        command instanceof ColumnDefinition
          ? this.createCommand(command.get('change') ? 'change' : 'add', { column: command })
          : command
      )

      this.addAlterCommands(connection, grammar)
    }
  }

  /**
   * @protected
   * @param {Connection} connection
   * @param {Grammar} grammar
   * @returns {void}
   */
  addFluentIndexes (connection, grammar) {
    for (const column of this.columns) {
      for (const index of ['primary', 'unique', 'index', 'fulltext', 'fullText', 'spatialIndex']) {
        // If the column is supposed to be changed to an auto increment column and
        // the specified index is primary, there is no need to add a command on
        // MySQL, as it will be handled during the column definition instead.
        if (index === 'primary' && column.get('autoIncrement') && column.get('change') && grammar instanceof MySqlGrammar) {
          continue
        }

        // If the index has been specified on the given column, but is simply equal
        // to "true" (boolean), no name has been specified for this index so the
        // index method can be called without a name and it will generate one.
        if (column.get(index) === true) {
          this[index](column.get('name'))
          column.set(index, null)

          continue
        }

        // If the index has been specified on the given column, but it equals false
        // and the column is supposed to be changed, we will call the drop index
        // method with an array of column to drop it by its conventional name.
        if (column.get(index) === false && column.get('change')) {
          this[`drop${index.charAt(0).toUpperCase() + index.slice(1)}`]([column.get('name')])
          column.set(index, null)

          continue
        }

        // If the index has been specified on the given column, and it has a string
        // value, we'll go ahead and call the index method and pass the name for
        // the index since the developer specified the explicit name for this.
        if (column.get(index) !== undefined) {
          this[index](column.get('name'), column.get(index))
          column.set(index, null)

          continue
        }
      }
    }
  }

  /**
 * @param {Connection} connection
 * @param {Grammar} grammar
 * @returns {void}
 */
  addFluentCommands (connection, grammar) {
    for (const column of this.columns) {
      for (const commandName of grammar.getFluentCommands()) {
        this.addCommand(commandName, { column })
      }
    }
  }

  /**
   * Add the alter commands if whenever needed.
   *
   * @param {Object} connection
   * @param {Object} grammar
   */
  addAlterCommands (connection, grammar) {
    if (!(grammar instanceof SQLiteGrammar)) {
      return
    }

    const alterCommands = grammar.getAlterCommands(connection)
    const commands = []
    let lastCommandWasAlter = false
    let hasAlterCommand = false

    for (const command of this.commands) {
      if (alterCommands.includes(command.get('name'))) {
        hasAlterCommand = true
        lastCommandWasAlter = true
      } else if (lastCommandWasAlter) {
        commands.push(this.createCommand('alter'))
        lastCommandWasAlter = false
      }

      commands.push(command)
    }

    if (lastCommandWasAlter) {
      commands.push(this.createCommand('alter'))
    }

    if (hasAlterCommand) {
      this.state = new BlueprintState(this, connection, grammar)
    }

    this.commands = commands
  }

  /**
   * @returns {boolean}
   */
  creating () {
    for (const command of this.commands) {
      if (command.get('name') === 'create') {
        return true
      }
    }

    return false
    // return collect(this.commands).contains((/** @type {Fluent} */ command) => {
    //   return command.get('name') === 'create'
    // })
  }

  /**
   * @returns {Fluent}
   */
  create () {
    return this.addCommand('create')
  }

  /**
   * @param {string} engine
   * @returns {void}
   */
  engine (engine) {
    this.engineProperty = engine
  }

  /**
   * @returns {void}
   */
  innoDb () {
    this.engine('InnoDB')
  }

  /**
   * @param {string} charset
   * @returns {void}
   */
  charset (charset) {
    this.charsetProperty = charset
  }

  /**
 * @param {string} collation
 * @returns {void}
 */
  collation (collation) {
    this.collationProperty = collation
  }

  /**
   * @returns {void}
   */
  temporary () {
    this.temporaryProperty = true
  }

  /**
   * @returns {Fluent}
   */
  drop () {
    return this.addCommand('drop')
  }

  /**
 * @returns {Fluent}
 */
  dropIfExists () {
    return this.addCommand('dropIfExists')
  }

  /**
   * @param {Array|...*} columns
   * @returns {Fluent}
   */
  dropColumn (...columns) {
    columns = Array.isArray(columns[0]) ? columns[0] : columns

    return this.addCommand('dropColumn', { columns })
  }

  /**
   * @param {string} from
   * @param {string} to
   * @returns {Fluent}
   */
  renameColumn (from, to) {
    return this.addCommand('renameColumn', { from, to })
  }

  /**
 * @param {string|Array} [index]
 * @returns {Fluent}
 */
  dropPrimary (index = undefined) {
    return this.dropIndexCommand('dropPrimary', 'primary', index)
  }

  /**
   * @param {string|Array} index
   * @returns {Fluent}
   */
  dropUnique (index) {
    return this.dropIndexCommand('dropUnique', 'unique', index)
  }

  /**
   * @param {string|Array} index
   * @returns {Fluent}
   */
  dropIndex (index) {
    return this.dropIndexCommand('dropIndex', 'index', index)
  }

  /**
 * @param {string|Array} index
 * @returns {Fluent}
 */
  dropFullText (index) {
    return this.dropIndexCommand('dropFullText', 'fulltext', index)
  }

  /**
   * @param {string|Array} index
   * @returns {Fluent}
   */
  dropSpatialIndex (index) {
    return this.dropIndexCommand('dropSpatialIndex', 'spatialIndex', index)
  }

  /**
   * @param {string|Array} index
   * @returns {Fluent}
   */
  dropForeign (index) {
    return this.dropIndexCommand('dropForeign', 'foreign', index)
  }

  /**
   * @param {string} column
   * @returns {Fluent}
   */
  dropConstrainedForeignId (column) {
    this.dropForeign([column])

    return this.dropColumn(column)
  }

  /**
   * @param {Model|string} model
   * @param {string|null} [column=null]
   * @returns {Fluent}
   */
  dropForeignIdFor (model, column = null) {
    if (typeof model === 'string') {
      model = new (eval(model))() // eslint-disable-line
    }

    return this.dropForeign([column || model.getForeignKey()])
  }

  /**
   * @param {Model|string} model
   * @param {string|null} [column=null]
   * @returns {Fluent}
   */
  dropConstrainedForeignIdFor (model, column = null) {
    if (typeof model === 'string') {
      model = new (eval(model))() // eslint-disable-line
    }

    return this.dropConstrainedForeignId(column || model.getForeignKey())
  }

  /**
   * @param {string} from
   * @param {string} to
   * @returns {Fluent}
   */
  renameIndex (from, to) {
    return this.addCommand('renameIndex', { from, to })
  }

  /**
   * @returns {void}
   */
  dropTimestamps () {
    this.dropColumn('created_at', 'updated_at')
  }

  /**
   * @returns {void}
   */
  dropTimestampsTz () {
    this.dropTimestamps()
  }

  /**
   * @param {string} [column='deleted_at']
   * @returns {void}
   */
  dropSoftDeletes (column = 'deleted_at') {
    this.dropColumn(column)
  }

  /**
   * @param {string} [column='deleted_at']
   * @returns {void}
   */
  dropSoftDeletesTz (column = 'deleted_at') {
    this.dropSoftDeletes(column)
  }

  /**
   * @returns {void}
   */
  dropRememberToken () {
    this.dropColumn('remember_token')
  }

  /**
   * @param {string} name
   * @param {string|null} [indexName=null]
   * @returns {void}
   */
  dropMorphs (name, indexName = null) {
    this.dropIndex(indexName ?? this.createIndexName('index', [`${name}_type`, `${name}_id`]))

    this.dropColumn(`${name}_type`, `${name}_id`)
  }

  /**
   * @param {string} to
   * @returns {Fluent}
   */
  rename (to) {
    return this.addCommand('rename', { to })
  }

  /**
 * @param {string|Array<string>} columns
 * @param {string|null} [name=null]
 * @param {string|null} [algorithm=null]
 * @returns {IndexDefinition}
 */
  primary (columns, name = null, algorithm = null) {
    return this.indexCommand('primary', columns, name, algorithm)
  }

  /**
   * @param {string|Array<string>} columns
   * @param {string|null} [name=null]
   * @param {string|null} [algorithm=null]
   * @returns {IndexDefinition}
   */
  unique (columns, name = null, algorithm = null) {
    return this.indexCommand('unique', columns, name, algorithm)
  }

  /**
   * @param {string|Array<string|Expression>} columns
   * @param {string|null} [name=null]
   * @param {string|null} [algorithm=null]
   * @returns {IndexDefinition}
   */
  index (columns, name = null, algorithm = null) {
    return this.indexCommand('index', columns, name, algorithm)
  }

  /**
 * @param {string|Array<string>} columns
 * @param {string|null} [name=null]
 * @param {string|null} [algorithm=null]
 * @returns {IndexDefinition}
 */
  fulltext (columns, name = null, algorithm = null) {
    return this.fullText(columns, name, algorithm)
  }

  /**
 * @param {string|Array<string>} columns
 * @param {string|null} [name=null]
 * @param {string|null} [algorithm=null]
 * @returns {IndexDefinition}
 */
  fullText (columns, name = null, algorithm = null) {
    return this.indexCommand('fulltext', columns, name, algorithm)
  }

  /**
   * @param {string|Array<string>} columns
   * @param {string|null} [name=null]
   * @returns {IndexDefinition}
   */
  spatialIndex (columns, name = null) {
    return this.indexCommand('spatialIndex', columns, name)
  }

  /**
   * @param {string} expression
   * @param {string} name
   * @returns {IndexDefinition}
   */
  rawIndex (expression, name) {
    return this.index([new Expression(expression)], name)
  }

  /**
   * @param {string|Array<string>} columns
   * @param {string|null} [name=null]
   * @returns {ForeignKeyDefinition}
   */
  foreign (columns, name = null) {
    const command = new ForeignKeyDefinition(
      this.indexCommand('foreign', columns, name).getAttributes()
    )

    this.commands[this.commands.length - 1] = command

    return command
  }

  /**
   * @param {string} [column='id']
   * @returns {ColumnDefinition}
   */
  id (column = 'id') {
    return this.bigIncrements(column)
  }

  /**
   * @param {string} column
   * @returns {ColumnDefinition}
   */
  increments (column) {
    return this.unsignedInteger(column, true)
  }

  /**
   * Create a new auto-incrementing integer (4-byte) column on the table.
   *
   * @param {string} column
   * @returns {ColumnDefinition}
   */
  integerIncrements (column) {
    return this.unsignedInteger(column, true)
  }

  /**
   * Create a new auto-incrementing tiny integer (1-byte) column on the table.
   *
   * @param {string} column
   * @returns {ColumnDefinition}
   */
  tinyIncrements (column) {
    return this.unsignedTinyInteger(column, true)
  }

  /**
   * Create a new auto-incrementing small integer (2-byte) column on the table.
   *
   * @param {string} column
   * @returns {ColumnDefinition}
   */
  smallIncrements (column) {
    return this.unsignedSmallInteger(column, true)
  }

  /**
   * Create a new auto-incrementing medium integer (3-byte) column on the table.
   *
   * @param {string} column
   * @returns {ColumnDefinition}
   */
  mediumIncrements (column) {
    return this.unsignedMediumInteger(column, true)
  }

  /**
   * Create a new auto-incrementing big integer (8-byte) column on the table.
   *
   * @param {string} column
   * @returns {ColumnDefinition}
   */
  bigIncrements (column) {
    return this.unsignedBigInteger(column, true)
  }

  /**
   * Create a new char column on the table.
   *
   * @param {string} column
   * @param {number|null} [length]
   * @returns {ColumnDefinition}
   */
  char (column, length = null) {
    length = length !== null ? length : Builder.defaultStringLength

    return this.addColumn('char', column, { length })
  }

  /**
   * Create a new string column on the table.
   *
   * @param {string} column
   * @param {number|null} [length]
   * @returns {ColumnDefinition}
   */
  string (column, length = null) {
    length = length !== null ? length : Builder.defaultStringLength

    return this.addColumn('string', column, { length })
  }

  /**
   * Create a new tiny text column on the table.
   *
   * @param {string} column
   * @returns {ColumnDefinition}
   */
  tinyText (column) {
    return this.addColumn('tinyText', column)
  }

  /**
   * Create a new text column on the table.
   *
   * @param {string} column
   * @returns {ColumnDefinition}
   */
  text (column) {
    return this.addColumn('text', column)
  }

  /**
   * Create a new medium text column on the table.
   *
   * @param {string} column
   * @returns {ColumnDefinition}
   */
  mediumText (column) {
    return this.addColumn('mediumText', column)
  }

  /**
   * Create a new long text column on the table.
   *
   * @param {string} column
   * @returns {ColumnDefinition}
   */
  longText (column) {
    return this.addColumn('longText', column)
  }

  /**
   * Create a new integer (4-byte) column on the table.
   *
   * @param {string} column
   * @param {boolean} [autoIncrement=false]
   * @param {boolean} [unsigned=false]
   * @returns {ColumnDefinition}
   */
  integer (column, autoIncrement = false, unsigned = false) {
    return this.addColumn('integer', column, { autoIncrement, unsigned })
  }

  /**
   * Create a new tiny integer (1-byte) column on the table.
   *
   * @param {string} column
   * @param {boolean} [autoIncrement=false]
   * @param {boolean} [unsigned=false]
   * @returns {ColumnDefinition}
   */
  tinyInteger (column, autoIncrement = false, unsigned = false) {
    return this.addColumn('tinyInteger', column, { autoIncrement, unsigned })
  }

  /**
   * Create a new small integer (2-byte) column on the table.
   *
   * @param {string} column
   * @param {boolean} [autoIncrement=false]
   * @param {boolean} [unsigned=false]
   * @returns {ColumnDefinition}
   */
  smallInteger (column, autoIncrement = false, unsigned = false) {
    return this.addColumn('smallInteger', column, { autoIncrement, unsigned })
  }

  /**
   * Create a new medium integer (3-byte) column on the table.
   *
   * @param {string} column
   * @param {boolean} [autoIncrement=false]
   * @param {boolean} [unsigned=false]
   * @returns {ColumnDefinition}
   */
  mediumInteger (column, autoIncrement = false, unsigned = false) {
    return this.addColumn('mediumInteger', column, { autoIncrement, unsigned })
  }

  /**
   * Create a new big integer (8-byte) column on the table.
   *
   * @param {string} column
   * @param {boolean} [autoIncrement=false]
   * @param {boolean} [unsigned=false]
   * @returns {ColumnDefinition}
   */
  bigInteger (column, autoIncrement = false, unsigned = false) {
    return this.addColumn('bigInteger', column, { autoIncrement, unsigned })
  }

  /**
   * Create a new unsigned integer (4-byte) column on the table.
   *
   * @param {string} column
   * @param {boolean} [autoIncrement=false]
   * @returns {ColumnDefinition}
   */
  unsignedInteger (column, autoIncrement = false) {
    return this.integer(column, autoIncrement, true)
  }

  /**
   * Create a new unsigned tiny integer (1-byte) column on the table.
   *
   * @param {string} column
   * @param {boolean} [autoIncrement=false]
   * @returns {ColumnDefinition}
   */
  unsignedTinyInteger (column, autoIncrement = false) {
    return this.tinyInteger(column, autoIncrement, true)
  }

  /**
   * Create a new unsigned small integer (2-byte) column on the table.
   *
   * @param {string} column
   * @param {boolean} [autoIncrement=false]
   * @returns {ColumnDefinition}
   */
  unsignedSmallInteger (column, autoIncrement = false) {
    return this.smallInteger(column, autoIncrement, true)
  }

  /**
   * Create a new unsigned medium integer (3-byte) column on the table.
   *
   * @param {string} column
   * @param {boolean} [autoIncrement=false]
   * @returns {ColumnDefinition}
   */
  unsignedMediumInteger (column, autoIncrement = false) {
    return this.mediumInteger(column, autoIncrement, true)
  }

  /**
   * Create a new unsigned big integer (8-byte) column on the table.
   *
   * @param {string} column
   * @param {boolean} [autoIncrement=false]
   * @returns {ColumnDefinition}
   */
  unsignedBigInteger (column, autoIncrement = false) {
    return this.bigInteger(column, autoIncrement, true)
  }

  /**
   * Create a new unsigned big integer (8-byte) column on the table.
   *
   * @param {string} column
   * @returns {ForeignIdColumnDefinition}
   */
  foreignId (column) {
    return this.addColumnDefinition(new ForeignIdColumnDefinition(this, {
      type: 'bigInteger',
      name: column,
      autoIncrement: false,
      unsigned: true
    }))
  }

  /**
   * Create a foreign ID column for the given model.
   *
   * @param {Model|string} model
   * @param {string|null} [column=null]
   * @returns {ForeignIdColumnDefinition}
   */
  foreignIdFor (model, column = null) {
    if (typeof model === 'string') {
      model = new window[model]() // Assuming model string names are global classes
    }

    column = column || model.getForeignKey()

    if (model.getKeyType() === 'int' && model.getIncrementing()) {
      return this.foreignId(column)
    }

    const modelTraits = classUsesRecursive(model)

    if (modelTraits.includes('HasUlids')) {
      return this.foreignUlid(column)
    }

    return this.foreignUuid(column)
  }

  /**
 * Create a new float column on the table.
 *
 * @param {string} column
 * @param {number} [precision=53]
 * @returns {ColumnDefinition}
 */
  float (column, precision = 53) {
    return this.addColumn('float', column, { precision })
  }

  /**
   * Create a new double column on the table.
   *
   * @param {string} column
   * @returns {ColumnDefinition}
   */
  double (column) {
    return this.addColumn('double', column)
  }

  /**
   * Create a new decimal column on the table.
   *
   * @param {string} column
   * @param {number} [total=8]
   * @param {number} [places=2]
   * @returns {ColumnDefinition}
   */
  decimal (column, total = 8, places = 2) {
    return this.addColumn('decimal', column, { total, places })
  }

  /**
 * Create a new boolean column on the table.
 *
 * @param {string} column
 * @returns {ColumnDefinition}
 */
  boolean (column) {
    return this.addColumn('boolean', column)
  }

  /**
   * Create a new enum column on the table.
   *
   * @param {string} column
   * @param {Array} allowed
   * @returns {ColumnDefinition}
   */
  enum (column, allowed) {
    return this.addColumn('enum', column, { allowed })
  }

  /**
   * Create a new set column on the table.
   *
   * @param {string} column
   * @param {Array} allowed
   * @returns {ColumnDefinition}
   */
  set (column, allowed) {
    return this.addColumn('set', column, { allowed })
  }

  /**
   * Create a new JSON column on the table.
   *
   * @param {string} column
   * @returns {ColumnDefinition}
   */
  json (column) {
    return this.addColumn('json', column)
  }

  /**
   * Create a new JSONB column on the table.
   *
   * @param {string} column
   * @returns {ColumnDefinition}
   */
  jsonb (column) {
    return this.addColumn('jsonb', column)
  }

  /**
   * Create a new date column on the table.
   *
   * @param {string} column
   * @returns {ColumnDefinition}
   */
  date (column) {
    return this.addColumn('date', column)
  }

  /**
   * Create a new date-time column on the table.
   *
   * @param {string} column
   * @param {number|null} [precision=0]
   * @returns {ColumnDefinition}
   */
  dateTime (column, precision = 0) {
    return this.addColumn('dateTime', column, { precision })
  }

  /**
   * Create a new date-time column (with time zone) on the table.
   *
   * @param {string} column
   * @param {number|null} [precision=0]
   * @returns {ColumnDefinition}
   */
  dateTimeTz (column, precision = 0) {
    return this.addColumn('dateTimeTz', column, { precision })
  }

  /**
   * Create a new time column on the table.
   *
   * @param {string} column
   * @param {number|null} [precision=0]
   * @returns {ColumnDefinition}
   */
  time (column, precision = 0) {
    return this.addColumn('time', column, { precision })
  }

  /**
   * Create a new time column (with time zone) on the table.
   *
   * @param {string} column
   * @param {number|null} [precision=0]
   * @returns {ColumnDefinition}
   */
  timeTz (column, precision = 0) {
    return this.addColumn('timeTz', column, { precision })
  }

  /**
   * Create a new timestamp column on the table.
   *
   * @param {string} column
   * @param {number|null} [precision=0]
   * @returns {ColumnDefinition}
   */
  timestamp (column, precision = 0) {
    return this.addColumn('timestamp', column, { precision })
  }

  /**
   * Create a new timestamp (with time zone) column on the table.
   *
   * @param {string} column
   * @param {number|null} [precision=0]
   * @returns {ColumnDefinition}
   */
  timestampTz (column, precision = 0) {
    return this.addColumn('timestampTz', column, { precision })
  }

  /**
   * Add nullable creation and update timestamps to the table.
   *
   * @param {number|null} [precision=0]
   * @returns {void}
   */
  timestamps (precision = 0) {
    this.timestamp('created_at', precision).nullable()

    this.timestamp('updated_at', precision).nullable()
  }

  /**
   * Add nullable creation and update timestamps to the table.
   *
   * Alias for this.timestamps().
   *
   * @param {number|null} [precision=0]
   * @returns {void}
   */
  nullableTimestamps (precision = 0) {
    this.timestamps(precision)
  }

  /**
   * Add creation and update timestampTz columns to the table.
   *
   * @param {number|null} [precision=0]
   * @returns {void}
   */
  timestampsTz (precision = 0) {
    this.timestampTz('created_at', precision).nullable()

    this.timestampTz('updated_at', precision).nullable()
  }

  /**
   * Add creation and update datetime columns to the table.
   *
   * @param {number|null} [precision=0]
   * @returns {void}
   */
  datetimes (precision = 0) {
    this.dateTime('created_at', precision).nullable()
    this.dateTime('updated_at', precision).nullable()
  }

  /**
   * Add a "deleted at" timestamp for the table.
   *
   * @param {string} [column='deleted_at']
   * @param {number|null} [precision=0]
   * @returns {ColumnDefinition}
   */
  softDeletes (column = 'deleted_at', precision = 0) {
    return this.timestamp(column, precision).nullable()
  }

  /**
   * Add a "deleted at" timestampTz for the table.
   *
   * @param {string} [column='deleted_at']
   * @param {number|null} [precision=0]
   * @returns {ColumnDefinition}
   */
  softDeletesTz (column = 'deleted_at', precision = 0) {
    return this.timestampTz(column, precision).nullable()
  }

  /**
   * Add a "deleted at" datetime column to the table.
   *
   * @param {string} [column='deleted_at']
   * @param {number|null} [precision=0]
   * @returns {ColumnDefinition}
   */
  softDeletesDatetime (column = 'deleted_at', precision = 0) {
    return this.dateTime(column, precision).nullable()
  }

  /**
   * Create a new year column on the table.
   *
   * @param {string} column
   * @returns {ColumnDefinition}
   */
  year (column) {
    return this.addColumn('year', column)
  }

  /**
   * Create a new binary column on the table.
   *
   * @param {string} column
   * @param {number|null} [length=null]
   * @param {boolean} [fixed=false]
   * @returns {ColumnDefinition}
   */
  binary (column, length = null, fixed = false) {
    return this.addColumn('binary', column, { length, fixed })
  }

  /**
   * Create a new UUID column on the table.
   *
   * @param {string} [column='uuid']
   * @returns {ColumnDefinition}
   */
  uuid (column = 'uuid') {
    return this.addColumn('uuid', column)
  }

  /**
   * Create a new UUID column on the table with a foreign key constraint.
   *
   * @param {string} column
   * @returns {ForeignIdColumnDefinition}
   */
  foreignUuid (column) {
    return this.addColumnDefinition(new ForeignIdColumnDefinition(this, {
      type: 'uuid',
      name: column
    }))
  }

  /**
   * Create a new ULID column on the table.
   *
   * @param {string} [column='ulid']
   * @param {number|null} [length=26]
   * @returns {ColumnDefinition}
   */
  ulid (column = 'ulid', length = 26) {
    return this.char(column, length)
  }

  /**
   * Create a new ULID column on the table with a foreign key constraint.
   *
   * @param {string} column
   * @param {number|null} [length=26]
   * @returns {ForeignIdColumnDefinition}
   */
  foreignUlid (column, length = 26) {
    return this.addColumnDefinition(new ForeignIdColumnDefinition(this, {
      type: 'char',
      name: column,
      length
    }))
  }

  /**
   * Create a new IP address column on the table.
   *
   * @param {string} [column='ip_address']
   * @returns {ColumnDefinition}
   */
  ipAddress (column = 'ip_address') {
    return this.addColumn('ipAddress', column)
  }

  /**
   * Create a new MAC address column on the table.
   *
   * @param {string} [column='mac_address']
   * @returns {ColumnDefinition}
   */
  macAddress (column = 'mac_address') {
    return this.addColumn('macAddress', column)
  }

  /**
   * Create a new geometry column on the table.
   *
   * @param {string} column
   * @param {string|null} [subtype=null]
   * @param {number} [srid=0]
   * @returns {ColumnDefinition}
   */
  geometry (column, subtype = null, srid = 0) {
    return this.addColumn('geometry', column, { subtype, srid })
  }

  /**
   * Create a new geography column on the table.
   *
   * @param {string} column
   * @param {string|null} [subtype=null]
   * @param {number} [srid=4326]
   * @returns {ColumnDefinition}
   */
  geography (column, subtype = null, srid = 4326) {
    return this.addColumn('geography', column, { subtype, srid })
  }

  /**
   * Create a new generated, computed column on the table.
   *
   * @param {string} column
   * @param {string} expression
   * @returns {ColumnDefinition}
   */
  computed (column, expression) {
    return this.addColumn('computed', column, { expression })
  }

  /**
   * Add the proper columns for a polymorphic table.
   *
   * @param {string} name
   * @param {string|null} [indexName=null]
   * @returns {void}
   */
  morphs (name, indexName = null) {
    if (Builder.defaultMorphKeyType === 'uuid') {
      this.uuidMorphs(name, indexName)
    } else if (Builder.defaultMorphKeyType === 'ulid') {
      this.ulidMorphs(name, indexName)
    } else {
      this.numericMorphs(name, indexName)
    }
  }

  /**
   * Add nullable columns for a polymorphic table.
   *
   * @param {string} name
   * @param {string|null} [indexName=null]
   * @returns {void}
   */
  nullableMorphs (name, indexName = null) {
    if (Builder.defaultMorphKeyType === 'uuid') {
      this.nullableUuidMorphs(name, indexName)
    } else if (Builder.defaultMorphKeyType === 'ulid') {
      this.nullableUlidMorphs(name, indexName)
    } else {
      this.nullableNumericMorphs(name, indexName)
    }
  }

  /**
   * Add the proper columns for a polymorphic table using numeric IDs (incremental).
   *
   * @param {string} name
   * @param {string|null} [indexName=null]
   * @returns {void}
   */
  numericMorphs (name, indexName = null) {
    this.string(`${name}_type`)

    this.unsignedBigInteger(`${name}_id`)

    this.index([`${name}_type`, `${name}_id`], indexName)
  }

  /**
   * Add nullable columns for a polymorphic table using numeric IDs (incremental).
   *
   * @param {string} name
   * @param {string|null} [indexName=null]
   * @returns {void}
   */
  nullableNumericMorphs (name, indexName = null) {
    this.string(`${name}_type`).nullable()

    this.unsignedBigInteger(`${name}_id`).nullable()

    this.index([`${name}_type`, `${name}_id`], indexName)
  }

  /**
   * Add the proper columns for a polymorphic table using UUIDs.
   *
   * @param {string} name
   * @param {string|null} [indexName=null]
   * @returns {void}
   */
  uuidMorphs (name, indexName = null) {
    this.string(`${name}_type`)

    this.uuid(`${name}_id`)

    this.index([`${name}_type`, `${name}_id`], indexName)
  }

  /**
   * Add nullable columns for a polymorphic table using UUIDs.
   *
   * @param {string} name
   * @param {string|null} [indexName=null]
   * @returns {void}
   */
  nullableUuidMorphs (name, indexName = null) {
    this.string(`${name}_type`).nullable()

    this.uuid(`${name}_id`).nullable()

    this.index([`${name}_type`, `${name}_id`], indexName)
  }

  /**
   * Add the proper columns for a polymorphic table using ULIDs.
   *
   * @param {string} name
   * @param {string|null} [indexName=null]
   * @returns {void}
   */
  ulidMorphs (name, indexName = null) {
    this.string(`${name}_type`)

    this.ulid(`${name}_id`)

    this.index([`${name}_type`, `${name}_id`], indexName)
  }

  /**
   * Add nullable columns for a polymorphic table using ULIDs.
   *
   * @param {string} name
   * @param {string|null} [indexName=null]
   * @returns {void}
   */
  nullableUlidMorphs (name, indexName = null) {
    this.string(`${name}_type`).nullable()

    this.ulid(`${name}_id`).nullable()

    this.index([`${name}_type`, `${name}_id`], indexName)
  }

  /**
   * Adds the `remember_token` column to the table.
   *
   * @returns {ColumnDefinition}
   */
  rememberToken () {
    return this.string('remember_token', 100).nullable()
  }

  /**
   * Add a comment to the table.
   *
   * @param {string} comment
   * @returns {Fluent}
   */
  comment (comment) {
    return this.addCommand('tableComment', { comment })
  }

  /**
   * Add a new index command to the blueprint.
   *
   * @protected
   * @param {string} type
   * @param {string|array} columns
   * @param {string} [index]
   * @param {string|null} [algorithm]
   * @returns {Fluent}
   */
  indexCommand (type, columns, index = null, algorithm = null) {
    columns = Array.isArray(columns) ? columns : [columns]

    // If no name was specified for this index, we will create one using a basic
    // convention of the table name, followed by the columns, followed by an
    // index type, such as primary or index, which makes the index unique.
    index = index ?? this.createIndexName(type, columns)

    return this.addCommand(type, { index, columns, algorithm })
  }

  /**
   * Create a new drop index command on the blueprint.
   *
   * @protected
   * @param {string} command
   * @param {string} type
   * @param {string|array|null} index
   * @returns {Fluent}
   */
  dropIndexCommand (command, type, index) {
    let columns = []

    // If the given "index" is actually an array of columns, the developer means
    // to drop an index merely by specifying the columns involved without the
    // conventional name, so we will build the index name from the columns.
    if (Array.isArray(index)) {
      columns = index
      index = this.createIndexName(type, columns)
    }

    return this.indexCommand(command, columns, index)
  }

  /**
   * Create a default index name for the table.
   *
   * @protected
   * @param {string} type
   * @param {array} columns
   * @returns {string}
   */
  createIndexName (type, columns) {
    const table = this.table.includes('.')
      ? this.table.substring(0, this.table.lastIndexOf('.')) + '.' + this.prefix + this.table.substring(this.table.lastIndexOf('.') + 1)
      : this.prefix + this.table

    const index = `${table.toLowerCase()}_${columns.join('_').toLowerCase()}_${type}`

    return index.replace(/[-.]/g, '_')
  }

  /**
   * Add a new column to the blueprint.
   *
   * @param {string} type
   * @param {string} name
   * @param {object} [parameters={}]
   * @returns {ColumnDefinition}
   */
  addColumn (type, name, parameters = {}) {
    return this.addColumnDefinition(new ColumnDefinition(
      Object.assign({ type, name }, parameters)
    ))
  }

  /**
   * Add a new column definition to the blueprint.
   *
   * @protected
   * @param {ColumnDefinition} definition
   * @returns {ColumnDefinition}
   */
  addColumnDefinition (definition) {
    this.columns.push(definition)

    if (!this.creating()) {
      this.commands.push(definition)
    }

    if (this.afterProperty) {
      definition.after(this.afterProperty)

      this.afterProperty = definition.get('name')
    }

    return definition
  }

  /**
   * Add the columns from the callback after the given column.
   *
   * @param {string} column
   * @param {function(Blueprint): void} callbackFunction
   * @returns {void}
   */
  after (column, callbackFunction) {
    this.afterProperty = column

    callbackFunction(this)

    this.afterProperty = null
  }

  /**
   * Remove a column from the schema blueprint.
   *
   * @param {string} name
   * @returns {this}
   */
  removeColumn (name) {
    this.columns = this.columns.filter(c => c.get('name') !== name)

    return this
  }

  /**
   * Add a new command to the blueprint.
   *
   * @protected
   * @param {string} name
   * @param {Record<string, unknown>} [parameters={}]
   * @returns {Fluent}
   */
  addCommand (name, parameters = {}) {
    const command = this.createCommand(name, parameters)

    this.commands.push(command)

    return command
  }

  /**
   * Create a new Fluent command.
   *
   * @protected
   * @param {string} name
   * @param {Record<string, unknown>} [parameters={}]
   * @returns {Fluent}
   */
  createCommand (name, parameters = {}) {
    return new Fluent({ name, ...parameters })
  }

  /**
   * Get the table the blueprint describes.
   *
   * @returns {string}
   */
  getTable () {
    return this.table
  }

  /**
   * Get the table prefix.
   *
   * @returns {string}
   */
  getPrefix () {
    return this.prefix
  }

  /**
   * Get the columns on the blueprint.
   *
   * @returns {ColumnDefinition[]}
   */
  getColumns () {
    return this.columns
  }

  /**
   * Get the commands on the blueprint.
   *
   * @returns {Fluent[]}
   */
  getCommands () {
    return this.commands
  }

  /**
   * Determine if the blueprint has state.
   *
   * @private
   * @param  {any}  name
   * @return {boolean}
   */
  hasState () {
    return !isNil(this.state)
  }

  /**
   * Get the state of the blueprint.
   *
   * @return {BlueprintState}
   */
  getState () {
    return this.state
  }

  /**
   * Get the columns on the blueprint that should be added.
   *
   * @returns {ColumnDefinition[]}
   */
  getAddedColumns () {
    return this.columns.filter(column => !column.get('change'))
  }

  /**
       * Get the columns on the blueprint that should be changed.
   *
   * @returns {ColumnDefinition[]}
   */
  getChangedColumns () {
    return this.columns.filter(column => Boolean(column.get('change')))
  }
}

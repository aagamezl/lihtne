import { collect } from '../../Collections/helpers.js'
import { Expression } from '../Query/internal.js'

export default class BlueprintState {
  /**
   * The blueprint instance.
   *
   * @protected
   * @type {import('./Blueprint.js').default}
   */
  blueprint

  /**
   * The connection instance.
   *
   * @protected
   * @type {import('../Connection.js').default}
   */
  connection

  /**
   * The grammar instance.
   *
   * @protected
   * @type {import('./Grammars/Grammar.js').default}
   */
  grammar

  /**
   * The columns.
   *
   * @private
   * @type {Array<import('./ColumnDefinition.js').default>}
   */
  columns = []

  /**
   * The primary key.
   *
   * @private
   * @type {import('./IndexDefinition.js').default|null}
   */
  primaryKey = null

  /**
   * The indexes.
   *
   * @private
   * @type {Array<import('./IndexDefinition.js').default>}
   */
  indexes = []

  /**
   * The foreign keys.
   *
   * @private
   * @type {Array<import('./ForeignKeyDefinition.js').default>}
   */
  foreignKeys = []

  /**
   * Create a new blueprint state instance.
   *
   * @param {import('./Blueprint.js').default} blueprint
   * @param {import('../Connection.js').default} connection
   * @param {import('./Grammars/Grammar.js').default} grammar
   */
  constructor (blueprint, connection, grammar) {
    this.blueprint = blueprint
    this.connection = connection
    this.grammar = grammar

    const schema = connection.getSchemaBuilder()
    const table = blueprint.getTable()

    this.columns = schema.getColumns(table).map(column => ({
      name: column.get('name'),
      type: column.get('type_name'),
      full_type_definition: column.get('type'),
      nullable: column.get('nullable'),
      default: column.get('default') ? new Expression(column.get('default')) : null,
      autoIncrement: column.get('auto_increment'),
      collation: column.get('collation'),
      comment: column.get('comment'),
      virtualAs: column.get('generation') && column.get('generation').type === 'virtual' ? column.get('generation').expression : null,
      storedAs: column.get('generation') && column.get('generation').type === 'stored' ? column.get('generation').expression : null
    }))

    const [primary, indexes] = schema.getIndexes(table).map(index => ({
      name: index.primary ? 'primary' : index.unique ? 'unique' : 'index',
      index: index.name,
      columns: index.columns
    })).partition(index => index.name === 'primary')

    this.indexes = indexes
    this.primaryKey = primary[0] || null

    this.foreignKeys = collect(schema.getForeignKeys(table)).map(foreignKey => ({
      columns: foreignKey.columns,
      on: foreignKey.foreign_table,
      references: foreignKey.foreign_columns,
      onUpdate: foreignKey.on_update,
      onDelete: foreignKey.on_delete
    })).all()
  }
}

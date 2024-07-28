import ColumnDefinition from './ColumnDefinition.js'

/** @typedef {import('./Blueprint.js').default} Blueprint */

export default class ForeignIdColumnDefinition extends ColumnDefinition {
  /**
   * The schema builder blueprint instance.
   *
   * @protected
   * @type {Blueprint}
   */
  blueprint

  /**
   * Create a new foreign ID column definition.
   *
   * @param  {Blueprint}  blueprint
   * @param  {Record<string, unknown> | undefined}  attributes
   * @return void
   */
  constructor (blueprint, attributes = {}) {
    super(attributes)

    this.blueprint = blueprint
  }
}

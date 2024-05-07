export default class Expression {
  /**
   * The value of the expression.
   *
   * @protected
   * @type {string|number}
   */
  value = -1

  /**
   * Create a new raw query expression.
   *
   * @param  {string|number}  value
   */
  constructor (value) {
    this.value = value
  }

  /**
   * Get the value of the expression.
   *
   * @param  {import('../Grammar').default}  grammar
   * @return {string|number}
   */
  getValue (grammar) {
    return this.value
  }
}

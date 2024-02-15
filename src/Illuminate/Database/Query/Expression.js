export default class Expression {
  /**
   * Create a new raw query expression.
   *
   * @param  {unknown}  value
   * @returns {void}
   */
  constructor (value) {
    this.value = value
  }

  /**
   * Get the value of the expression.
   *
   * @return {unknown}
   */
  getValue () {
    return this.value
  }

  /**
   * Get the value of the expression.
   *
   * @return {string}
   */
  toString () {
    return String(this.getValue())
  }
}

export default class HigherOrderTapProxy {
  /**
   * Create a new tap proxy instance.
  *
  * @param  {unknown}  target
  * @return {void}
  */
  constructor (target) {
    /**
     * The target being tapped.
     *
     * @type {unknown}
     */
    this.target = target
  }
}

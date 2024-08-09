export default class Dispatcher {
  /**
   * Dispatch an event and call the listeners.
   *
   * @param  {string|object}  event
   * @param  {any}  payload
   * @param  {boolean}  halt
   * @return {array|null}
   */
  dispatch (event, payload = [], halt = false) { }

  /**
   * Register an event listener with the dispatcher.
   *
   * @param  {Function|string|array}  events
   * @param  {Function|string|array|null}  [listener]
   * @return {void}
   */
  listen (events, listener = null) { }
}

export interface Dispatcher {
  /**
   * Dispatch an event and call the listeners.
   *
   * @param  {string|object}  event
   * @param  {any}  payload
   * @param  {boolean}  halt
   * @return {array|null}
   */
  dispatch(event: string | object, payload?: any, halt?: boolean): any[] | null;

  /**
   * Register an event listener with the dispatcher.
   *
   * @param  {Function|string|array}  events
   * @param  {Function|string|array|null}  [listener]
   * @return {void}
   */
  listen(events: any, listener?: any): void;
}

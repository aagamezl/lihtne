type EventCallback = (...args: unknown[]) => unknown

export interface Dispatcher {
  /**
   * Register an event listener with the dispatcher.
   *
   * @param  \Closure|string|array  $events
   * @param  \Closure|string|array|null  $listener
   * @return void
   */
  listen(
    events: EventCallback | string | Array<EventCallback | string>,
    listener?: EventCallback | string | Array<EventCallback | string> | null
  ): void;

  /**
   * Register an event listener with the dispatcher.
   *
   * @param  string|object  $event
   * @param  mixed  $payload
   * @param  bool  $halt
   * @return array|null
   */
  dispatch(
    event: string | object,
    payload?: unknown,
    halt?: boolean
  ): unknown[] | null;
}

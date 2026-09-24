import { Conditionable } from '../../Conditionable/Traits/Conditionable'

export class BuildsQueries extends Conditionable {
  /**
 * Pass the query to a given callback and then return it.
 *
 * @param  callable($this): mixed  $callback
 * @return $this
 */
  public tap (callback: (query: this) => void): this {
    callback(this)

    return this
  }

  /**
 * Pass the query to a given callback and return the result.
 *
 * @template TReturn
 *
 * @param  (callable($this): TReturn)  $callback
 * @return (TReturn is null|void ? $this : TReturn)
 */
  public pipe (callback: <TReturn>(query: this) => TReturn): this {
    return (callback(this) ?? this)
  }
}

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
    return callback(this) ?? this
  }

  /**
   * Execute the query and get the first result.
   *
   * @param  array|string  $columns
   * @return TValue|null
   */
  public first (columns: Array<string> = ['*']): Promise<unknown> {
    return this.limit(1).get(columns).first()
  }

  /**
   * Execute the query and get the first result or throw an exception.
   *
   * @param  array|string  $columns
   * @param  string|null  $message
   * @return TValue
   *
   * @throws \Illuminate\Database\RecordNotFoundException
   */
  public async firstOrFail (
    $columns = ['*'],
    message: string | undefined = undefined
  ): Promise<unknown> {
    const result = await this.first($columns)

    if (result !== undefined) {
      return result
    }

    const errorMessage = message
      ? `RecordNotFoundException: ${message}`
      : 'RecordNotFoundException: No record found for the given query.'

    throw new Error(errorMessage)
  }
}

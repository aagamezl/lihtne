export type IndexHintType = 'use' | 'ignore' | 'force' | 'hint'

export class IndexHint {
  /**
   * The type of query hint.
   *
   * @var string
   */
  public type: IndexHintType

  /**
   * The name of the index.
   *
   * @var string
   */
  public index: string

  /**
   * Create a new index hint instance.
   *
   * @param  string  $type
   * @param  string  $index
   */
  public constructor (type: IndexHintType, index: string) {
    this.type = type
    this.index = index
  }
}

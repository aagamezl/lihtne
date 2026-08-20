export class IndexHint {
  /**
   * The type of query hint.
   */
  public type: string

  /**
   * The name of the index.
   */
  public index: string

  /**
   * Create a new index hint instance.
   */
  public constructor(type: string, index: string) {
    this.type = type
    this.index = index
  }
}

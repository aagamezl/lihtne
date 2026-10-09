import { Collection } from '../Collections/Collection'

export class Cursor {
  protected parametersProperty: Record<string, unknown>

  protected pointsToNextItemsProperty: boolean

  constructor (
    parameters: Record<string, unknown>,
    pointsToNextItems: boolean = true
  ) {
    this.parametersProperty = parameters
    this.pointsToNextItemsProperty = pointsToNextItems
  }

  public parameter (parameterName: string): unknown {
    if (!(parameterName in this.parametersProperty)) {
      throw new Error(
        `UnexpectedValueException: Unable to find parameter [${parameterName}] in pagination item.`
      )
    }

    return this.parametersProperty[parameterName]
  }

  /**
   * Get the given parameters from the cursor.
   *
   * @param  array  $parameterNames
   * @return array
   */
  public parameters (parameterNames: string[]): unknown[] {
    return (new Collection<string, unknown>(parameterNames))
      .map((parameterName) => this.parameter(parameterName))
      .toArray()
  }

  /**
   * Determine whether the cursor points to the next set of items.
   *
   * @return bool
   */
  public pointsToNextItems (): boolean {
    return this.pointsToNextItemsProperty
  }

  public pointsToPreviousItems (): boolean {
    return !this.pointsToNextItemsProperty
  }

  public toArray (): Record<string, unknown> {
    return {
      ...this.parametersProperty,
      _pointsToNextItems: this.pointsToNextItemsProperty
    }
  }

  public encode (): string {
    return Buffer.from(JSON.stringify(this.toArray()))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '')
  }

  /**
   * Get a cursor instance from the encoded string representation.
   *
   * @param  string|undefined  $encodedString
   * @return static|undefined
   */
  public static fromEncoded (encodedString: string | undefined): Cursor | undefined {
    if (typeof encodedString !== 'string') {
      return undefined
    }

    const json = Buffer.from(
      encodedString.replace(/-/g, '+').replace(/_/g, '/'),
      'base64'
    ).toString('utf8')

    const parameters = JSON.parse(json)

    if (!Array.isArray(parameters) || !('_pointsToNextItems' in parameters)) {
      return undefined
    }

    const pointsToNextItems = parameters._pointsToNextItems
    delete parameters._pointsToNextItems

    return new Cursor(parameters, pointsToNextItems)
  }
}

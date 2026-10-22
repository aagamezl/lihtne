import { Collection } from '../Collections/Collection'

const isCursorPayload = (
  value: unknown
): value is Record<string, unknown> & { _pointsToNextItems: boolean } => {
  return (
    typeof value === 'object' &&
    value !== null &&
    '_pointsToNextItems' in value &&
    typeof value._pointsToNextItems === 'boolean'
  )
}

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

  /**
   * Get a cursor instance from the encoded string representation.
   *
   * @param  string|undefined  $encodedString
   * @return static|undefined
   */
  public static fromEncoded (
    encodedString: string | undefined
  ): Cursor | undefined {
    if (typeof encodedString !== 'string') {
      return undefined
    }

    const json = Buffer.from(
      encodedString.replace(/-/g, '+').replace(/_/g, '/'),
      'base64'
    ).toString('utf8')

    const parameters: unknown = JSON.parse(json)

    if (!isCursorPayload(parameters)) {
      return undefined
    }

    const { _pointsToNextItems: pointsToNextItems, ...cursorParameters } =
      parameters

    return new Cursor(cursorParameters, pointsToNextItems)
  }

  public encode (): string {
    return Buffer.from(JSON.stringify(this.toArray()))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '')
  }

  /**
   * Get the given parameter from the cursor.
   *
   * @param  string  $parameterName
   * @return string|null
   *
   * @throws \UnexpectedValueException
   */
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
    return new Collection<number, string>(parameterNames)
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
}

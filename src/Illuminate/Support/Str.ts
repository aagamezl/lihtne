export class Str {
  /**
   * Get the portion of a string before the last occurrence of a given value.
   *
   * @param  string  $subject
   * @param  string  $search
   * @return string
   */
  public static beforeLast (subject: string, search: string): string {
    if (search === '') {
      return subject
    }

    const pos = subject.lastIndexOf(search)

    if (pos === -1) {
      return subject
    }

    return Str.substr(subject, 0, pos)
  }

  /**
   * Returns the portion of the string specified by the start and length parameters.
   *
   * @param  string  $string
   * @param  int  $start
   * @param  int|null  $length
   * @param  string  $encoding
   * @return string
   */
  public static substr (
    string: string,
    start: number,
    length: number | undefined = undefined
  ): string {
    return string.substring(start, length)
  }

  /**
   * Replace a given value in the string sequentially with an array.
   *
   * @param  string  $search
   * @param  string[]  $replace
   * @param  string  $subject
   * @return string
   */
  public static replaceArray (search: string, replace: string[], subject: string): string {
    const segments = subject.split(search)
    const replacements = replace.slice()

    let result = segments.shift() ?? ''

    for (const segment of segments) {
      result += this.toStringOr(replacements.shift() ?? search, search) + segment
    }

    return result
  }

  /**
   * Convert the given value to a string or return the given fallback on failure.
   *
   * @param  mixed  $value
   * @param  string  $fallback
   * @return string
   */
  private static toStringOr (value: unknown, fallback: string): string {
    try {
      return String(value)
    } catch (_) {
      return fallback
    }
  }

  /**
   * Get a new stringable object from the given string.
   *
   * @param  string  $string
   * @return \Illuminate\Support\Stringable
   */
  public static of (string: string): string {
    return String(string)
  }

  /**
   * Returns the number of substring occurrences.
   *
   * @param  string  $haystack
   * @param  string  $needle
   * @param  int  $offset
   * @param  int|null  $length
   * @return int
   */
  public static substrCount (
    haystack: string,
    needle: string,
    offset = 0,
    length: number | undefined = undefined
  ): number {
    if (length !== undefined) {
      return haystack.substring(offset, length).split(needle).length - 1
    }

    return haystack.substring(offset).split(needle).length - 1
  }
}

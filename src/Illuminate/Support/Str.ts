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
   * Determine if a given string contains a given substring.
   *
   * @param  string  $haystack
   * @param  string|iterable<string>  $needles
   * @param  bool  $ignoreCase
   * @return ($needles is array{} ? false : ($haystack is non-empty-string ? bool : false))
   */
  public static contains (haystack: string, needles: string | string[], ignoreCase = false): boolean {
    if (haystack === undefined) {
      return false
    }

    if (ignoreCase) {
      haystack = haystack.toLowerCase()
    }

    if (!Array.isArray(needles)) {
      needles = [needles]
    }

    for (let needle of needles) {
      if (ignoreCase) {
        needle = needle.toLowerCase()
      }

      if (needle !== '' && haystack.includes(needle)) {
        return true
      }
    }

    return false
  }

  /**
   * Return the remainder of a string after the first occurrence of a given value.
   *
   * @param  string  $subject
   * @param  string  $search
   * @return string
   */
  public static after (subject: string, search: string): string {
    return search === '' ? subject : Array.from(subject.split(search)).reverse()[0] ?? ''
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
   * Replace the first occurrence of a given value in the string.
   *
   * @param  string  $search
   * @param  string  $replace
   * @param  string  $subject
   * @return string
   */
  public static replaceFirst (
    search: string,
    replace: string,
    subject: string
  ): string {
    search = String(search)

    if (search === '') {
      return subject
    }

    const position = subject.indexOf(search)

    if (position !== -1) {
      return (
        subject.substring(0, position) +
        replace +
        subject.substring(position + search.length)
      )
    }

    return subject
  }

  /**
   * Replace a given value in the string sequentially with an array.
   *
   * @param  string  $search
   * @param  string[]  $replace
   * @param  string  $subject
   * @return string
   */
  public static replaceArray (
    search: string,
    replace: string[],
    subject: string
  ): string {
    const segments = subject.split(search)
    const replacements = replace.slice()

    let result = segments.shift() ?? ''

    for (const segment of segments) {
      result +=
        this.toStringOr(replacements.shift() ?? search, search) + segment
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

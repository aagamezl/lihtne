export default class Str {
  /**
 * Determine if a given string contains a given substring.
 *
 * @param  {string}  haystack
 * @param  {string|string[]}  needles
 * @param  {boolean}  ignoreCase
 * @return {boolean}
 */
  static contains (haystack, needles, ignoreCase = false) {
    if (ignoreCase) {
      haystack = haystack.toLowerCase()

      needles = [...needles].map((needle) => needle.toLowerCase())
    }

    for (const needle of needles) {
      if (haystack.includes(needle)) {
        return true
      }
    }

    return false
  }
}

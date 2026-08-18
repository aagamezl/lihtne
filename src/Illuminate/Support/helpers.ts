/**
 *
 * @param {string} type
 * @param {string} [message]
 * @throws {RuntimeException}
 */
export const CustomException = (type: string, message?: string): Error => {
  switch (type) {
    case 'abstract':
      return new Error(
        'RuntimeException: Cannot create an instance of an abstract class.'
      )

    case 'concrete-method':
      return new Error(
        `RuntimeException: Implement ${message} method on concrete class.`
      )

    default:
      return new Error(
        'RuntimeException: Cannot create an instance of an abstract class.'
      )
  }
}

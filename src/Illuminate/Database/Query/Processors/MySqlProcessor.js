import Processor from './Processor.js'

export default class MySqlProcessor extends Processor {
  /**
   * Process the results of a column listing query.
   *
   * @param  {Array}  results
   * @return {Array}
   */
  processColumnListing (results) {
    return results.map((result) => {
      return result.column_name
    })
  }
}

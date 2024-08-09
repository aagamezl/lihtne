import pg from 'pg'
import { uuid } from '@devnetic/utils'

import Statement from './Statement.js'

export default class PostgresStatement extends Statement {
  /**
   * Creates an instance of Statement.
   * @param {string} dsn
   * @param {Record<string, unknown>} options
   * @param {string} query
   * @memberof Statement
   */
  constructor (dsn, options, query) {
    super(dsn, options, query)

    this.client = new pg.Client({
      connectionString: this.dsn,
      connectionTimeoutMillis: 2000
    })

    this.statement = {
      // give the query a unique name
      name: `prepared-statement-${uuid()}`,
      text: this.parameterize(query),
      rowMode: this.fetchMode
    }

    this.bindings = {}
  }

  async close () {
    await this.client.end()
  }

  /**
   *
   * @param {unknown[]} values
   * @returns {Promise<any[]>}
   */
  async execute (values) {
    values = values ?? Object.values(this.bindings)

    if (Object.values(values).length > 0) {
      this.statement.values = values
    }

    try {
      await this.client.connect()

      this.result = await this.client.query(this.statement)

      return this.result.rows
    } finally {
      await this.close()
    }
  }

  fetchAll () {
    return this.result.rows
  }

  parameterize (query) {
    const regex = /\?/gm

    if (query.match(regex) === null) {
      return query
    }

    let index = 0
    return query.replace(regex, () => `$${++index}`)
  }

  rowCount () {
    return this.result.rowCount
  }
}

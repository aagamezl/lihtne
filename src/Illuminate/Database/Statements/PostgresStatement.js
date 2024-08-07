import pg from 'pg'
import { uuid } from '@devnetic/utils'

import Statement from './Statement.js'

export default class PostgresStatement extends Statement {
  constructor (dsn, options) {
    super(dsn, options)

    this.pool = new pg.Pool({
      connectionString: this.dsn,
      max: 50,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000

    })
  }

  async close () {
    await this.pool.end()
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

    let client

    try {
      client = await this.pool.connect()

      this.result = await client.query(this.statement)

      return this.result.rows
    } finally {
      // await client.end()
      client.end()
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

  prepare (query) {
    this.statement = {
      // give the query a unique name
      name: `prepared-statement-${uuid()}`,
      text: this.parameterize(query),
      rowMode: this.fetchMode
    }

    this.bindings = {}

    return this
  }

  rowCount () {
    return this.result.rowCount
  }
}

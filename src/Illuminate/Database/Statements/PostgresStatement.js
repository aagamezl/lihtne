import pg from 'pg'
import { uuid } from '@devnetic/utils'

import Statement from './Statement.js'

export default class PostgresStatement extends Statement {
  constructor (dsn, options) {
    super(dsn, options)

    this.pool = new pg.Pool({
      connectionString: this.dsn
    })
  }

  async execute () {
    const values = Object.values(this.bindings)

    if (values.length > 0) {
      this.statement.values = values
    }

    let client

    try {
      client = await this.pool.connect()

      this.result = await client.query(this.statement)

      return this.result
    } finally {
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

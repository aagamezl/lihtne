import { describe, expect, jest, test } from '@jest/globals'

import { getBuilder } from './helpers/getBuilder'

describe('Database Query Builder', () => {
  test('testBasicSelect', () => {
    const builder = getBuilder()
    builder.select('*').from('users')

    expect(builder.toSql()).toBe('select * from "users"')
  })

  test('testBasicSelectWithGetColumns', async () => {
    const builder = getBuilder()

    const processor = builder.getProcessor()
    const connection = builder.getConnection()

    // processSelect expectation
    jest
      .spyOn(processor, 'processSelect')
      .mockImplementation(() => ({}))

    // select expectations (sequential)
    jest.spyOn(connection, 'select')
      .mockImplementationOnce((sql: string) => {
        expect(sql).toBe('select * from "users"')

        return Promise.resolve([])
      })
      .mockImplementationOnce((sql: string) => {
        expect(sql).toBe('select "foo", "bar" from "users"')

        return Promise.resolve([])
      })
      .mockImplementationOnce((sql: string) => {
        expect(sql).toBe('select "baz" from "users"')

        return Promise.resolve([])
      })

    builder.from('users').get()
    expect(builder.columns).toEqual([])

    builder.from('users').get(['foo', 'bar'])
    expect(builder.columns).toEqual([])

    builder.from('users').get('baz')
    expect(builder.columns).toEqual([])

    expect(builder.toSql()).toBe('select * from "users"')
    expect(builder.columns).toEqual([])

    expect(connection.select).toHaveBeenCalledTimes(3)
  })
})

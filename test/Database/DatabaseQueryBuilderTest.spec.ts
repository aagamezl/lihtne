import { describe, expect, jest, test } from '@jest/globals'

import { getBuilder } from './helpers/getBuilder'
// import { getMySqlBuilderWithProcessor } from './helpers/getMySqlBuilderWithProcessor'
import { getConnection } from './helpers/getConnection'

describe('Database Query Builder', () => {
  test('testBasicSelect', () => {
    const builder = getBuilder()
    builder.select('*').from('users')

    expect(builder.toSql()).toBe('select * from "users"')
  })

  // test('testBasicSelectWithGetColumns', async () => {
  //   const builder = getBuilder()

  //   const processor = builder.getProcessor()
  //   const connection = builder.getConnection()

  //   // processSelect expectation
  //   jest
  //     .spyOn(processor, 'processSelect')
  //     .mockImplementation(() => ({}))

  //   // select expectations (sequential)
  //   jest.spyOn(connection, 'select')
  //     .mockImplementationOnce((sql: string) => {
  //       expect(sql).toBe('select * from "users"')

  //       return Promise.resolve([])
  //     })
  //     .mockImplementationOnce((sql: string) => {
  //       expect(sql).toBe('select "foo", "bar" from "users"')

  //       return Promise.resolve([])
  //     })
  //     .mockImplementationOnce((sql: string) => {
  //       expect(sql).toBe('select "baz" from "users"')

  //       return Promise.resolve([])
  //     })

  //   builder.from('users').get()
  //   expect(builder.columns).toEqual([])

  //   builder.from('users').get(['foo', 'bar'])
  //   expect(builder.columns).toEqual([])

  //   builder.from('users').get('baz')
  //   expect(builder.columns).toEqual([])

  //   expect(builder.toSql()).toBe('select * from "users"')
  //   expect(builder.columns).toEqual([])

  //   expect(connection.select).toHaveBeenCalledTimes(3)
  // })

  // test('testBasicMySqlSelect', async () => {
  //   const builder = getMySqlBuilderWithProcessor()

  //   const connection = builder.getConnection()

  //   jest.spyOn(connection, 'select')
  //     .mockImplementationOnce((sql: string) => {
  //       expect(sql).toBe('select * from `users`')

  //       return Promise.resolve([])
  //     })
  //   // connectionMock.expects('select').once()
  //   //   .withArgs('select * from `users`', [])

  //   await builder.select('*').from('users').get()
  // })
})

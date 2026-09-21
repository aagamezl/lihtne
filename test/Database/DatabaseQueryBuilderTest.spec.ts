import { describe, expect, jest, test } from '@jest/globals'

import { getBuilder } from './helpers/getBuilder'
import { getMySqlBuilderWithProcessor } from './helpers/getMySqlBuilderWithProcessor'
import { getPostgresBuilder } from './helpers/getPostgresBuilder'

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

    jest
      .spyOn(processor, 'processSelect')
      .mockImplementation(() => ({}))

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

  test('testBasicMySqlSelect', async () => {
    const builder = getMySqlBuilderWithProcessor()

    const connection = builder.getConnection()

    jest.spyOn(connection, 'select')
      .mockImplementationOnce((sql: string) => {
        expect(sql).toBe('select * from `users`')

        return Promise.resolve([])
      })

    await builder.select('*').from('users').get()
  })

  test('testBasicTableWrappingProtectsQuotationMarks', () => {
    const builder = getBuilder()

    builder.select('*').from('some"table')
    expect(builder.toSql()).toBe('select * from "some""table"')
  })

  test('testAliasWrappingAsWholeConstant', () => {
    const builder = getBuilder()

    builder.select('x.y as foo.bar').from('baz')
    expect(builder.toSql()).toBe('select "x"."y" as "foo.bar" from "baz"')
  })

  test('testAliasWrappingWithSpacesInDatabaseName', () => {
    const builder = getBuilder()

    builder.select('w x.y.z as foo.bar').from('baz')
    expect(builder.toSql()).toBe('select "w x"."y"."z" as "foo.bar" from "baz"')
  })

  test('testAddingSelects', () => {
    const builder = getBuilder()

    builder.select('foo').addSelect('bar').addSelect(['baz', 'boom']).addSelect('bar').from('users')
    expect(builder.toSql()).toBe('select "foo", "bar", "baz", "boom" from "users"')
  })

  test('testBasicSelectWithPrefix', () => {
    const builder = getBuilder('prefix_')

    builder.select('*').from('users')
    expect(builder.toSql()).toBe('select * from "prefix_users"')
  })

  test('testBasicSelectDistinct', () => {
    const builder = getBuilder()

    builder.distinct().select('foo', 'bar').from('users')
    expect(builder.toSql()).toBe('select distinct "foo", "bar" from "users"')
  })

  test('testBasicSelectDistinctOnColumns', () => {
    let builder = getBuilder()
    builder.distinct('foo').select('foo', 'bar').from('users')
    expect('select distinct "foo", "bar" from "users"').toBe(builder.toSql())

    builder = getPostgresBuilder()
    builder.distinct('foo').select('foo', 'bar').from('users')
    expect('select distinct on ("foo") "foo", "bar" from "users"').toBe(builder.toSql())
  })

  test('', () => {
  })
})

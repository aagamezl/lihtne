import { describe, expect, jest, test } from '@jest/globals'

import type { Builder } from '../../src/Illuminate/Database/Query'

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
      .mockImplementation(() => [])

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

    await builder.from('users').get()
    expect(builder.columns).toEqual([])

    await builder.from('users').get(['foo', 'bar'])
    expect(builder.columns).toEqual([])

    await builder.from('users').get('baz')
    expect(builder.columns).toEqual([])

    expect(builder.toSql()).toBe('select * from "users"')
    expect(builder.columns).toEqual([])

    expect(processor.processSelect).toHaveBeenCalledTimes(3)
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

  test('testBasicAlias', () => {
    const builder = getBuilder()
    builder.select('foo as bar').from('users')
    expect(builder.toSql()).toBe('select "foo" as "bar" from "users"')
  })

  test('testAliasWithPrefix', () => {
    const builder = getBuilder('prefix_')
    builder.select('*').from('users as people')
    expect(builder.toSql()).toBe('select * from "prefix_users" as "prefix_people"')
  })

  test('testJoinAliasesWithPrefix', () => {
    const builder = getBuilder('prefix_')
    builder.select('*').from('services').join('translations AS t', 't.item_id', '=', 'services.id')
    expect(builder.toSql()).toBe('select * from "prefix_services" inner join "prefix_translations" as "prefix_t" on "prefix_t"."item_id" = "prefix_services"."id"')
  })

  test('testBasicTableWrapping', () => {
    const builder = getBuilder()
    builder.select('*').from('public.users')
    expect(builder.toSql()).toBe('select * from "public"."users"')
  })

  test('testWhenCallback', () => {
    const callback = (query: Builder, condition: boolean) => {
      expect(condition).toBe(true)

      query.where('id', '=', 1)
    }

    let builder = getBuilder()
    builder.select('*').from('users').when(true, callback).where('email', 'foo')
    expect(builder.toSql()).toBe('select * from "users" where "id" = ? and "email" = ?')

    builder = getBuilder()
    builder.select('*').from('users').when(false, callback).where('email', 'foo')
    expect(builder.toSql()).toBe('select * from "users" where "email" = ?')
  })

  test('testWhenCallbackWithReturn', () => {
    const callback = (query: Builder, condition: boolean) => {
      expect(condition).toBe(true);

      return query.where('id', '=', 1);
    };

    let builder = getBuilder();
    builder.select('*').from('users').when(true, callback).where('email', 'foo');
    expect(builder.toSql()).toBe('select * from "users" where "id" = ? and "email" = ?');

    builder = getBuilder();
    builder.select('*').from('users').when(false, callback).where('email', 'foo');
    expect(builder.toSql()).toBe('select * from "users" where "email" = ?');
  })

  test('testWhenCallbackWithDefault', () => {
    const callback = (query: Builder, condition: string | number) => {
      expect(condition).toBe('truthy');

      query.where('id', '=', 1);
    };

    const defaultValue = (query: Builder, condition: string | number) => {
      expect(condition).toBe(0);

      query.where('id', '=', 2);
    };

    let builder = getBuilder();
    builder.select('*').from('users').when('truthy', callback, defaultValue).where('email', 'foo');
    expect(builder.toSql()).toBe('select * from "users" where "id" = ? and "email" = ?');
    expect(builder.getBindings()).toEqual([1, 'foo']);

    builder = getBuilder();
    builder.select('*').from('users').when(0, callback, defaultValue).where('email', 'foo');
    expect(builder.toSql()).toBe('select * from "users" where "id" = ? and "email" = ?');
    expect(builder.getBindings()).toEqual([2, 'foo']);
  })

  test('testUnlessCallback', () => {
    const callback = (query: Builder, condition: boolean) => {
      expect(condition).toBe(false);

      query.where('id', '=', 1);
    };

    let builder = getBuilder();
    builder.select('*').from('users').unless(false, callback).where('email', 'foo');
    expect(builder.toSql()).toBe('select * from "users" where "id" = ? and "email" = ?');

    builder = getBuilder();
    builder.select('*').from('users').unless(true, callback).where('email', 'foo');
    expect(builder.toSql()).toBe('select * from "users" where "email" = ?');
  })

  test('', () => {
  })
})

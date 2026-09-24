import { describe, expect, jest, test } from '@jest/globals'

import type { Builder } from '../../src/Illuminate/Database/Query'

import { Expression as Raw } from '../../src/Illuminate/Database/Query/Expression'
import { Str } from '../../src/Illuminate/Support'
import { getBuilder } from './helpers/getBuilder'
import { getMariaDbBuilder } from './helpers/getMariaDbBuilder'
import { getMySqlBuilder } from './helpers/getMySqlBuilder'
import { getMySqlBuilderWithProcessor } from './helpers/getMySqlBuilderWithProcessor'
import { getPostgresBuilder } from './helpers/getPostgresBuilder'
import { getSQLiteBuilder } from './helpers/getSQLiteBuilder'
import { getSqlServerBuilder } from './helpers/getSqlServerBuilder'

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
      expect(condition).toBe(true)

      return query.where('id', '=', 1)
    }

    let builder = getBuilder()
    builder.select('*').from('users').when(true, callback).where('email', 'foo')
    expect(builder.toSql()).toBe('select * from "users" where "id" = ? and "email" = ?')

    builder = getBuilder()
    builder.select('*').from('users').when(false, callback).where('email', 'foo')
    expect(builder.toSql()).toBe('select * from "users" where "email" = ?')
  })

  test('testWhenCallbackWithDefault', () => {
    const callback = (query: Builder, condition: string | number) => {
      expect(condition).toBe('truthy')

      query.where('id', '=', 1)
    }

    const defaultValue = (query: Builder, condition: string | number) => {
      expect(condition).toBe(0)

      query.where('id', '=', 2)
    }

    let builder = getBuilder()
    builder.select('*').from('users').when('truthy', callback, defaultValue).where('email', 'foo')
    expect(builder.toSql()).toBe('select * from "users" where "id" = ? and "email" = ?')
    expect(builder.getBindings()).toEqual([1, 'foo'])

    builder = getBuilder()
    builder.select('*').from('users').when(0, callback, defaultValue).where('email', 'foo')
    expect(builder.toSql()).toBe('select * from "users" where "id" = ? and "email" = ?')
    expect(builder.getBindings()).toEqual([2, 'foo'])
  })

  test('testUnlessCallback', () => {
    const callback = (query: Builder, condition: boolean) => {
      expect(condition).toBe(false)

      query.where('id', '=', 1)
    }

    let builder = getBuilder()
    builder.select('*').from('users').unless(false, callback).where('email', 'foo')
    expect(builder.toSql()).toBe('select * from "users" where "id" = ? and "email" = ?')

    builder = getBuilder()
    builder.select('*').from('users').unless(true, callback).where('email', 'foo')
    expect(builder.toSql()).toBe('select * from "users" where "email" = ?')
  })

  test('testUnlessCallbackWithReturn', () => {
    const callback = (query: Builder, condition: boolean) => {
      expect(condition).toBe(false)

      return query.where('id', '=', 1)
    }

    let builder = getBuilder()
    builder.select('*').from('users').unless(false, callback).where('email', 'foo')
    expect(builder.toSql()).toBe('select * from "users" where "id" = ? and "email" = ?')

    builder = getBuilder()
    builder.select('*').from('users').unless(true, callback).where('email', 'foo')
    expect(builder.toSql()).toBe('select * from "users" where "email" = ?')
  })

  test('testUnlessCallbackWithDefault', () => {
    const callback = (query: Builder, condition: number) => {
      expect(condition).toBe(0)

      query.where('id', '=', 1)
    }

    const defaultValue = (query: Builder, condition: string) => {
      expect(condition).toBe('truthy')

      query.where('id', '=', 2)
    }

    let builder = getBuilder()
    builder.select('*').from('users').unless(0, callback, defaultValue).where('email', 'foo')
    expect(builder.toSql()).toBe('select * from "users" where "id" = ? and "email" = ?')
    expect(builder.getBindings()).toEqual([1, 'foo'])

    builder = getBuilder()
    builder.select('*').from('users').unless('truthy', callback, defaultValue).where('email', 'foo')
    expect(builder.toSql()).toBe('select * from "users" where "id" = ? and "email" = ?')
    expect(builder.getBindings()).toEqual([2, 'foo'])
  })

  test('testTapCallback', () => {
    const callback = (query: Builder) => {
      return query.where('id', '=', 1)
    }

    const builder = getBuilder()
    builder.select('*').from('users').tap(callback).where('email', 'foo')
    expect(builder.toSql()).toBe('select * from "users" where "id" = ? and "email" = ?')
  })

  test('testPipeCallback', () => {
    const query = getBuilder()

    let result = query.pipe((query: Builder) => 5)
    expect(result).toBe(5)

    result = query.pipe((query: Builder) => null)
    expect(result).toBe(query)

    result = query.pipe((query: Builder) => {
      //
    })
    expect(result).toBe(query)

    expect(query.wheres).toHaveLength(0)
    result = query.pipe((query: Builder) => query.where('foo', 'bar'))
    expect(result).toBe(query)
    expect(query.wheres).toHaveLength(1)
  })

  test('testBasicWheres', () => {
    const builder = getBuilder()
    builder.select('*').from('users').where('id', '=', 1)
    expect(builder.toSql()).toBe('select * from "users" where "id" = ?')
    expect(builder.getBindings()).toEqual([1])
  })

  test('testBasicWhereNot', () => {
    const builder = getBuilder()
    builder.select('*').from('users').whereNot('name', 'foo').whereNot('name', '<>', 'bar')
    expect(builder.toSql()).toBe('select * from "users" where not "name" = ? and not "name" <> ?')
    expect(builder.getBindings()).toEqual(['foo', 'bar'])
  })

  test('testWheresWithArrayValue', () => {
    let builder = getBuilder()
    builder.select('*').from('users').where('id', [12])
    expect(builder.toSql()).toBe('select * from "users" where "id" = ?')
    expect(builder.getBindings()).toEqual([12])

    builder = getBuilder()
    builder.select('*').from('users').where('id', '=', [12, 30])
    expect(builder.toSql()).toBe('select * from "users" where "id" = ?')
    expect(builder.getBindings()).toEqual([12])

    builder = getBuilder()
    builder.select('*').from('users').where('id', '!=', [12, 30])
    expect(builder.toSql()).toBe('select * from "users" where "id" != ?')
    expect(builder.getBindings()).toEqual([12])

    builder = getBuilder()
    builder.select('*').from('users').where('id', '<>', [12, 30])
    expect(builder.toSql()).toBe('select * from "users" where "id" <> ?')
    expect(builder.getBindings()).toEqual([12])

    builder = getBuilder()
    builder.select('*').from('users').where('id', '=', [[12, 30]])
    expect(builder.toSql()).toBe('select * from "users" where "id" = ?')
    expect(builder.getBindings()).toEqual([12])
  })

  test('testMySqlWrappingProtectsQuotationMarks', () => {
    const builder = getMySqlBuilder()
    builder.select('*').from('some`table')
    expect(builder.toSql()).toBe('select * from `some``table`')
  })

  test('testDateBasedWheresAcceptsTwoArguments', () => {
    let builder = getMySqlBuilder()
    builder.select('*').from('users').whereDate('created_at', 1)
    expect(builder.toSql()).toBe('select * from `users` where date(`created_at`) = ?')

    builder = getMySqlBuilder()
    builder.select('*').from('users').whereDay('created_at', 1)
    expect(builder.toSql()).toBe('select * from `users` where day(`created_at`) = ?')

    builder = getMySqlBuilder()
    builder.select('*').from('users').whereMonth('created_at', 1)
    expect(builder.toSql()).toBe('select * from `users` where month(`created_at`) = ?')

    builder = getMySqlBuilder()
    builder.select('*').from('users').whereYear('created_at', 1)
    expect(builder.toSql()).toBe('select * from `users` where year(`created_at`) = ?')
  })

  test('testDateBasedOrWheresAcceptsTwoArguments', () => {
    let builder = getMySqlBuilder()
    builder.select('*').from('users').where('id', 1).orWhereDate('created_at', 1)
    expect(builder.toSql()).toBe('select * from `users` where `id` = ? or date(`created_at`) = ?')

    builder = getMySqlBuilder()
    builder.select('*').from('users').where('id', 1).orWhereDay('created_at', 1)
    expect(builder.toSql()).toBe('select * from `users` where `id` = ? or day(`created_at`) = ?')

    builder = getMySqlBuilder()
    builder.select('*').from('users').where('id', 1).orWhereMonth('created_at', 1)
    expect(builder.toSql()).toBe('select * from `users` where `id` = ? or month(`created_at`) = ?')

    builder = getMySqlBuilder()
    builder.select('*').from('users').where('id', 1).orWhereYear('created_at', 1)
    expect(builder.toSql()).toBe('select * from `users` where `id` = ? or year(`created_at`) = ?')
  })

  test('testDateBasedWheresExpressionIsNotBound', () => {
    let builder = getBuilder()
    builder.select('*').from('users').whereDate('created_at', new Raw('NOW()')).where('admin', true)
    expect(builder.getBindings()).toEqual([true])

    builder = getBuilder()
    builder.select('*').from('users').whereDay('created_at', new Raw('NOW()'))
    expect(builder.getBindings()).toEqual([])

    builder = getBuilder()
    builder.select('*').from('users').whereMonth('created_at', new Raw('NOW()'))
    expect(builder.getBindings()).toEqual([])

    builder = getBuilder()
    builder.select('*').from('users').whereYear('created_at', new Raw('NOW()'))
    expect(builder.getBindings()).toEqual([])
  })

  test('testWhereDateMySql', () => {
    let builder = getMySqlBuilder()

    builder.select('*').from('users').whereDate('created_at', '=', '2015-12-21')
    expect(builder.toSql()).toBe('select * from `users` where date(`created_at`) = ?')
    expect(builder.getBindings()).toEqual(['2015-12-21'])

    builder = getMySqlBuilder()
    builder.select('*').from('users').whereDate('created_at', '=', new Raw('NOW()'))
    expect(builder.toSql()).toBe('select * from `users` where date(`created_at`) = NOW()')
  })

  test('testWhereDayMySql', () => {
    const builder = getMySqlBuilder()
    builder.select('*').from('users').whereDay('created_at', '=', 1)
    expect(builder.toSql()).toBe('select * from `users` where day(`created_at`) = ?')
    expect(builder.getBindings()).toEqual([1])
  })

  test('testOrWhereDayPostgres', () => {
    const builder = getPostgresBuilder()
    builder.select('*').from('users').whereDay('created_at', '=', 1).orWhereDay('created_at', '=', 2)
    expect(builder.toSql()).toBe('select * from "users" where extract(day from "created_at") = ? or extract(day from "created_at") = ?')
    expect(builder.getBindings()).toEqual([1, 2])
  })

  test('testOrWhereDaySqlServer', () => {
    const builder = getSqlServerBuilder()
    builder.select('*').from('users').whereDay('created_at', '=', 1).orWhereDay('created_at', '=', 2)
    expect(builder.toSql()).toBe('select * from [users] where day([created_at]) = ? or day([created_at]) = ?')
    expect(builder.getBindings()).toEqual([1, 2])
  })

  test('testWhereMonthMySql', () => {
    const builder = getSqlServerBuilder()
    builder.select('*').from('users').whereDay('created_at', '=', 1).orWhereDay('created_at', '=', 2)
    expect(builder.toSql()).toBe('select * from [users] where day([created_at]) = ? or day([created_at]) = ?')
    expect(builder.getBindings()).toEqual([1, 2])
  })

  test('testOrWhereMonthMySql', () => {
    const builder = getMySqlBuilder()
    builder.select('*').from('users').whereMonth('created_at', '=', 5).orWhereMonth('created_at', '=', 6)
    expect(builder.toSql()).toBe('select * from `users` where month(`created_at`) = ? or month(`created_at`) = ?')
    expect(builder.getBindings()).toEqual([5, 6])
  })

  test('testOrWhereMonthPostgres', () => {
    const builder = getPostgresBuilder()
    builder.select('*').from('users').whereMonth('created_at', '=', 5).orWhereMonth('created_at', '=', 6)
    expect(builder.toSql()).toBe('select * from "users" where extract(month from "created_at") = ? or extract(month from "created_at") = ?')
    expect(builder.getBindings()).toEqual([5, 6])
  })

  test('testOrWhereMonthSqlServer', () => {
    const builder = getSqlServerBuilder()
    builder.select('*').from('users').whereMonth('created_at', '=', 5).orWhereMonth('created_at', '=', 6)
    expect(builder.toSql()).toBe('select * from [users] where month([created_at]) = ? or month([created_at]) = ?')
    expect(builder.getBindings()).toEqual([5, 6])
  })

  test('testWhereYearMySql', () => {
    const builder = getMySqlBuilder()
    builder.select('*').from('users').whereYear('created_at', '=', 2014)
    expect(builder.toSql()).toBe('select * from `users` where year(`created_at`) = ?')
    expect(builder.getBindings()).toEqual([2014])
  })

  test('testOrWhereYearMySql', () => {
    const builder = getMySqlBuilder()
    builder.select('*').from('users').whereYear('created_at', '=', 2014).orWhereYear('created_at', '=', 2015)
    expect(builder.toSql()).toBe('select * from `users` where year(`created_at`) = ? or year(`created_at`) = ?')
    expect(builder.getBindings()).toEqual([2014, 2015])
  })

  test('testOrWhereYearPostgres', () => {
    const builder = getPostgresBuilder()
    builder.select('*').from('users').whereYear('created_at', '=', 2014).orWhereYear('created_at', '=', 2015)
    expect(builder.toSql()).toBe('select * from "users" where extract(year from "created_at") = ? or extract(year from "created_at") = ?')
    expect(builder.getBindings()).toEqual([2014, 2015])
  })

  test('testOrWhereYearSqlServer', () => {
    const builder = getSqlServerBuilder()
    builder.select('*').from('users').whereYear('created_at', '=', 2014).orWhereYear('created_at', '=', 2015)
    expect(builder.toSql()).toBe('select * from [users] where year([created_at]) = ? or year([created_at]) = ?')
    expect(builder.getBindings()).toEqual([2014, 2015])
  })

  test('testWhereTimeMySql', () => {
    const builder = getMySqlBuilder()
    builder.select('*').from('users').whereTime('created_at', '>=', '22:00')
    expect(builder.toSql()).toBe('select * from `users` where time(`created_at`) >= ?')
    expect(builder.getBindings()).toEqual(['22:00'])
  })

  test('testWhereTimeOperatorOptionalMySql', () => {
    const builder = getMySqlBuilder()
    builder.select('*').from('users').whereTime('created_at', '22:00')
    expect(builder.toSql()).toBe('select * from `users` where time(`created_at`) = ?')
    expect(builder.getBindings()).toEqual(['22:00'])
  })

  test('testWhereTimeOperatorOptionalPostgres', () => {
    const builder = getPostgresBuilder()
    builder.select('*').from('users').whereTime('created_at', '22:00')
    expect(builder.toSql()).toBe('select * from "users" where "created_at"::time = ?')
    expect(builder.getBindings()).toEqual(['22:00'])
  })

  test('testWhereTimeSqlServer', () => {
    let builder = getSqlServerBuilder()
    builder.select('*').from('users').whereTime('created_at', '22:00')
    expect(builder.toSql()).toBe('select * from [users] where cast([created_at] as time) = ?')
    expect(builder.getBindings()).toEqual(['22:00'])

    builder = getSqlServerBuilder()
    builder.select('*').from('users').whereTime('created_at', new Raw('NOW()'))
    expect(builder.toSql()).toBe('select * from [users] where cast([created_at] as time) = NOW()')
    expect(builder.getBindings()).toEqual([])
  })

  test('testOrWhereTimeMySql', () => {
    const builder = getMySqlBuilder()
    builder.select('*').from('users').whereTime('created_at', '<=', '10:00').orWhereTime('created_at', '>=', '22:00')
    expect(builder.toSql()).toBe('select * from `users` where time(`created_at`) <= ? or time(`created_at`) >= ?')
    expect(builder.getBindings()).toEqual(['10:00', '22:00'])
  })

  test('testOrWhereTimePostgres', () => {
    const builder = getPostgresBuilder()
    builder.select('*').from('users').whereTime('created_at', '<=', '10:00').orWhereTime('created_at', '>=', '22:00')
    expect(builder.toSql()).toBe('select * from "users" where "created_at"::time <= ? or "created_at"::time >= ?')
    expect(builder.getBindings()).toEqual(['10:00', '22:00'])
  })

  test('testOrWhereTimeSqlServer', () => {
    let builder = getSqlServerBuilder()
    builder.select('*').from('users').whereTime('created_at', '<=', '10:00').orWhereTime('created_at', '>=', '22:00')
    expect(builder.toSql()).toBe('select * from [users] where cast([created_at] as time) <= ? or cast([created_at] as time) >= ?')
    expect(builder.getBindings()).toEqual(['10:00', '22:00'])

    builder = getSqlServerBuilder()
    builder.select('*').from('users').whereTime('created_at', '<=', '10:00').orWhereTime('created_at', new Raw('NOW()'))
    expect(builder.toSql()).toBe('select * from [users] where cast([created_at] as time) <= ? or cast([created_at] as time) = NOW()')
    expect(builder.getBindings()).toEqual(['10:00'])
  })

  test('testWhereDatePostgres', () => {
    let builder = getPostgresBuilder()
    builder.select('*').from('users').whereDate('created_at', '=', '2015-12-21')
    expect(builder.toSql()).toBe('select * from "users" where "created_at"::date = ?')
    expect(builder.getBindings()).toEqual(['2015-12-21'])

    builder = getPostgresBuilder()
    builder.select('*').from('users').whereDate('created_at', new Raw('NOW()'))
    expect(builder.toSql()).toBe('select * from "users" where "created_at"::date = NOW()')

    builder = getPostgresBuilder()
    builder.select('*').from('users').whereDate('result->created_at', new Raw('NOW()'))
    expect(builder.toSql()).toBe('select * from "users" where ("result"->>\'created_at\')::date = NOW()')

    builder = getPostgresBuilder()
    builder.select('*').from('users').whereDate(new Raw('COALESCE(created_at, updated_at)'), new Raw('NOW()'))
    expect(builder.toSql()).toBe('select * from "users" where COALESCE(created_at, updated_at)::date = NOW()')

    builder = getPostgresBuilder()
    builder.select('*').from('users').whereDate(Str.of('result->created_at'), new Raw('NOW()'))
    expect(builder.toSql()).toBe('select * from "users" where ("result"->>\'created_at\')::date = NOW()')
  })

  test('testWhereDayPostgres', () => {
    const builder = getPostgresBuilder()
    builder.select('*').from('users').whereDay('created_at', '=', 1)
    expect(builder.toSql()).toBe('select * from "users" where extract(day from "created_at") = ?')
    expect(builder.getBindings()).toEqual([1])
  })

  test('testWhereMonthPostgres', () => {
    const builder = getPostgresBuilder()
    builder.select('*').from('users').whereMonth('created_at', '=', 5)
    expect(builder.toSql()).toBe('select * from "users" where extract(month from "created_at") = ?')
    expect(builder.getBindings()).toEqual([5])
  })

  test('testWhereYearPostgres', () => {
    const builder = getPostgresBuilder()
    builder.select('*').from('users').whereYear('created_at', '=', 2014)
    expect(builder.toSql()).toBe('select * from "users" where extract(year from "created_at") = ?')
    expect(builder.getBindings()).toEqual([2014])
  })

  test('testWhereTimePostgres', () => {
    let builder = getPostgresBuilder()
    builder.select('*').from('users').whereTime('created_at', '>=', '22:00')
    expect(builder.toSql()).toBe('select * from "users" where "created_at"::time >= ?')
    expect(builder.getBindings()).toEqual(['22:00'])

    builder = getPostgresBuilder()
    builder.select('*').from('users').whereTime('result->created_at', '>=', '22:00')
    expect(builder.toSql()).toBe('select * from "users" where ("result"->>\'created_at\')::time >= ?')
    expect(builder.getBindings()).toEqual(['22:00'])

    builder = getPostgresBuilder()
    builder.select('*').from('users').whereTime(new Raw('COALESCE(created_at, updated_at)'), '>=', '22:00')
    expect(builder.toSql()).toBe('select * from "users" where COALESCE(created_at, updated_at)::time >= ?')
    expect(builder.getBindings()).toEqual(['22:00'])

    builder = getPostgresBuilder()
    builder.select('*').from('users').whereTime(Str.of('result->created_at'), '>=', '22:00')
    expect(builder.toSql()).toBe('select * from "users" where ("result"->>\'created_at\')::time >= ?')
    expect(builder.getBindings()).toEqual(['22:00'])
  })

  test('testWherePast', () => {
    const date = '2022-04-20 23:45:06.123456'
    jest
      .useFakeTimers()
      .setSystemTime(new Date(date))

    const testDate = new Date(date)

    let builder = getBuilder()
    builder.select('*').from('posts').wherePast('published_at')
    expect(builder.toSql()).toBe('select * from "posts" where "published_at" < ?')
    expect(builder.getBindings()).toEqual([testDate])

    builder = getBuilder()
    builder.select('*').from('posts').where('id', '=', 1).orWherePast('published_at')
    expect(builder.toSql()).toBe('select * from "posts" where "id" = ? or "published_at" < ?')
    expect(builder.getBindings()).toEqual([1, testDate])
  })

  test('testWherePastUsesArray', () => {
    const date = '2022-04-20 12:34:56.123456'
    jest
      .useFakeTimers()
      .setSystemTime(new Date(date))

    const testDate = new Date(date)

    let builder = getBuilder()
    builder.select('*').from('posts').wherePast(['published_at', 'held_at'])
    expect(builder.toSql()).toBe('select * from "posts" where "published_at" < ? and "held_at" < ?')
    expect(builder.getBindings()).toEqual([testDate, testDate])

    builder = getBuilder()
    builder.select('*').from('posts').where('id', '=', 1).orWherePast(['published_at', 'held_at'])
    expect(builder.toSql()).toBe('select * from "posts" where "id" = ? or "published_at" < ? or "held_at" < ?')
    expect(builder.getBindings()).toEqual([1, testDate, testDate])
  })

  test('testWhereTodayMySQL', () => {
    jest
      .useFakeTimers()
      .setSystemTime(new Date('2022-04-20 12:34:56.123456'))

    let builder = getMySqlBuilder()
    builder.select('*').from('posts').whereToday('published_at')
    expect(builder.toSql()).toBe('select * from `posts` where date(`published_at`) = ?')
    expect(builder.getBindings()).toEqual(['2022-04-20'])

    builder = getMySqlBuilder()
    builder.select('*').from('posts').where('id', '=', 1).orWhereToday('published_at')
    expect(builder.toSql()).toBe('select * from `posts` where `id` = ? or date(`published_at`) = ?')
    expect(builder.getBindings()).toEqual([1, '2022-04-20'])
  })

  test('testPassingArrayToWhereTodayMySQL', () => {
    const date = '2022-04-20 12:34:56.123456'
    jest
      .useFakeTimers()
      .setSystemTime(new Date(date))

    let builder = getMySqlBuilder()
    builder.select('*').from('posts').whereToday(['published_at', 'held_at'])
    expect(builder.toSql()).toBe('select * from `posts` where date(`published_at`) = ? and date(`held_at`) = ?')
    expect(builder.getBindings()).toEqual(['2022-04-20', '2022-04-20'])

    builder = getMySqlBuilder()
    builder.select('*').from('posts').where('id', '=', 1).orWhereToday(['published_at', 'held_at'])
    expect(builder.toSql()).toBe('select * from `posts` where `id` = ? or date(`published_at`) = ? or date(`held_at`) = ?')
    expect(builder.getBindings()).toEqual([1, '2022-04-20', '2022-04-20'])
  })

  test('testWhereTodaySqlServer', () => {
    const date = '2022-04-20 12:34:56.123456'
    jest
      .useFakeTimers()
      .setSystemTime(new Date(date))

    let builder = getSqlServerBuilder()
    builder.select('*').from('posts').whereToday('published_at')
    expect(builder.toSql()).toBe('select * from [posts] where cast([published_at] as date) = ?')
    expect(builder.getBindings()).toEqual(['2022-04-20'])

    builder = getSqlServerBuilder()
    builder.select('*').from('posts').where('id', '=', 1).orWhereToday('published_at')
    expect(builder.toSql()).toBe('select * from [posts] where [id] = ? or cast([published_at] as date) = ?')
    expect(builder.getBindings()).toEqual([1, '2022-04-20'])
  })

  test('testPassingArrayToWhereTodaySqlServer', () => {
    const date = '2022-04-20 12:34:56.123456'
    jest
      .useFakeTimers()
      .setSystemTime(new Date(date))

    let builder = getSqlServerBuilder()
    builder.select('*').from('posts').whereToday(['published_at', 'held_at'])
    expect(builder.toSql()).toBe('select * from [posts] where cast([published_at] as date) = ? and cast([held_at] as date) = ?')
    expect(builder.getBindings()).toEqual(['2022-04-20', '2022-04-20'])

    builder = getSqlServerBuilder()
    builder.select('*').from('posts').where('id', '=', 1).orWhereToday(['published_at', 'held_at'])
    expect(builder.toSql()).toBe('select * from [posts] where [id] = ? or cast([published_at] as date) = ? or cast([held_at] as date) = ?')
    expect(builder.getBindings()).toEqual([1, '2022-04-20', '2022-04-20'])
  })

  test('testWhereFuture', () => {
    const date = '2022-04-22 21:01:23.123456'
    jest
      .useFakeTimers()
      .setSystemTime(new Date(date))

    const testDate = new Date(date)

    let builder = getBuilder()
    builder.select('*').from('posts').whereFuture('published_at')
    expect(builder.toSql()).toBe('select * from "posts" where "published_at" > ?')
    expect(builder.getBindings()).toEqual([testDate])

    builder = getBuilder()
    builder.select('*').from('posts').where('id', '=', 1).orWhereFuture('published_at')
    expect(builder.toSql()).toBe('select * from "posts" where "id" = ? or "published_at" > ?')
    expect(builder.getBindings()).toEqual([1, testDate])
  })

  test('testPassingArrayToWhereFuture', () => {
    const date = '2022-04-22 01:23:45.123456'
    jest
      .useFakeTimers()
      .setSystemTime(new Date(date))

    const testDate = new Date(date)

    let builder = getBuilder()
    builder.select('*').from('posts').whereFuture(['published_at', 'held_at'])
    expect(builder.toSql()).toBe('select * from "posts" where "published_at" > ? and "held_at" > ?')
    expect(builder.getBindings()).toEqual([testDate, testDate])

    builder = getBuilder()
    builder.select('*').from('posts').where('id', '=', 1).orWhereFuture(['published_at', 'held_at'])
    expect(builder.toSql()).toBe('select * from "posts" where "id" = ? or "published_at" > ? or "held_at" > ?')
    expect(builder.getBindings()).toEqual([1, testDate, testDate])
  })

  test('testWhereNowOrPast', () => {
    const date = '2022-04-20 23:45:06.123456'
    jest
      .useFakeTimers()
      .setSystemTime(new Date(date))

    const testDate = new Date(date)

    let builder = getBuilder()
    builder.select('*').from('posts').whereNowOrPast('published_at')
    expect(builder.toSql()).toBe('select * from "posts" where "published_at" <= ?')
    expect(builder.getBindings()).toEqual([testDate])

    builder = getBuilder()
    builder.select('*').from('posts').where('id', '=', 1).orWhereNowOrPast('published_at')
    expect(builder.toSql()).toBe('select * from "posts" where "id" = ? or "published_at" <= ?')
    expect(builder.getBindings()).toEqual([1, testDate])
  })

  test('testWhereNowOrPastUsesArray', () => {
    const date = '2022-04-20 12:34:56.123456'
    jest
      .useFakeTimers()
      .setSystemTime(new Date(date))

    const testDate = new Date(date)

    let builder = getBuilder()
    builder.select('*').from('posts').whereNowOrPast(['published_at', 'held_at'])
    expect(builder.toSql()).toBe('select * from "posts" where "published_at" <= ? and "held_at" <= ?')
    expect(builder.getBindings()).toEqual([testDate, testDate])

    builder = getBuilder()
    builder.select('*').from('posts').where('id', '=', 1).orWhereNowOrPast(['published_at', 'held_at'])
    expect(builder.toSql()).toBe('select * from "posts" where "id" = ? or "published_at" <= ? or "held_at" <= ?')
    expect(builder.getBindings()).toEqual([1, testDate, testDate])
  })

  test('testWhereNowOrFuture', () => {
    const date = '2022-04-22 21:01:23.123456'
    jest
      .useFakeTimers()
      .setSystemTime(new Date(date))

    const testDate = new Date(date)

    let builder = getBuilder()
    builder.select('*').from('posts').whereNowOrFuture('published_at')
    expect(builder.toSql()).toBe('select * from "posts" where "published_at" >= ?')
    expect(builder.getBindings()).toEqual([testDate])

    builder = getBuilder()
    builder.select('*').from('posts').where('id', '=', 1).orWhereNowOrFuture('published_at')
    expect(builder.toSql()).toBe('select * from "posts" where "id" = ? or "published_at" >= ?')
    expect(builder.getBindings()).toEqual([1, testDate])
  })

  test('testWhereNowOrFutureUsesArray', () => {
    const date = '2022-04-22 01:23:45.123456'
    jest
      .useFakeTimers()
      .setSystemTime(new Date(date))

    const testDate = new Date(date)

    let builder = getBuilder()
    builder.select('*').from('posts').whereNowOrFuture(['published_at', 'held_at'])
    expect(builder.toSql()).toBe('select * from "posts" where "published_at" >= ? and "held_at" >= ?')
    expect(builder.getBindings()).toEqual([testDate, testDate])

    builder = getBuilder()
    builder.select('*').from('posts').where('id', '=', 1).orWhereNowOrFuture(['published_at', 'held_at'])
    expect(builder.toSql()).toBe('select * from "posts" where "id" = ? or "published_at" >= ? or "held_at" >= ?')
    expect(builder.getBindings()).toEqual([1, testDate, testDate])
  })

  test('testWhereBeforeTodayMySQL', () => {
    const date = '2022-04-20 12:34:56.123456'
    jest
      .useFakeTimers()
      .setSystemTime(new Date(date))

    let builder = getMySqlBuilder()
    builder.select('*').from('posts').whereBeforeToday('published_at')
    expect(builder.toSql()).toBe('select * from `posts` where date(`published_at`) < ?')
    expect(builder.getBindings()).toEqual(['2022-04-20'])

    builder = getMySqlBuilder()
    builder.select('*').from('posts').where('id', '=', 1).orWhereBeforeToday('published_at')
    expect(builder.toSql()).toBe('select * from `posts` where `id` = ? or date(`published_at`) < ?')
    expect(builder.getBindings()).toEqual([1, '2022-04-20'])
  })

  test('testWhereTodayOrBeforeMySQL', () => {
    const date = '2022-04-20 12:34:56.123456'
    jest
      .useFakeTimers()
      .setSystemTime(new Date(date))

    let builder = getMySqlBuilder()
    builder.select('*').from('posts').whereTodayOrBefore('published_at')
    expect(builder.toSql()).toBe('select * from `posts` where date(`published_at`) <= ?')
    expect(builder.getBindings()).toEqual(['2022-04-20'])

    builder = getMySqlBuilder()
    builder.select('*').from('posts').where('id', '=', 1).orWhereTodayOrBefore('published_at')
    expect(builder.toSql()).toBe('select * from `posts` where `id` = ? or date(`published_at`) <= ?')
    expect(builder.getBindings()).toEqual([1, '2022-04-20'])
  })

  test('testWhereAfterTodayMySQL', () => {
    const date = '2022-04-20 12:34:56.123456'
    jest
      .useFakeTimers()
      .setSystemTime(new Date(date))

    let builder = getMySqlBuilder()
    builder.select('*').from('posts').whereAfterToday('published_at')
    expect(builder.toSql()).toBe('select * from `posts` where date(`published_at`) > ?')
    expect(builder.getBindings()).toEqual(['2022-04-20'])

    builder = getMySqlBuilder()
    builder.select('*').from('posts').where('id', '=', 1).orWhereAfterToday('published_at')
    expect(builder.toSql()).toBe('select * from `posts` where `id` = ? or date(`published_at`) > ?')
    expect(builder.getBindings()).toEqual([1, '2022-04-20'])
  })

  test('testWhereTodayOrAfterMySQL', () => {
    const date = '2022-04-20 12:34:56.123456'
    jest
      .useFakeTimers()
      .setSystemTime(new Date(date))

    let builder = getMySqlBuilder()
    builder.select('*').from('posts').whereTodayOrAfter('published_at')
    expect(builder.toSql()).toBe('select * from `posts` where date(`published_at`) >= ?')
    expect(builder.getBindings()).toEqual(['2022-04-20'])

    builder = getMySqlBuilder()
    builder.select('*').from('posts').where('id', '=', 1).orWhereTodayOrAfter('published_at')
    expect(builder.toSql()).toBe('select * from `posts` where `id` = ? or date(`published_at`) >= ?')
    expect(builder.getBindings()).toEqual([1, '2022-04-20'])
  })

  test('testPassingArrayToTodayRelativeWhereMySQL', () => {
    const date = '2022-04-20 12:34:56.123456'
    jest
      .useFakeTimers()
      .setSystemTime(new Date(date))

    let builder = getMySqlBuilder()
    builder.select('*').from('posts').whereBeforeToday(['published_at', 'held_at'])
    expect(builder.toSql()).toBe('select * from `posts` where date(`published_at`) < ? and date(`held_at`) < ?')
    expect(builder.getBindings()).toEqual(['2022-04-20', '2022-04-20'])

    builder = getMySqlBuilder()
    builder.select('*').from('posts').whereTodayOrAfter(['published_at', 'held_at'])
    expect(builder.toSql()).toBe('select * from `posts` where date(`published_at`) >= ? and date(`held_at`) >= ?')
    expect(builder.getBindings()).toEqual(['2022-04-20', '2022-04-20'])
  })

  test('testTodayRelativeWhereClausesSqlServer', () => {
    const date = '2022-04-20 12:34:56.123456'
    jest
      .useFakeTimers()
      .setSystemTime(new Date(date))

    let builder = getSqlServerBuilder()
    builder.select('*').from('posts').whereBeforeToday('published_at')
    expect(builder.toSql()).toBe('select * from [posts] where cast([published_at] as date) < ?')
    expect(builder.getBindings()).toEqual(['2022-04-20'])

    builder = getSqlServerBuilder()
    builder.select('*').from('posts').whereTodayOrBefore('published_at')
    expect(builder.toSql()).toBe('select * from [posts] where cast([published_at] as date) <= ?')
    expect(builder.getBindings()).toEqual(['2022-04-20'])

    builder = getSqlServerBuilder()
    builder.select('*').from('posts').whereAfterToday('published_at')
    expect(builder.toSql()).toBe('select * from [posts] where cast([published_at] as date) > ?')
    expect(builder.getBindings()).toEqual(['2022-04-20'])

    builder = getSqlServerBuilder()
    builder.select('*').from('posts').where('id', '=', 1).orWhereTodayOrAfter('published_at')
    expect(builder.toSql()).toBe('select * from [posts] where [id] = ? or cast([published_at] as date) >= ?')
    expect(builder.getBindings()).toEqual([1, '2022-04-20'])
  })

  test('testPassingArrayToTodayRelativeWhereSqlServer', () => {
    const date = '2022-04-20 12:34:56.123456'
    jest
      .useFakeTimers()
      .setSystemTime(new Date(date))

    const builder = getSqlServerBuilder()
    builder.select('*').from('posts').whereBeforeToday(['published_at', 'held_at'])
    expect(builder.toSql()).toBe('select * from [posts] where cast([published_at] as date) < ? and cast([held_at] as date) < ?')
    expect(builder.getBindings()).toEqual(['2022-04-20', '2022-04-20'])
  })

  test('testWhereBinaryClauseMariaDb', () => {
    const date = '2022-04-20 12:34:56.123456'
    jest
      .useFakeTimers()
      .setSystemTime(new Date(date))

    let builder = getMariaDbBuilder()
    builder.select('*').from('users').whereBinary('name', 'john')
    expect(builder.toSql()).toBe('select * from `users` where `name` = binary ?')
    expect(builder.getBindings()).toEqual(['john'])

    builder = getMariaDbBuilder()
    builder.select('*').from('users').whereNotBinary('name', 'john')
    expect(builder.toSql()).toBe('select * from `users` where `name` != binary ?')
    expect(builder.getBindings()).toEqual(['john'])
  })

  test('testWhereBinaryClauseMysql', () => {
    const date = '2022-04-20 12:34:56.123456'
    jest
      .useFakeTimers()
      .setSystemTime(new Date(date))

    let builder = getMySqlBuilder()
    builder.select('*').from('users').whereBinary('name', 'john')
    expect(builder.toSql()).toBe('select * from `users` where `name` = binary ?')
    expect(builder.getBindings()).toEqual(['john'])

    builder = getMySqlBuilder()
    builder.select('*').from('users').whereNotBinary('name', 'john')
    expect(builder.toSql()).toBe('select * from `users` where `name` != binary ?')
    expect(builder.getBindings()).toEqual(['john'])

    builder = getMySqlBuilder()
    builder.select('*').from('users').where('id', '=', 1).orWhereBinary('name', 'john')
    expect(builder.toSql()).toBe('select * from `users` where `id` = ? or `name` = binary ?')
    expect(builder.getBindings()).toEqual([1, 'john'])

    builder = getMySqlBuilder()
    builder.select('*').from('users').where('id', '=', 1).orWhereNotBinary('name', 'john')
    expect(builder.toSql()).toBe('select * from `users` where `id` = ? or `name` != binary ?')
    expect(builder.getBindings()).toEqual([1, 'john'])
  })

  test('testWhereBinaryClausePostgres', () => {
    const builder = getPostgresBuilder()
    builder.select('*').from('users').whereBinary('name', 'john')

    expect(() => {
      builder.toSql()
    }).toThrow('RuntimeException: This database engine does not support binary comparison operations.')
  })

  test('testWhereBinaryClauseSqlite', () => {
    const builder = getSQLiteBuilder()
    builder.select('*').from('users').whereBinary('name', 'john')

    expect(() => {
      builder.toSql()
    }).toThrow('RuntimeException: This database engine does not support binary comparison operations.')
  })

  test('testWhereBinaryClauseSqlServer', () => {
    const builder = getSqlServerBuilder()
    builder.select('*').from('users').whereBinary('name', 'john')

    expect(() => {
      builder.toSql()
    }).toThrow('RuntimeException: This database engine does not support binary comparison operations.')
  })

  test('testWhereLikePostgres', () => {
    let builder = getPostgresBuilder()
    builder.select('*').from('users').where('id', 'like', '1')
    expect(builder.toSql()).toBe('select * from "users" where "id"::text like ?')
    expect(builder.getBindings()).toEqual(['1'])

    builder = getPostgresBuilder()
    builder.select('*').from('users').where('id', 'LIKE', '1')
    expect(builder.toSql()).toBe('select * from "users" where "id"::text LIKE ?')
    expect(builder.getBindings()).toEqual(['1'])

    builder = getPostgresBuilder()
    builder.select('*').from('users').where('id', 'ilike', '1')
    expect(builder.toSql()).toBe('select * from "users" where "id"::text ilike ?')
    expect(builder.getBindings()).toEqual(['1'])

    builder = getPostgresBuilder()
    builder.select('*').from('users').where('id', 'not like', '1')
    expect(builder.toSql()).toBe('select * from "users" where "id"::text not like ?')
    expect(builder.getBindings()).toEqual(['1'])

    builder = getPostgresBuilder()
    builder.select('*').from('users').where('id', 'not ilike', '1')
    expect(builder.toSql()).toBe('select * from "users" where "id"::text not ilike ?')
    expect(builder.getBindings()).toEqual(['1'])
  })

  test('testWhereLikeClausePostgres', () => {
    let builder = getPostgresBuilder()
    builder.select('*').from('users').whereLike('id', '1')
    expect(builder.toSql()).toBe('select * from "users" where "id"::text ilike ?')
    expect(builder.getBindings()).toEqual(['1'])

    builder = getPostgresBuilder()
    builder.select('*').from('users').whereLike('id', '1', false)
    expect(builder.toSql()).toBe('select * from "users" where "id"::text ilike ?')
    expect(builder.getBindings()).toEqual(['1'])

    builder = getPostgresBuilder()
    builder.select('*').from('users').whereLike('id', '1', true)
    expect(builder.toSql()).toBe('select * from "users" where "id"::text like ?')
    expect(builder.getBindings()).toEqual(['1'])

    builder = getPostgresBuilder()
    builder.select('*').from('users').whereNotLike('id', '1')
    expect(builder.toSql()).toBe('select * from "users" where "id"::text not ilike ?')
    expect(builder.getBindings()).toEqual(['1'])

    builder = getPostgresBuilder()
    builder.select('*').from('users').whereNotLike('id', '1', false)
    expect(builder.toSql()).toBe('select * from "users" where "id"::text not ilike ?')
    expect(builder.getBindings()).toEqual(['1'])

    builder = getPostgresBuilder()
    builder.select('*').from('users').whereNotLike('id', '1', true)
    expect(builder.toSql()).toBe('select * from "users" where "id"::text not like ?')
    expect(builder.getBindings()).toEqual(['1'])
  })

  test('testWhereLikeClauseMysql', () => {
    let builder = getMySqlBuilder()
    builder.select('*').from('users').whereLike('id', '1')
    expect(builder.toSql()).toBe('select * from `users` where `id` like ?')
    expect(builder.getBindings()).toEqual(['1'])

    builder = getMySqlBuilder()
    builder.select('*').from('users').whereLike('id', '1', false)
    expect(builder.toSql()).toBe('select * from `users` where `id` like ?')
    expect(builder.getBindings()).toEqual(['1'])

    builder = getMySqlBuilder()
    builder.select('*').from('users').whereLike('id', '1', true)
    expect(builder.toSql()).toBe('select * from `users` where `id` like binary ?')
    expect(builder.getBindings()).toEqual(['1'])

    builder = getMySqlBuilder()
    builder.select('*').from('users').whereNotLike('id', '1')
    expect(builder.toSql()).toBe('select * from `users` where `id` not like ?')
    expect(builder.getBindings()).toEqual(['1'])

    builder = getMySqlBuilder()
    builder.select('*').from('users').whereNotLike('id', '1', false)
    expect(builder.toSql()).toBe('select * from `users` where `id` not like ?')
    expect(builder.getBindings()).toEqual(['1'])

    builder = getMySqlBuilder()
    builder.select('*').from('users').whereNotLike('id', '1', true)
    expect(builder.toSql()).toBe('select * from `users` where `id` not like binary ?')
    expect(builder.getBindings()).toEqual(['1'])
  })

  test('testWhereLikeClauseSqlite', () => {
    let builder = getSQLiteBuilder();
    builder.select('*').from('users').whereLike('id', '1');
    expect(builder.toSql()).toBe('select * from "users" where "id" like ?')
    expect(builder.getBindings()).toEqual(['1'])

    builder = getSQLiteBuilder();
    builder.select('*').from('users').whereLike('id', '1', true);
    expect(builder.toSql()).toBe('select * from "users" where "id" glob ?')
    expect(builder.getBindings()).toEqual(['1'])

    builder = getSQLiteBuilder();
    builder.select('*').from('users').whereLike('description', 'Hell* _orld?%', true);
    expect(builder.toSql()).toBe('select * from "users" where "description" glob ?')
    expect(builder.getBindings()).toEqual(['Hell[*] ?orld[?]*'])

    builder = getSQLiteBuilder();
    builder.select('*').from('users').whereNotLike('id', '1');
    expect(builder.toSql()).toBe('select * from "users" where "id" not like ?')
    expect(builder.getBindings()).toEqual(['1'])

    builder = getSQLiteBuilder();
    builder.select('*').from('users').whereNotLike('description', 'Hell* _orld?%', true);
    expect(builder.toSql()).toBe('select * from "users" where "description" not glob ?')
    expect(builder.getBindings()).toEqual(['Hell[*] ?orld[?]*'])

    builder = getSQLiteBuilder();
    builder.select('*').from('users').whereLike('name', 'John%', true).whereNotLike('name', '%Doe%', true);
    expect(builder.toSql()).toBe('select * from "users" where "name" glob ? and "name" not glob ?')
    expect(builder.getBindings()).toEqual(['John*', '*Doe*'])

    builder = getSQLiteBuilder();
    builder.select('*').from('users').whereLike('name', 'John%').orWhereLike('name', 'Jane%', true);
    expect(builder.toSql()).toBe('select * from "users" where "name" like ? or "name" glob ?')
    expect(builder.getBindings()).toEqual(['John%', 'Jane*'])
  })

  test('testWhereLikeClauseSqlServer', () => {
    let builder = getSqlServerBuilder();
    builder.select('*').from('users').whereLike('id', '1');
    expect(builder.toSql()).toBe('select * from [users] where [id] like ?')
    expect(builder.getBindings()).toEqual(['1'])

    builder = getSqlServerBuilder();
    builder.select('*').from('users').whereLike('id', '1').orWhereLike('id', '2');
    expect(builder.toSql()).toBe('select * from [users] where [id] like ? or [id] like ?')
    expect(builder.getBindings()).toEqual(['1', '2'])

    builder = getSqlServerBuilder();
    builder.select('*').from('users').whereNotLike('id', '1');
    expect(builder.toSql()).toBe('select * from [users] where [id] not like ?')
    expect(builder.getBindings()).toEqual(['1'])
  })

  test('testWhereDateSqlite', () => {
    let builder = getSQLiteBuilder();
    builder.select('*').from('users').whereDate('created_at', '=', '2015-12-21');
    expect(builder.toSql()).toBe('select * from "users" where strftime(\'%Y-%m-%d\', "created_at") = cast(? as text)')
    expect(builder.getBindings()).toEqual(['2015-12-21'])

    builder = getSQLiteBuilder();
    builder.select('*').from('users').whereDate('created_at', new Raw('NOW()'));
    expect(builder.toSql()).toBe('select * from "users" where strftime(\'%Y-%m-%d\', "created_at") = cast(NOW() as text)')
  })

  test('testWhereDaySqlite', () => {
    const builder = getSQLiteBuilder();
    builder.select('*').from('users').whereDay('created_at', '=', 1);
    expect(builder.toSql()).toBe('select * from "users" where strftime(\'%d\', "created_at") = cast(? as text)')
    expect(builder.getBindings()).toEqual([1])
  })

  test('testWhereMonthSqlite', () => {
    const builder = getSQLiteBuilder();
    builder.select('*').from('users').whereMonth('created_at', '=', 5);
    expect(builder.toSql()).toBe('select * from "users" where strftime(\'%m\', "created_at") = cast(? as text)')
    expect(builder.getBindings()).toEqual([5])
  })

  test('testWhereYearSqlite', () => {
    const builder = getSQLiteBuilder();
    builder.select('*').from('users').whereYear('created_at', '=', 2014);
    expect(builder.toSql()).toBe('select * from "users" where strftime(\'%Y\', "created_at") = cast(? as text)')
    expect(builder.getBindings()).toEqual([2014])
  })

  test('testWhereTimeSqlite', () => {
    const builder = getSQLiteBuilder();
    builder.select('*').from('users').whereTime('created_at', '>=', '22:00');
    expect(builder.toSql()).toBe('select * from "users" where strftime(\'%H:%M:%S\', "created_at") >= cast(? as text)')
    expect(builder.getBindings()).toEqual(['22:00'])
  })

  test('testWhereTimeOperatorOptionalSqlite', () => {
    const builder = getSQLiteBuilder();
    builder.select('*').from('users').whereTime('created_at', '22:00');
    expect(builder.toSql()).toBe('select * from "users" where strftime(\'%H:%M:%S\', "created_at") = cast(? as text)')
    expect(builder.getBindings()).toEqual(['22:00'])
  })

  test('testWhereDateSqlServer', () => {
    let builder = getSqlServerBuilder();
    builder.select('*').from('users').whereDate('created_at', '=', '2015-12-21');
    expect(builder.toSql()).toBe('select * from [users] where cast([created_at] as date) = ?')
    expect(builder.getBindings()).toEqual(['2015-12-21'])

    builder = getSqlServerBuilder();
    builder.select('*').from('users').whereDate('created_at', new Raw('NOW()'));
    expect(builder.toSql()).toBe('select * from [users] where cast([created_at] as date) = NOW()')
  })

  test('testWhereDaySqlServer', () => {
    let builder = getSqlServerBuilder();
    builder.select('*').from('users').whereDay('created_at', '=', 1);
    expect(builder.toSql()).toBe('select * from [users] where day([created_at]) = ?')
    expect(builder.getBindings()).toEqual([1])
  })

  test('testWhereMonthSqlServer', () => {
    const builder = getSqlServerBuilder();
    builder.select('*').from('users').whereMonth('created_at', '=', 5);
    expect(builder.toSql()).toBe('select * from [users] where month([created_at]) = ?')
    expect(builder.getBindings()).toEqual([5])
  })

  test('testWhereYearSqlServer', () => {
    const builder = getSqlServerBuilder();
    builder.select('*').from('users').whereYear('created_at', '=', 2014);
    expect(builder.toSql()).toBe('select * from [users] where year([created_at]) = ?')
    expect(builder.getBindings()).toEqual([2014])
  })

  test('testWhereNullSafeEquals', () => {
    let builder = getBuilder();
    builder.select('*').from('users').whereNullSafeEquals('foo', 'bar');
    expect(builder.toSql()).toBe('select * from "users" where "foo" is not distinct from ?')
    expect(builder.getBindings()).toEqual(['bar'])

    builder = getBuilder();
    builder.select('*').from('users').whereNullSafeEquals('foo', 'bar').whereNullSafeEquals('baz', 'qux');
    expect(builder.toSql()).toBe('select * from "users" where "foo" is not distinct from ? and "baz" is not distinct from ?')
    expect(builder.getBindings()).toEqual(['bar', 'qux'])
  })

  test('testOrWhereNullSafeEquals', () => {
    const builder = getBuilder();
    builder.select('*').from('users').where('foo', 'bar').orWhereNullSafeEquals('baz', 'qux');
    expect(builder.toSql()).toBe('select * from "users" where "foo" = ? or "baz" is not distinct from ?')
    expect(builder.getBindings()).toEqual(['bar', 'qux'])
  })

  test('testWhereNullSafeEqualsViaNullSafeOperator', () => {
    const builder = getBuilder();
    builder.select('*').from('users').where('foo', '<=>', 'bar');
    expect(builder.toSql()).toBe('select * from "users" where "foo" is not distinct from ?')
    expect(builder.getBindings()).toEqual(['bar'])
  })

  test('testWhereNullSafeEqualsWithNullViaOperator', () => {
    const builder = getBuilder();
    builder.select('*').from('users').where('foo', '<=>', null);
    expect(builder.toSql()).toBe('select * from "users" where "foo" is null')
  })

  test('testWhereNullSafeEqualsMySql', () => {
    let builder = getMySqlBuilder();
    builder.select('*').from('users').whereNullSafeEquals('foo', 'bar');
    expect(builder.toSql()).toBe('select * from `users` where `foo` <=> ?')
    expect(builder.getBindings()).toEqual(['bar'])

    builder = getMySqlBuilder();
    builder.select('*').from('users').where('foo', '<=>', 'bar');
    expect(builder.toSql()).toBe('select * from `users` where `foo` <=> ?')
    expect(builder.getBindings()).toEqual(['bar'])
  })

  test('testWhereNullSafeEqualsSQLite', () => {
    let builder = getSQLiteBuilder();
    builder.select('*').from('users').whereNullSafeEquals('foo', 'bar');
    expect(builder.toSql()).toBe('select * from "users" where "foo" is ?')
    expect(builder.getBindings()).toEqual(['bar'])

    builder = getSQLiteBuilder();
    builder.select('*').from('users').where('foo', '<=>', 'bar');
    expect(builder.toSql()).toBe('select * from "users" where "foo" is ?')
    expect(builder.getBindings()).toEqual(['bar'])
  })

  test('testWhereNullSafeEqualsPostgres', () => {
    let builder = getPostgresBuilder();
    builder.select('*').from('users').whereNullSafeEquals('foo', 'bar');
    expect(builder.toSql()).toBe('select * from "users" where "foo" is not distinct from ?')
    expect(builder.getBindings()).toEqual(['bar'])

    builder = getPostgresBuilder();
    builder.select('*').from('users').where('foo', '<=>', 'bar');
    expect(builder.toSql()).toBe('select * from "users" where "foo" is not distinct from ?')
    expect(builder.getBindings()).toEqual(['bar'])
  })

  test('testWhereNullSafeEqualsSqlServer', () => {
    let builder = getSqlServerBuilder();
    builder.select('*').from('users').whereNullSafeEquals('foo', 'bar');
    expect(builder.toSql()).toBe('select * from [users] where exists (select [foo] intersect select ?)')
    expect(builder.getBindings()).toEqual(['bar'])

    builder = getSqlServerBuilder();
    builder.select('*').from('users').where('foo', '<=>', 'bar');
    expect(builder.toSql()).toBe('select * from [users] where exists (select [foo] intersect select ?)')
    expect(builder.getBindings()).toEqual(['bar'])
  })

  test('testWhereBetweens', () => {
    let builder = getBuilder();
    builder.select('*').from('users').whereBetween('id', [1, 2]);
    expect(builder.toSql()).toBe('select * from "users" where "id" between ? and ?')
    expect(builder.getBindings()).toEqual([1, 2])

    builder = getBuilder();
    builder.select('*').from('users').whereBetween('id', [[1, 2, 3]]);
    expect(builder.toSql()).toBe('select * from "users" where "id" between ? and ?')
    expect(builder.getBindings()).toEqual([1, 2])

    builder = getBuilder();
    builder.select('*').from('users').whereBetween('id', [[1], [2, 3]]);
    expect(builder.toSql()).toBe('select * from "users" where "id" between ? and ?')
    expect(builder.getBindings()).toEqual([1, 2])

    builder = getBuilder();
    builder.select('*').from('users').whereNotBetween('id', [1, 2]);
    expect(builder.toSql()).toBe('select * from "users" where "id" not between ? and ?')
    expect(builder.getBindings()).toEqual([1, 2])

    builder = getBuilder();
    builder.select('*').from('users').whereBetween('id', [new Raw(1), new Raw(2)]);
    expect(builder.toSql()).toBe('select * from "users" where "id" between 1 and 2')
    expect(builder.getBindings()).toEqual([])

    builder = getBuilder();
    let period = new DatePeriod(new Date(), new DateInterval('P1D'), new Date());
    builder.select('*').from('users').whereBetween('created_at', period);
    expect(builder.toSql()).toBe('select * from "users" where "created_at" between ? and ?')
    expect(builder.getBindings()).toEqual([Carbon:: today(), Carbon:: now() -> addDay() -> startOfDay()])

    // custom long carbon period date
    builder = getBuilder();
    const period = new DatePeriod(new Date(), new DateInterval('P1M'), new Date());
    builder.select('*').from('users').whereBetween('created_at', period);
    expect(builder.toSql()).toBe('select * from "users" where "created_at" between ? and ?')
    expect(builder.getBindings()).toEqual([Carbon:: today(), Carbon:: now() -> addMonth() -> startOfDay()])

    // DatePeriod with end date
    builder = getBuilder();
    period = new DatePeriod(new Date(), new DateInterval('P1D'), new Date(Date.now() + 5 * 24 * 60 * 60 * 1000));
    builder.select('*').from('users').whereBetween('created_at', period);
    expect(builder.toSql()).toBe('select * from "users" where "created_at" between ? and ?')
    expect(builder.getBindings()).toEqual([Carbon:: today(), Carbon:: now() -> addDays(5) -> startOfDay()])

    // DatePeriod with recurrence count (no end date)
    builder = getBuilder();
    period = new DatePeriod(new Date(), new DateInterval('P1D'), 5);
    builder.select('*').from('users').whereBetween('created_at', period);
    expect(builder.toSql()).toBe('select * from "users" where "created_at" between ? and ?')
    expect(builder.getBindings()).toEqual([new Date(), new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)])

    builder = getBuilder();
    builder.select('*').from('users').whereBetween('id', collect([1, 2]));
    expect(builder.toSql()).toBe('select * from "users" where "id" between ? and ?')
    expect(builder.getBindings()).toEqual([1, 2])

    const subqueryBuilder = getBuilder();
    subqueryBuilder.select('id').from('posts').where('status', 'published').orderByDesc('created_at').limit(1);
    builder = getBuilder();
    builder.select('*').from('users').whereBetween(subqueryBuilder, collect([1, 2]));
    expect(builder.toSql()).toBe('select * from "users" where (select "id" from "posts" where "status" = ? order by "created_at" desc limit 1) between ? and ?')
    expect(builder.getBindings()).toEqual(['published', 1, 2])
  })


  // test('', () => {

  // })
})

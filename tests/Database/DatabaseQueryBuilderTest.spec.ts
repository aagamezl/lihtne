import { describe, expect, jest, test } from '@jest/globals'

import type { Builder, JoinClause } from '../../src/Illuminate/Database/Query'

import { Collection } from '../../src/Illuminate/Collections'
import { collect } from '../../src/Illuminate/Collections/helpers'
import { Builder as EloquentBuilder } from '../../src/Illuminate/Database/Eloquent/Builder'
import { Expression, Expression as Raw } from '../../src/Illuminate/Database/Query/Expression'
import { Carbon, DateInterval, DatePeriod, Str } from '../../src/Illuminate/Support'
import { Bar } from '../../tests/Database/Fixtures/Enums/Bar'
import { IntegerStatus, StringStatus } from './Fixtures/Enums'
import { getBuilder } from './helpers/getBuilder'
import { getMariaDbBuilder } from './helpers/getMariaDbBuilder'
import { getMockQueryBuilder } from './helpers/getMockQueryBuilder'
import { getMySqlBuilder } from './helpers/getMySqlBuilder'
import { getMySqlBuilderWithProcessor } from './helpers/getMySqlBuilderWithProcessor'
import { getPostgresBuilder } from './helpers/getPostgresBuilder'
import { getPostgresBuilderWithProcessor } from './helpers/getPostgresBuilderWithProcessor'
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

    let result = query.pipe(() => 5)
    expect(result).toBe(5)

    result = query.pipe(() => null)
    expect(result).toBe(query)

    result = query.pipe(() => {
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
    let builder = getSQLiteBuilder()
    builder.select('*').from('users').whereLike('id', '1')
    expect(builder.toSql()).toBe('select * from "users" where "id" like ?')
    expect(builder.getBindings()).toEqual(['1'])

    builder = getSQLiteBuilder()
    builder.select('*').from('users').whereLike('id', '1', true)
    expect(builder.toSql()).toBe('select * from "users" where "id" glob ?')
    expect(builder.getBindings()).toEqual(['1'])

    builder = getSQLiteBuilder()
    builder.select('*').from('users').whereLike('description', 'Hell* _orld?%', true)
    expect(builder.toSql()).toBe('select * from "users" where "description" glob ?')
    expect(builder.getBindings()).toEqual(['Hell[*] ?orld[?]*'])

    builder = getSQLiteBuilder()
    builder.select('*').from('users').whereNotLike('id', '1')
    expect(builder.toSql()).toBe('select * from "users" where "id" not like ?')
    expect(builder.getBindings()).toEqual(['1'])

    builder = getSQLiteBuilder()
    builder.select('*').from('users').whereNotLike('description', 'Hell* _orld?%', true)
    expect(builder.toSql()).toBe('select * from "users" where "description" not glob ?')
    expect(builder.getBindings()).toEqual(['Hell[*] ?orld[?]*'])

    builder = getSQLiteBuilder()
    builder.select('*').from('users').whereLike('name', 'John%', true).whereNotLike('name', '%Doe%', true)
    expect(builder.toSql()).toBe('select * from "users" where "name" glob ? and "name" not glob ?')
    expect(builder.getBindings()).toEqual(['John*', '*Doe*'])

    builder = getSQLiteBuilder()
    builder.select('*').from('users').whereLike('name', 'John%').orWhereLike('name', 'Jane%', true)
    expect(builder.toSql()).toBe('select * from "users" where "name" like ? or "name" glob ?')
    expect(builder.getBindings()).toEqual(['John%', 'Jane*'])
  })

  test('testWhereLikeClauseSqlServer', () => {
    let builder = getSqlServerBuilder()
    builder.select('*').from('users').whereLike('id', '1')
    expect(builder.toSql()).toBe('select * from [users] where [id] like ?')
    expect(builder.getBindings()).toEqual(['1'])

    builder = getSqlServerBuilder()
    builder.select('*').from('users').whereLike('id', '1').orWhereLike('id', '2')
    expect(builder.toSql()).toBe('select * from [users] where [id] like ? or [id] like ?')
    expect(builder.getBindings()).toEqual(['1', '2'])

    builder = getSqlServerBuilder()
    builder.select('*').from('users').whereNotLike('id', '1')
    expect(builder.toSql()).toBe('select * from [users] where [id] not like ?')
    expect(builder.getBindings()).toEqual(['1'])
  })

  test('testWhereDateSqlite', () => {
    let builder = getSQLiteBuilder()
    builder.select('*').from('users').whereDate('created_at', '=', '2015-12-21')
    expect(builder.toSql()).toBe('select * from "users" where strftime(\'%Y-%m-%d\', "created_at") = cast(? as text)')
    expect(builder.getBindings()).toEqual(['2015-12-21'])

    builder = getSQLiteBuilder()
    builder.select('*').from('users').whereDate('created_at', new Raw('NOW()'))
    expect(builder.toSql()).toBe('select * from "users" where strftime(\'%Y-%m-%d\', "created_at") = cast(NOW() as text)')
  })

  test('testWhereDaySqlite', () => {
    const builder = getSQLiteBuilder()
    builder.select('*').from('users').whereDay('created_at', '=', 1)
    expect(builder.toSql()).toBe('select * from "users" where strftime(\'%d\', "created_at") = cast(? as text)')
    expect(builder.getBindings()).toEqual([1])
  })

  test('testWhereMonthSqlite', () => {
    const builder = getSQLiteBuilder()
    builder.select('*').from('users').whereMonth('created_at', '=', 5)
    expect(builder.toSql()).toBe('select * from "users" where strftime(\'%m\', "created_at") = cast(? as text)')
    expect(builder.getBindings()).toEqual([5])
  })

  test('testWhereYearSqlite', () => {
    const builder = getSQLiteBuilder()
    builder.select('*').from('users').whereYear('created_at', '=', 2014)
    expect(builder.toSql()).toBe('select * from "users" where strftime(\'%Y\', "created_at") = cast(? as text)')
    expect(builder.getBindings()).toEqual([2014])
  })

  test('testWhereTimeSqlite', () => {
    const builder = getSQLiteBuilder()
    builder.select('*').from('users').whereTime('created_at', '>=', '22:00')
    expect(builder.toSql()).toBe('select * from "users" where strftime(\'%H:%M:%S\', "created_at") >= cast(? as text)')
    expect(builder.getBindings()).toEqual(['22:00'])
  })

  test('testWhereTimeOperatorOptionalSqlite', () => {
    const builder = getSQLiteBuilder()
    builder.select('*').from('users').whereTime('created_at', '22:00')
    expect(builder.toSql()).toBe('select * from "users" where strftime(\'%H:%M:%S\', "created_at") = cast(? as text)')
    expect(builder.getBindings()).toEqual(['22:00'])
  })

  test('testWhereDateSqlServer', () => {
    let builder = getSqlServerBuilder()
    builder.select('*').from('users').whereDate('created_at', '=', '2015-12-21')
    expect(builder.toSql()).toBe('select * from [users] where cast([created_at] as date) = ?')
    expect(builder.getBindings()).toEqual(['2015-12-21'])

    builder = getSqlServerBuilder()
    builder.select('*').from('users').whereDate('created_at', new Raw('NOW()'))
    expect(builder.toSql()).toBe('select * from [users] where cast([created_at] as date) = NOW()')
  })

  test('testWhereDaySqlServer', () => {
    const builder = getSqlServerBuilder()
    builder.select('*').from('users').whereDay('created_at', '=', 1)
    expect(builder.toSql()).toBe('select * from [users] where day([created_at]) = ?')
    expect(builder.getBindings()).toEqual([1])
  })

  test('testWhereMonthSqlServer', () => {
    const builder = getSqlServerBuilder()
    builder.select('*').from('users').whereMonth('created_at', '=', 5)
    expect(builder.toSql()).toBe('select * from [users] where month([created_at]) = ?')
    expect(builder.getBindings()).toEqual([5])
  })

  test('testWhereYearSqlServer', () => {
    const builder = getSqlServerBuilder()
    builder.select('*').from('users').whereYear('created_at', '=', 2014)
    expect(builder.toSql()).toBe('select * from [users] where year([created_at]) = ?')
    expect(builder.getBindings()).toEqual([2014])
  })

  test('testWhereNullSafeEquals', () => {
    let builder = getBuilder()
    builder.select('*').from('users').whereNullSafeEquals('foo', 'bar')
    expect(builder.toSql()).toBe('select * from "users" where "foo" is not distinct from ?')
    expect(builder.getBindings()).toEqual(['bar'])

    builder = getBuilder()
    builder.select('*').from('users').whereNullSafeEquals('foo', 'bar').whereNullSafeEquals('baz', 'qux')
    expect(builder.toSql()).toBe('select * from "users" where "foo" is not distinct from ? and "baz" is not distinct from ?')
    expect(builder.getBindings()).toEqual(['bar', 'qux'])
  })

  test('testOrWhereNullSafeEquals', () => {
    const builder = getBuilder()
    builder.select('*').from('users').where('foo', 'bar').orWhereNullSafeEquals('baz', 'qux')
    expect(builder.toSql()).toBe('select * from "users" where "foo" = ? or "baz" is not distinct from ?')
    expect(builder.getBindings()).toEqual(['bar', 'qux'])
  })

  test('testWhereNullSafeEqualsViaNullSafeOperator', () => {
    const builder = getBuilder()
    builder.select('*').from('users').where('foo', '<=>', 'bar')
    expect(builder.toSql()).toBe('select * from "users" where "foo" is not distinct from ?')
    expect(builder.getBindings()).toEqual(['bar'])
  })

  test('testWhereNullSafeEqualsWithNullViaOperator', () => {
    const builder = getBuilder()
    builder.select('*').from('users').where('foo', '<=>', null)
    expect(builder.toSql()).toBe('select * from "users" where "foo" is null')
  })

  test('testWhereNullSafeEqualsMySql', () => {
    let builder = getMySqlBuilder()
    builder.select('*').from('users').whereNullSafeEquals('foo', 'bar')
    expect(builder.toSql()).toBe('select * from `users` where `foo` <=> ?')
    expect(builder.getBindings()).toEqual(['bar'])

    builder = getMySqlBuilder()
    builder.select('*').from('users').where('foo', '<=>', 'bar')
    expect(builder.toSql()).toBe('select * from `users` where `foo` <=> ?')
    expect(builder.getBindings()).toEqual(['bar'])
  })

  test('testWhereNullSafeEqualsSQLite', () => {
    let builder = getSQLiteBuilder()
    builder.select('*').from('users').whereNullSafeEquals('foo', 'bar')
    expect(builder.toSql()).toBe('select * from "users" where "foo" is ?')
    expect(builder.getBindings()).toEqual(['bar'])

    builder = getSQLiteBuilder()
    builder.select('*').from('users').where('foo', '<=>', 'bar')
    expect(builder.toSql()).toBe('select * from "users" where "foo" is ?')
    expect(builder.getBindings()).toEqual(['bar'])
  })

  test('testWhereNullSafeEqualsPostgres', () => {
    let builder = getPostgresBuilder()
    builder.select('*').from('users').whereNullSafeEquals('foo', 'bar')
    expect(builder.toSql()).toBe('select * from "users" where "foo" is not distinct from ?')
    expect(builder.getBindings()).toEqual(['bar'])

    builder = getPostgresBuilder()
    builder.select('*').from('users').where('foo', '<=>', 'bar')
    expect(builder.toSql()).toBe('select * from "users" where "foo" is not distinct from ?')
    expect(builder.getBindings()).toEqual(['bar'])
  })

  test('testWhereNullSafeEqualsSqlServer', () => {
    let builder = getSqlServerBuilder()
    builder.select('*').from('users').whereNullSafeEquals('foo', 'bar')
    expect(builder.toSql()).toBe('select * from [users] where exists (select [foo] intersect select ?)')
    expect(builder.getBindings()).toEqual(['bar'])

    builder = getSqlServerBuilder()
    builder.select('*').from('users').where('foo', '<=>', 'bar')
    expect(builder.toSql()).toBe('select * from [users] where exists (select [foo] intersect select ?)')
    expect(builder.getBindings()).toEqual(['bar'])
  })

  test('testWhereBetweens', () => {
    let builder = getBuilder()
    builder.select('*').from('users').whereBetween('id', [1, 2])
    expect(builder.toSql()).toBe('select * from "users" where "id" between ? and ?')
    expect(builder.getBindings()).toEqual([1, 2])

    builder = getBuilder()
    builder.select('*').from('users').whereBetween('id', [[1, 2, 3]])
    expect(builder.toSql()).toBe('select * from "users" where "id" between ? and ?')
    expect(builder.getBindings()).toEqual([1, 2])

    builder = getBuilder()
    builder.select('*').from('users').whereBetween('id', [[1], [2, 3]])
    expect(builder.toSql()).toBe('select * from "users" where "id" between ? and ?')
    expect(builder.getBindings()).toEqual([1, 2])

    builder = getBuilder()
    builder.select('*').from('users').whereNotBetween('id', [1, 2])
    expect(builder.toSql()).toBe('select * from "users" where "id" not between ? and ?')
    expect(builder.getBindings()).toEqual([1, 2])

    builder = getBuilder()
    builder.select('*').from('users').whereBetween('id', [new Raw(1), new Raw(2)])
    expect(builder.toSql()).toBe('select * from "users" where "id" between 1 and 2')
    expect(builder.getBindings()).toEqual([])

    builder = getBuilder()
    const today = Carbon.today().toDate()
    const tomorrow = Carbon.now().addDay().startOfDay().toDate()
    let period = new DatePeriod(today, new DateInterval('P1D'), tomorrow)
    builder.select('*').from('users').whereBetween('created_at', period)
    expect(builder.toSql()).toBe('select * from "users" where "created_at" between ? and ?')
    expect(builder.getBindings()).toEqual([today, tomorrow])

    // custom long carbon period date
    builder = getBuilder()
    const nextMonth = Carbon.now().addMonth().startOfDay().toDate()
    period = new DatePeriod(today, new DateInterval('P1M'), nextMonth)
    builder.select('*').from('users').whereBetween('created_at', period)
    expect(builder.toSql()).toBe('select * from "users" where "created_at" between ? and ?')
    expect(builder.getBindings()).toEqual([today, nextMonth])

    // DatePeriod with end date
    builder = getBuilder()
    const fiveDays = Carbon.now().addDays(5).startOfDay().toDate()
    period = new DatePeriod(today, new DateInterval('P1D'), fiveDays)
    builder.select('*').from('users').whereBetween('created_at', period)
    expect(builder.toSql()).toBe('select * from "users" where "created_at" between ? and ?')
    expect(builder.getBindings()).toEqual([today, fiveDays])

    // DatePeriod with recurrence count (no end date)
    builder = getBuilder()
    period = new DatePeriod(today, new DateInterval('P1D'), 5)
    builder.select('*').from('users').whereBetween('created_at', period)
    expect(builder.toSql()).toBe('select * from "users" where "created_at" between ? and ?')
    expect(builder.getBindings()).toEqual([today, fiveDays])

    builder = getBuilder()
    builder.select('*').from('users').whereBetween('id', collect<number, number>([1, 2]))
    expect(builder.toSql()).toBe('select * from "users" where "id" between ? and ?')
    expect(builder.getBindings()).toEqual([1, 2])

    const subqueryBuilder = getBuilder()
    subqueryBuilder.select('id').from('posts').where('status', 'published').orderByDesc('created_at').limit(1)
    builder = getBuilder()
    builder.select('*').from('users').whereBetween(subqueryBuilder, collect([1, 2]))
    expect(builder.toSql()).toBe('select * from "users" where (select "id" from "posts" where "status" = ? order by "created_at" desc limit 1) between ? and ?')
    expect(builder.getBindings()).toEqual(['published', 1, 2])
  })

  test('testOrWhereBetween', () => {
    let builder = getBuilder()
    builder.select('*').from('users').where('id', '=', 1).orWhereBetween('id', [3, 5])
    expect(builder.toSql()).toBe('select * from "users" where "id" = ? or "id" between ? and ?')
    expect(builder.getBindings()).toEqual([1, 3, 5])

    expect(builder.toSql()).toBe('select * from "users" where "id" = ? or "id" between ? and ?')
    expect(builder.getBindings()).toEqual([1, 3, 5])

    builder = getBuilder()
    builder.select('*').from('users').where('id', '=', 1).orWhereBetween('id', [[3, 4, 5]])
    expect(builder.toSql()).toBe('select * from "users" where "id" = ? or "id" between ? and ?')
    expect(builder.getBindings()).toEqual([1, 3, 4])

    builder = getBuilder()
    builder.select('*').from('users').where('id', '=', 1).orWhereBetween('id', [[3, 5]])
    expect(builder.toSql()).toBe('select * from "users" where "id" = ? or "id" between ? and ?')
    expect(builder.getBindings()).toEqual([1, 3, 5])

    builder = getBuilder()
    builder.select('*').from('users').where('id', '=', 1).orWhereBetween('id', [[4], [6, 8]])
    expect(builder.toSql()).toBe('select * from "users" where "id" = ? or "id" between ? and ?')
    expect(builder.getBindings()).toEqual([1, 4, 6])

    builder = getBuilder()
    builder.select('*').from('users').where('id', '=', 1).orWhereBetween('id', collect([3, 4]))
    expect(builder.toSql()).toBe('select * from "users" where "id" = ? or "id" between ? and ?')
    expect(builder.getBindings()).toEqual([1, 3, 4])

    builder = getBuilder()
    builder.select('*').from('users').where('id', '=', 1).orWhereBetween('id', [new Raw(3), new Raw(4)])
    expect(builder.toSql()).toBe('select * from "users" where "id" = ? or "id" between 3 and 4')
    expect(builder.getBindings()).toEqual([1])
  })

  test('testOrWhereNotBetween', () => {
    let builder = getBuilder()
    builder.select('*').from('users').where('id', '=', 1).orWhereNotBetween('id', [3, 5])
    expect(builder.toSql()).toBe('select * from "users" where "id" = ? or "id" not between ? and ?')
    expect(builder.getBindings()).toEqual([1, 3, 5])

    builder = getBuilder()
    builder.select('*').from('users').where('id', '=', 1).orWhereNotBetween('id', [3, 5])
    expect(builder.toSql()).toBe('select * from "users" where "id" = ? or "id" not between ? and ?')
    expect(builder.getBindings()).toEqual([1, 3, 5])

    builder = getBuilder()
    builder.select('*').from('users').where('id', '=', 1).orWhereNotBetween('id', [[3, 5]])
    expect(builder.toSql()).toBe('select * from "users" where "id" = ? or "id" not between ? and ?')
    expect(builder.getBindings()).toEqual([1, 3, 5])

    builder = getBuilder()
    builder.select('*').from('users').where('id', '=', 1).orWhereNotBetween('id', [[4], [6, 8]])
    expect(builder.toSql()).toBe('select * from "users" where "id" = ? or "id" not between ? and ?')
    expect(builder.getBindings()).toEqual([1, 4, 6])

    builder = getBuilder()
    builder.select('*').from('users').where('id', '=', 1).orWhereNotBetween('id', collect([3, 4]))
    expect(builder.toSql()).toBe('select * from "users" where "id" = ? or "id" not between ? and ?')
    expect(builder.getBindings()).toEqual([1, 3, 4])

    builder = getBuilder()
    builder.select('*').from('users').where('id', '=', 1).orWhereNotBetween('id', [new Raw(3), new Raw(4)])
    expect(builder.toSql()).toBe('select * from "users" where "id" = ? or "id" not between 3 and 4')
    expect(builder.getBindings()).toEqual([1])
  })

  test('testWhereBetweenColumns', () => {
    let builder = getBuilder()
    builder.select('*').from('users').whereBetweenColumns('id', ['users.created_at', 'users.updated_at'])
    expect(builder.toSql()).toBe('select * from "users" where "id" between "users"."created_at" and "users"."updated_at"')
    expect(builder.getBindings()).toEqual([])

    builder = getBuilder()
    builder.select('*').from('users').whereNotBetweenColumns('id', ['created_at', 'updated_at'])
    expect(builder.toSql()).toBe('select * from "users" where "id" not between "created_at" and "updated_at"')
    expect(builder.getBindings()).toEqual([])

    builder = getBuilder()
    builder.select('*').from('users').whereBetweenColumns('id', [new Raw(1), new Raw(2)])
    expect(builder.toSql()).toBe('select * from "users" where "id" between 1 and 2')
    expect(builder.getBindings()).toEqual([])

    const subqueryBuilder = getBuilder()
    subqueryBuilder.select('created_at').from('posts').where('status', 'published').orderByDesc('created_at').limit(1)
    builder = getBuilder()
    builder.select('*').from('users').whereBetweenColumns(subqueryBuilder, ['created_at', 'updated_at'])
    expect(builder.toSql()).toBe('select * from "users" where (select "created_at" from "posts" where "status" = ? order by "created_at" desc limit 1) between "created_at" and "updated_at"')
    expect(builder.getBindings()).toEqual(['published'])
  })

  test('testOrWhereBetweenColumns', () => {
    let builder = getBuilder()
    builder.select('*').from('users').where('id', 2).orWhereBetweenColumns('id', ['users.created_at', 'users.updated_at'])
    expect(builder.toSql()).toBe('select * from "users" where "id" = ? or "id" between "users"."created_at" and "users"."updated_at"')
    expect(builder.getBindings()).toEqual([2])

    builder = getBuilder()
    builder.select('*').from('users').where('id', 2).orWhereBetweenColumns('id', ['created_at', 'updated_at'])
    expect(builder.toSql()).toBe('select * from "users" where "id" = ? or "id" between "created_at" and "updated_at"')
    expect(builder.getBindings()).toEqual([2])

    builder = getBuilder()
    builder.select('*').from('users').where('id', 2).orWhereBetweenColumns('id', [new Raw(1), new Raw(2)])
    expect(builder.toSql()).toBe('select * from "users" where "id" = ? or "id" between 1 and 2')
    expect(builder.getBindings()).toEqual([2])
  })

  test('testOrWhereNotBetweenColumns', () => {
    let builder = getBuilder()
    builder.select('*').from('users').where('id', 2).orWhereNotBetweenColumns('id', ['users.created_at', 'users.updated_at'])
    expect(builder.toSql()).toBe('select * from "users" where "id" = ? or "id" not between "users"."created_at" and "users"."updated_at"')
    expect(builder.getBindings()).toEqual([2])

    builder = getBuilder()
    builder.select('*').from('users').where('id', 2).orWhereNotBetweenColumns('id', ['created_at', 'updated_at'])
    expect(builder.toSql()).toBe('select * from "users" where "id" = ? or "id" not between "created_at" and "updated_at"')
    expect(builder.getBindings()).toEqual([2])

    builder = getBuilder()
    builder.select('*').from('users').where('id', 2).orWhereNotBetweenColumns('id', [new Raw(1), new Raw(2)])
    expect(builder.toSql()).toBe('select * from "users" where "id" = ? or "id" not between 1 and 2')
    expect(builder.getBindings()).toEqual([2])
  })

  test('testWhereValueBetween', () => {
    let builder = getBuilder()
    builder.select('*').from('users').whereValueBetween('2020-01-01 19:30:00', ['created_at', 'updated_at'])
    expect(builder.toSql()).toBe('select * from "users" where ? between "created_at" and "updated_at"')
    expect(builder.getBindings()).toEqual(['2020-01-01 19:30:00'])

    builder = getBuilder()
    builder.select('*').from('users').whereValueBetween('2020-01-01 19:30:00', ['created_at', 'updated_at'])
    expect(builder.toSql()).toBe('select * from "users" where ? between "created_at" and "updated_at"')
    expect(builder.getBindings()).toEqual(['2020-01-01 19:30:00'])

    builder = getBuilder()
    builder.select('*').from('users').whereValueBetween('2020-01-01 19:30:00', [new Raw(1), new Raw(2)])
    expect(builder.toSql()).toBe('select * from "users" where ? between 1 and 2')
    expect(builder.getBindings()).toEqual(['2020-01-01 19:30:00'])

    builder = getBuilder()
    builder.select('*').from('users').whereValueBetween(new Raw(1), ['created_at', 'updated_at'])
    expect(builder.toSql()).toBe('select * from "users" where 1 between "created_at" and "updated_at"')
    expect(builder.getBindings()).toEqual([])
  })

  test('testOrWhereValueBetween', () => {
    let builder = getBuilder()
    builder.select('*').from('users').where('id', 2).orWhereValueBetween('2020-01-01 19:30:00', ['created_at', 'updated_at'])
    expect(builder.toSql()).toBe('select * from "users" where "id" = ? or ? between "created_at" and "updated_at"')
    expect(builder.getBindings()).toEqual([2, '2020-01-01 19:30:00'])

    builder = getBuilder()
    builder.select('*').from('users').where('id', 2).orWhereValueBetween('2020-01-01 19:30:00', ['created_at', 'updated_at'])
    expect(builder.toSql()).toBe('select * from "users" where "id" = ? or ? between "created_at" and "updated_at"')
    expect(builder.getBindings()).toEqual([2, '2020-01-01 19:30:00'])

    builder = getBuilder()
    builder.select('*').from('users').where('id', 2).orWhereValueBetween('2020-01-01 19:30:00', [new Raw(1), new Raw(2)])
    expect(builder.toSql()).toBe('select * from "users" where "id" = ? or ? between 1 and 2')
    expect(builder.getBindings()).toEqual([2, '2020-01-01 19:30:00'])

    builder = getBuilder()
    builder.select('*').from('users').where('id', 2).orWhereValueBetween(new Raw(1), ['created_at', 'updated_at'])
    expect(builder.toSql()).toBe('select * from "users" where "id" = ? or 1 between "created_at" and "updated_at"')
    expect(builder.getBindings()).toEqual([2])
  })

  test('testWhereValueNotBetween', () => {
    let builder = getBuilder()
    builder.select('*').from('users').whereValueNotBetween('2020-01-01 19:30:00', ['created_at', 'updated_at'])
    expect(builder.toSql()).toBe('select * from "users" where ? not between "created_at" and "updated_at"')
    expect(builder.getBindings()).toEqual(['2020-01-01 19:30:00'])

    builder = getBuilder()
    builder.select('*').from('users').whereValueNotBetween('2020-01-01 19:30:00', ['created_at', 'updated_at'])
    expect(builder.toSql()).toBe('select * from "users" where ? not between "created_at" and "updated_at"')
    expect(builder.getBindings()).toEqual(['2020-01-01 19:30:00'])

    builder = getBuilder()
    builder.select('*').from('users').whereValueNotBetween('2020-01-01 19:30:00', [new Raw(1), new Raw(2)])
    expect(builder.toSql()).toBe('select * from "users" where ? not between 1 and 2')
    expect(builder.getBindings()).toEqual(['2020-01-01 19:30:00'])

    builder = getBuilder()
    builder.select('*').from('users').whereValueNotBetween(new Raw(1), ['created_at', 'updated_at'])
    expect(builder.toSql()).toBe('select * from "users" where 1 not between "created_at" and "updated_at"')
    expect(builder.getBindings()).toEqual([])
  })

  test('testOrWhereValueNotBetween', () => {
    let builder = getBuilder()
    builder.select('*').from('users').where('id', 2).orWhereValueNotBetween('2020-01-01 19:30:00', ['created_at', 'updated_at'])
    expect(builder.toSql()).toBe('select * from "users" where "id" = ? or ? not between "created_at" and "updated_at"')
    expect(builder.getBindings()).toEqual([2, '2020-01-01 19:30:00'])

    builder = getBuilder()
    builder.select('*').from('users').where('id', 2).orWhereValueNotBetween('2020-01-01 19:30:00', ['created_at', 'updated_at'])
    expect(builder.toSql()).toBe('select * from "users" where "id" = ? or ? not between "created_at" and "updated_at"')
    expect(builder.getBindings()).toEqual([2, '2020-01-01 19:30:00'])

    builder = getBuilder()
    builder.select('*').from('users').where('id', 2).orWhereValueNotBetween('2020-01-01 19:30:00', [new Raw(1), new Raw(2)])
    expect(builder.toSql()).toBe('select * from "users" where "id" = ? or ? not between 1 and 2')
    expect(builder.getBindings()).toEqual([2, '2020-01-01 19:30:00'])

    builder = getBuilder()
    builder.select('*').from('users').where('id', 2).orWhereValueNotBetween(new Raw(1), ['created_at', 'updated_at'])
    expect(builder.toSql()).toBe('select * from "users" where "id" = ? or 1 not between "created_at" and "updated_at"')
    expect(builder.getBindings()).toEqual([2])
  })

  test('testBasicOrWheres', () => {
    const builder = getBuilder()
    builder.select('*').from('users').where('id', '=', 1).orWhere('email', '=', 'foo')
    expect(builder.toSql()).toBe('select * from "users" where "id" = ? or "email" = ?')
    expect(builder.getBindings()).toEqual([1, 'foo'])
  })

  test('testBasicOrWhereNot', () => {
    const builder = getBuilder()
    builder.select('*').from('users').orWhereNot('name', 'foo').orWhereNot('name', '<>', 'bar')
    expect(builder.toSql()).toBe('select * from "users" where not "name" = ? or not "name" <> ?')
    expect(builder.getBindings()).toEqual(['foo', 'bar'])
  })

  test('testRawWheres', () => {
    const builder = getBuilder()
    builder.select('*').from('users').whereRaw('id = ? or email = ?', [1, 'foo'])
    expect(builder.toSql()).toBe('select * from "users" where id = ? or email = ?')
    expect(builder.getBindings()).toEqual([1, 'foo'])
  })

  test('testRawOrWheres', () => {
    const builder = getBuilder()
    builder.select('*').from('users').where('id', '=', 1).orWhereRaw('email = ?', ['foo'])
    expect(builder.toSql()).toBe('select * from "users" where "id" = ? or email = ?')
    expect(builder.getBindings()).toEqual([1, 'foo'])
  })

  test('testBasicWhereIns', () => {
    let builder = getBuilder()
    builder.select('*').from('users').whereIn('id', [1, 2, 3])
    expect(builder.toSql()).toBe('select * from "users" where "id" in (?, ?, ?)')
    expect(builder.getBindings()).toEqual([1, 2, 3])

    // associative arrays as values:
    builder = getBuilder()
    builder.select('*').from('users').whereIn('id', [
      { issue: 45582 },
      { id: 2 },
      3
    ])
    expect(builder.toSql()).toBe('select * from "users" where "id" in (?, ?, ?)')
    expect(builder.getBindings()).toEqual([45582, 2, 3])

    // can accept some nested arrays as values.
    builder = getBuilder()
    builder.select('*').from('users').whereIn('id', [
      { issue: 45582 },
      { id: 2 },
      [3]
    ])
    expect(builder.toSql()).toBe('select * from "users" where "id" in (?, ?, ?)')
    expect(builder.getBindings()).toEqual([45582, 2, 3])

    builder = getBuilder()
    builder.select('*').from('users').where('id', '=', 1).orWhereIn('id', [1, 2, 3])
    expect(builder.toSql()).toBe('select * from "users" where "id" = ? or "id" in (?, ?, ?)')
    expect(builder.getBindings()).toEqual([1, 1, 2, 3])
  })

  test('testBasicWhereInsException', () => {
    expect(() => {
      getBuilder().select('*').from('users').whereIn('id', [
        { a: 1, b: 1 },
        { c: 2 },
        [3]
      ])
    }).toThrow('InvalidArgumentException: Nested arrays may not be passed to whereIn method.')
  })

  test('testBasicWhereNotIns', () => {
    let builder = getBuilder()
    builder.select('*').from('users').whereNotIn('id', [1, 2, 3])
    expect(builder.toSql()).toBe('select * from "users" where "id" not in (?, ?, ?)')
    expect(builder.getBindings()).toEqual([1, 2, 3])

    builder = getBuilder()
    builder.select('*').from('users').where('id', '=', 1).orWhereNotIn('id', [1, 2, 3])
    expect(builder.toSql()).toBe('select * from "users" where "id" = ? or "id" not in (?, ?, ?)')
    expect(builder.getBindings()).toEqual([1, 1, 2, 3])
  })

  test('testRawWhereIns', () => {
    let builder = getBuilder()
    builder.select('*').from('users').whereIn('id', [new Raw(1)])
    expect(builder.toSql()).toBe('select * from "users" where "id" in (1)')
    expect(builder.getBindings()).toEqual([1])

    builder = getBuilder()
    builder.select('*').from('users').where('id', '=', 1).orWhereIn('id', [new Raw(1)])
    expect(builder.toSql()).toBe('select * from "users" where "id" = ? or "id" in (1)')
    expect(builder.getBindings()).toEqual([1])
  })

  test('testEmptyWhereIns', () => {
    let builder = getBuilder()
    builder.select('*').from('users').whereIn('id', [])
    expect(builder.toSql()).toBe('select * from "users" where 0 = 1')
    expect(builder.getBindings()).toEqual([])

    builder = getBuilder()
    builder.select('*').from('users').where('id', '=', 1).orWhereIn('id', [])
    expect(builder.toSql()).toBe('select * from "users" where "id" = ? or 0 = 1')
    expect(builder.getBindings()).toEqual([1])
  })

  test('testEmptyWhereNotIns', () => {
    let builder = getBuilder()
    builder.select('*').from('users').whereNotIn('id', [])
    expect(builder.toSql()).toBe('select * from "users" where 1 = 1')
    expect(builder.getBindings()).toEqual([])

    builder = getBuilder()
    builder.select('*').from('users').where('id', '=', 1).orWhereNotIn('id', [])
    expect(builder.toSql()).toBe('select * from "users" where "id" = ? or 1 = 1')
    expect(builder.getBindings()).toEqual([1])
  })

  test('testWhereIntegerInRaw', () => {
    let builder = getBuilder()
    builder.select('*').from('users').whereIntegerInRaw('id', [
      '1a', 2, Bar.FOO
    ])
    expect(builder.toSql()).toBe('select * from "users" where "id" in (1, 2, 5)')
    expect(builder.getBindings()).toEqual([])

    builder = getBuilder()
    builder.select('*').from('users').whereIntegerInRaw('id', [
      { id: '1a' },
      { id: 2 },
      { any: '3' },
      { id: Bar.FOO }
    ])
    expect(builder.toSql()).toBe('select * from "users" where "id" in (1, 2, 3, 5)')
    expect(builder.getBindings()).toEqual([])
  })

  test('testOrWhereIntegerInRaw', () => {
    const builder = getBuilder()
    builder.select('*').from('users').where('id', '=', 1).orWhereIntegerInRaw('id', ['1a', 2])
    expect(builder.toSql()).toBe('select * from "users" where "id" = ? or "id" in (1, 2)')
    expect(builder.getBindings()).toEqual([1])
  })

  test('testWhereIntegerNotInRaw', () => {
    const builder = getBuilder()
    builder.select('*').from('users').whereIntegerNotInRaw('id', ['1a', 2])
    expect(builder.toSql()).toBe('select * from "users" where "id" not in (1, 2)')
    expect(builder.getBindings()).toEqual([])
  })

  test('testOrWhereIntegerNotInRaw', () => {
    const builder = getBuilder()
    builder.select('*').from('users').where('id', '=', 1).orWhereIntegerNotInRaw('id', ['1a', 2])
    expect(builder.toSql()).toBe('select * from "users" where "id" = ? or "id" not in (1, 2)')
    expect(builder.getBindings()).toEqual([1])
  })

  test('testEmptyWhereIntegerInRaw', () => {
    const builder = getBuilder()
    builder.select('*').from('users').whereIntegerInRaw('id', [])
    expect(builder.toSql()).toBe('select * from "users" where 0 = 1')
    expect(builder.getBindings()).toEqual([])
  })

  test('testEmptyWhereIntegerNotInRaw', () => {
    const builder = getBuilder()
    builder.select('*').from('users').whereIntegerNotInRaw('id', [])
    expect(builder.toSql()).toBe('select * from "users" where 1 = 1')
    expect(builder.getBindings()).toEqual([])
  })

  test('testBasicWhereColumn', () => {
    let builder = getBuilder()
    builder.select('*').from('users').whereColumn('first_name', 'last_name').orWhereColumn('first_name', 'middle_name')
    expect(builder.toSql()).toBe('select * from "users" where "first_name" = "last_name" or "first_name" = "middle_name"')
    expect(builder.getBindings()).toEqual([])

    builder = getBuilder()
    builder.select('*').from('users').whereColumn('updated_at', '>', 'created_at')
    expect(builder.toSql()).toBe('select * from "users" where "updated_at" > "created_at"')
    expect(builder.getBindings()).toEqual([])
  })

  test('testArrayWhereColumn', () => {
    const conditions = [
      ['first_name', 'last_name'],
      ['updated_at', '>', 'created_at']
    ]
    const builder = getBuilder()
    builder.select('*').from('users').whereColumn(conditions)
    expect(builder.toSql()).toBe('select * from "users" where ("first_name" = "last_name" and "updated_at" > "created_at")')
    expect(builder.getBindings()).toEqual([])
  })

  test('testWhereFulltextMySql', () => {
    let builder = getMySqlBuilderWithProcessor()
    builder.select('*').from('users').whereFullText('body', 'Hello World')
    expect(builder.toSql()).toBe('select * from `users` where match (`body`) against (? in natural language mode)')
    expect(builder.getBindings()).toEqual(['Hello World'])

    builder = getMySqlBuilderWithProcessor()
    builder.select('*').from('users').whereFullText('body', 'Hello World', { expanded: true })
    expect(builder.toSql()).toBe('select * from `users` where match (`body`) against (? in natural language mode with query expansion)')
    expect(builder.getBindings()).toEqual(['Hello World'])

    builder = getMySqlBuilderWithProcessor()
    builder.select('*').from('users').whereFullText('body', '+Hello -World', { mode: 'boolean' })
    expect(builder.toSql()).toBe('select * from `users` where match (`body`) against (? in boolean mode)')
    expect(builder.getBindings()).toEqual(['+Hello -World'])

    builder = getMySqlBuilderWithProcessor()
    builder.select('*').from('users').whereFullText('body', '+Hello -World', { mode: 'boolean', expanded: true })
    expect(builder.toSql()).toBe('select * from `users` where match (`body`) against (? in boolean mode)')
    expect(builder.getBindings()).toEqual(['+Hello -World'])

    builder = getMySqlBuilderWithProcessor()
    builder.select('*').from('users').whereFullText(['body', 'title'], 'Car,Plane')
    expect(builder.toSql()).toBe('select * from `users` where match (`body`, `title`) against (? in natural language mode)')
    expect(builder.getBindings()).toEqual(['Car,Plane'])
  })

  test('testWhereFulltextPostgres', () => {
    let builder = getPostgresBuilderWithProcessor()
    builder.select('*').from('users').whereFullText('body', 'Hello World')
    expect(builder.toSql()).toBe('select * from "users" where (to_tsvector(\'english\', "body")) @@ plainto_tsquery(\'english\', ?)')
    expect(builder.getBindings()).toEqual(['Hello World'])

    builder = getPostgresBuilderWithProcessor()
    builder.select('*').from('users').whereFullText('body', 'Hello World', { language: 'simple' })
    expect(builder.toSql()).toBe('select * from "users" where (to_tsvector(\'simple\', "body")) @@ plainto_tsquery(\'simple\', ?)')
    expect(builder.getBindings()).toEqual(['Hello World'])

    builder = getPostgresBuilderWithProcessor()
    builder.select('*').from('users').whereFullText('body', 'Hello World', { mode: 'plain' })
    expect(builder.toSql()).toBe('select * from "users" where (to_tsvector(\'english\', "body")) @@ plainto_tsquery(\'english\', ?)')
    expect(builder.getBindings()).toEqual(['Hello World'])

    builder = getPostgresBuilderWithProcessor()
    builder.select('*').from('users').whereFullText('body', 'Hello World', { mode: 'phrase' })
    expect(builder.toSql()).toBe('select * from "users" where (to_tsvector(\'english\', "body")) @@ phraseto_tsquery(\'english\', ?)')
    expect(builder.getBindings()).toEqual(['Hello World'])

    builder = getPostgresBuilderWithProcessor()
    builder.select('*').from('users').whereFullText('body', '+Hello -World', { mode: 'websearch' })
    expect(builder.toSql()).toBe('select * from "users" where (to_tsvector(\'english\', "body")) @@ websearch_to_tsquery(\'english\', ?)')
    expect(builder.getBindings()).toEqual(['+Hello -World'])

    builder = getPostgresBuilderWithProcessor()
    builder.select('*').from('users').whereFullText('body', 'Hello World', { language: 'simple', mode: 'plain' })
    expect(builder.toSql()).toBe('select * from "users" where (to_tsvector(\'simple\', "body")) @@ plainto_tsquery(\'simple\', ?)')
    expect(builder.getBindings()).toEqual(['Hello World'])

    builder = getPostgresBuilderWithProcessor()
    builder.select('*').from('users').whereFullText(['body', 'title'], 'Car Plane')
    expect(builder.toSql()).toBe('select * from "users" where (to_tsvector(\'english\', "body") || to_tsvector(\'english\', "title")) @@ plainto_tsquery(\'english\', ?)')
    expect(builder.getBindings()).toEqual(['Car Plane'])

    builder = getPostgresBuilderWithProcessor()
    builder.select('*').from('users').whereFullText(['body', 'title'], 'Air | Plan:* -Car', { mode: 'raw' })
    expect(builder.toSql()).toBe('select * from "users" where (to_tsvector(\'english\', "body") || to_tsvector(\'english\', "title")) @@ to_tsquery(\'english\', ?)')
    expect(builder.getBindings()).toEqual(['Air | Plan:* -Car'])

    builder = getPostgresBuilderWithProcessor()
    builder.select('*').from('users').whereFullText('search_vector', 'Hello World', { vector: true })
    expect(builder.toSql()).toBe('select * from "users" where ("search_vector") @@ plainto_tsquery(\'english\', ?)')
    expect(builder.getBindings()).toEqual(['Hello World'])

    builder = getPostgresBuilderWithProcessor()
    builder.select('*').from('users').whereFullText('search_vector_nl', 'Hello World', { vector: true, language: 'dutch' })
    expect(builder.toSql()).toBe('select * from "users" where ("search_vector_nl") @@ plainto_tsquery(\'dutch\', ?)')
    expect(builder.getBindings()).toEqual(['Hello World'])

    builder = getPostgresBuilderWithProcessor()
    builder.select('*').from('users').whereFullText('search_vector', '+Hello -World', { vector: true, mode: 'websearch' })
    expect(builder.toSql()).toBe('select * from "users" where ("search_vector") @@ websearch_to_tsquery(\'english\', ?)')
    expect(builder.getBindings()).toEqual(['+Hello -World'])

    builder = getPostgresBuilderWithProcessor()
    builder.select('*').from('users').whereFullText(['tsv_title', 'tsv_body'], 'Car Plane', { vector: true })
    expect(builder.toSql()).toBe('select * from "users" where ("tsv_title" || "tsv_body") @@ plainto_tsquery(\'english\', ?)')
    expect(builder.getBindings()).toEqual(['Car Plane'])
  })

  test('testWhereAll', () => {
    let builder = getBuilder()
    builder.select('*').from('users').whereAll(['last_name', 'email'], '%Otwell%')
    expect(builder.toSql()).toBe('select * from "users" where ("last_name" = ? and "email" = ?)')
    expect(builder.getBindings()).toEqual(['%Otwell%', '%Otwell%'])

    builder = getBuilder()
    builder.select('*').from('users').whereAll(['last_name', 'email'], 'not like', '%Otwell%')
    expect(builder.toSql()).toBe('select * from "users" where ("last_name" not like ? and "email" not like ?)')
    expect(builder.getBindings()).toEqual(['%Otwell%', '%Otwell%'])

    builder = getBuilder()
    builder.select('*').from('users').whereAll([
      (query: Builder) => query.where('last_name', 'like', '%Otwell%'),
      (query: Builder) => query.where('email', 'like', '%Otwell%')
    ])
    expect(builder.toSql()).toBe('select * from "users" where (("last_name" like ?) and ("email" like ?))')
    expect(builder.getBindings()).toEqual(['%Otwell%', '%Otwell%'])
  })

  test('testOrWhereAll', () => {
    let builder = getBuilder()
    builder.select('*').from('users').where('first_name', 'like', '%Taylor%').orWhereAll(['last_name', 'email'], 'like', '%Otwell%')
    expect(builder.toSql()).toBe('select * from "users" where "first_name" like ? or ("last_name" like ? and "email" like ?)')
    expect(builder.getBindings()).toEqual(['%Taylor%', '%Otwell%', '%Otwell%'])

    builder = getBuilder()
    builder.select('*').from('users').where('first_name', 'like', '%Taylor%').whereAll(['last_name', 'email'], 'like', '%Otwell%', 'or')
    expect(builder.toSql()).toBe('select * from "users" where "first_name" like ? or ("last_name" like ? and "email" like ?)')
    expect(builder.getBindings()).toEqual(['%Taylor%', '%Otwell%', '%Otwell%'])

    builder = getBuilder()
    builder.select('*').from('users').where('first_name', 'like', '%Taylor%').orWhereAll(['last_name', 'email'], '%Otwell%')
    expect(builder.toSql()).toBe('select * from "users" where "first_name" like ? or ("last_name" = ? and "email" = ?)')
    expect(builder.getBindings()).toEqual(['%Taylor%', '%Otwell%', '%Otwell%'])

    builder = getBuilder()
    builder.select('*').from('users').where('first_name', 'like', '%Taylor%').orWhereAll([
      (query: Builder) => query.where('last_name', 'like', '%Otwell%'),
      (query: Builder) => query.where('email', 'like', '%Otwell%')
    ])
    expect(builder.toSql()).toBe('select * from "users" where "first_name" like ? or (("last_name" like ?) and ("email" like ?))')
    expect(builder.getBindings()).toEqual(['%Taylor%', '%Otwell%', '%Otwell%'])
  })

  test('testWhereAny', () => {
    let builder = getBuilder()
    builder.select('*').from('users').whereAny(['last_name', 'email'], 'like', '%Otwell%')
    expect(builder.toSql()).toBe('select * from "users" where ("last_name" like ? or "email" like ?)')
    expect(builder.getBindings()).toEqual(['%Otwell%', '%Otwell%'])

    builder = getBuilder()
    builder.select('*').from('users').whereAny(['last_name', 'email'], '%Otwell%')
    expect(builder.toSql()).toBe('select * from "users" where ("last_name" = ? or "email" = ?)')
    expect(builder.getBindings()).toEqual(['%Otwell%', '%Otwell%'])

    builder = getBuilder()
    builder.select('*').from('users').whereAny([
      (query: Builder) => query.where('last_name', 'like', '%Otwell%'),
      (query: Builder) => query.where('email', 'like', '%Otwell%')
    ])
    expect(builder.toSql()).toBe('select * from "users" where (("last_name" like ?) or ("email" like ?))')
    expect(builder.getBindings()).toEqual(['%Otwell%', '%Otwell%'])
  })

  test('testOrWhereAny', () => {
    let builder = getBuilder()
    builder.select('*').from('users').where('first_name', 'like', '%Taylor%').orWhereAny(['last_name', 'email'], 'like', '%Otwell%')
    expect(builder.toSql()).toBe('select * from "users" where "first_name" like ? or ("last_name" like ? or "email" like ?)')
    expect(builder.getBindings()).toEqual(['%Taylor%', '%Otwell%', '%Otwell%'])

    builder = getBuilder()
    builder.select('*').from('users').where('first_name', 'like', '%Taylor%').whereAny(['last_name', 'email'], 'like', '%Otwell%', 'or')
    expect(builder.toSql()).toBe('select * from "users" where "first_name" like ? or ("last_name" like ? or "email" like ?)')
    expect(builder.getBindings()).toEqual(['%Taylor%', '%Otwell%', '%Otwell%'])

    builder = getBuilder()
    builder.select('*').from('users').where('first_name', 'like', '%Taylor%').orWhereAny(['last_name', 'email'], '%Otwell%')
    expect(builder.toSql()).toBe('select * from "users" where "first_name" like ? or ("last_name" = ? or "email" = ?)')
    expect(builder.getBindings()).toEqual(['%Taylor%', '%Otwell%', '%Otwell%'])

    builder = getBuilder()
    builder.select('*').from('users').where('first_name', 'like', '%Taylor%').orWhereAny([
      (query: Builder) => query.where('last_name', 'like', '%Otwell%'),
      (query: Builder) => query.where('email', 'like', '%Otwell%')
    ])
    expect(builder.toSql()).toBe('select * from "users" where "first_name" like ? or (("last_name" like ?) or ("email" like ?))')
    expect(builder.getBindings()).toEqual(['%Taylor%', '%Otwell%', '%Otwell%'])
  })

  test('testWhereNone', () => {
    let builder = getBuilder()
    builder.select('*').from('users').whereNone(['last_name', 'email'], 'like', '%Otwell%')
    expect(builder.toSql()).toBe('select * from "users" where not ("last_name" like ? or "email" like ?)')
    expect(builder.getBindings()).toEqual(['%Otwell%', '%Otwell%'])

    builder = getBuilder()
    builder.select('*').from('users').whereNone(['last_name', 'email'], 'Otwell')
    expect(builder.toSql()).toBe('select * from "users" where not ("last_name" = ? or "email" = ?)')
    expect(builder.getBindings()).toEqual(['Otwell', 'Otwell'])

    builder = getBuilder()
    builder.select('*').from('users').where('first_name', 'like', '%Taylor%').whereNone(['last_name', 'email'], 'like', '%Otwell%')
    expect(builder.toSql()).toBe('select * from "users" where "first_name" like ? and not ("last_name" like ? or "email" like ?)', builder.toSql())
    expect(builder.getBindings()).toEqual(['%Taylor%', '%Otwell%', '%Otwell%'])

    builder = getBuilder()
    builder.select('*').from('users').whereNone([
      (query: Builder) => query.where('last_name', 'like', '%Otwell%'),
      (query: Builder) => query.where('email', 'like', '%Otwell%')
    ])
    expect(builder.toSql()).toBe('select * from "users" where not (("last_name" like ?) or ("email" like ?))')
    expect(builder.getBindings()).toEqual(['%Otwell%', '%Otwell%'])
  })

  test('testOrWhereNone', () => {
    let builder = getBuilder()
    builder.select('*').from('users').where('first_name', 'like', '%Taylor%').orWhereNone(['last_name', 'email'], 'like', '%Otwell%')
    expect(builder.toSql()).toBe('select * from "users" where "first_name" like ? or not ("last_name" like ? or "email" like ?)')
    expect(builder.getBindings()).toEqual(['%Taylor%', '%Otwell%', '%Otwell%'])

    builder = getBuilder()
    builder.select('*').from('users').where('first_name', 'like', '%Taylor%').whereNone(['last_name', 'email'], 'like', '%Otwell%', 'or')
    expect(builder.toSql()).toBe('select * from "users" where "first_name" like ? or not ("last_name" like ? or "email" like ?)')
    expect(builder.getBindings()).toEqual(['%Taylor%', '%Otwell%', '%Otwell%'])

    builder = getBuilder()
    builder.select('*').from('users').where('first_name', 'like', '%Taylor%').orWhereNone(['last_name', 'email'], '%Otwell%')
    expect(builder.toSql()).toBe('select * from "users" where "first_name" like ? or not ("last_name" = ? or "email" = ?)')
    expect(builder.getBindings()).toEqual(['%Taylor%', '%Otwell%', '%Otwell%'])

    builder = getBuilder()
    builder.select('*').from('users').where('first_name', 'like', '%Taylor%').orWhereNone([
      (query: Builder) => query.where('last_name', 'like', '%Otwell%'),
      (query: Builder) => query.where('email', 'like', '%Otwell%')
    ])
    expect(builder.toSql()).toBe('select * from "users" where "first_name" like ? or not (("last_name" like ?) or ("email" like ?))')
    expect(builder.getBindings()).toEqual(['%Taylor%', '%Otwell%', '%Otwell%'])
  })

  test('testUnions', () => {
    let builder = getBuilder()
    builder.select('*').from('users').where('id', '=', 1)
    builder.union(getBuilder().select('*').from('users').where('id', '=', 2))
    expect(builder.toSql()).toBe('(select * from "users" where "id" = ?) union (select * from "users" where "id" = ?)')
    expect(builder.getBindings()).toEqual([1, 2])

    builder = getMySqlBuilder()
    builder.select('*').from('users').where('id', '=', 1)
    builder.union(getMySqlBuilder().select('*').from('users').where('id', '=', 2))
    expect(builder.toSql()).toBe('(select * from `users` where `id` = ?) union (select * from `users` where `id` = ?)')
    expect(builder.getBindings()).toEqual([1, 2])

    builder = getMySqlBuilder()
    let expectedSql = '(select `a` from `t1` where `a` = ? and `b` = ?) union (select `a` from `t2` where `a` = ? and `b` = ?) order by `a` asc limit 10'
    const union = getMySqlBuilder().select('a').from('t2').where('a', 11).where('b', 2)
    builder.select('a').from('t1').where('a', 10).where('b', 1).union(union).orderBy('a').limit(10)
    expect(builder.toSql()).toBe(expectedSql)
    expect(builder.getBindings()).toEqual([10, 1, 11, 2])

    builder = getPostgresBuilder()
    expectedSql = '(select "name" from "users" where "id" = ?) union (select "name" from "users" where "id" = ?)'
    builder.select('name').from('users').where('id', '=', 1)
    builder.union(getPostgresBuilder().select('name').from('users').where('id', '=', 2))
    expect(builder.toSql()).toBe(expectedSql)
    expect(builder.getBindings()).toEqual([1, 2])

    builder = getSQLiteBuilder()
    expectedSql = 'select * from (select "name" from "users" where "id" = ?) union select * from (select "name" from "users" where "id" = ?)'
    builder.select('name').from('users').where('id', '=', 1)
    builder.union(getSQLiteBuilder().select('name').from('users').where('id', '=', 2))
    expect(builder.toSql()).toBe(expectedSql)
    expect(builder.getBindings()).toEqual([1, 2])

    builder = getSqlServerBuilder()
    expectedSql = 'select * from (select [name] from [users] where [id] = ?) as [temp_table] union select * from (select [name] from [users] where [id] = ?) as [temp_table]'
    builder.select('name').from('users').where('id', '=', 1)
    builder.union(getSqlServerBuilder().select('name').from('users').where('id', '=', 2))
    expect(builder.toSql()).toBe(expectedSql)
    expect(builder.getBindings()).toEqual([1, 2])

    builder = getBuilder()
    const eloquentBuilder = new EloquentBuilder(getBuilder())
    builder.select('*').from('users').where('id', '=', 1).union(eloquentBuilder.select('*').from('users').where('id', '=', 2))
    expect(builder.toSql()).toBe('(select * from "users" where "id" = ?) union (select * from "users" where "id" = ?)')
    expect(builder.getBindings()).toEqual([1, 2])
  })

  test('testUnionAlls', () => {
    let builder = getBuilder()
    builder.select('*').from('users').where('id', '=', 1)
    builder.unionAll(getBuilder().select('*').from('users').where('id', '=', 2))
    expect(builder.toSql()).toBe('(select * from "users" where "id" = ?) union all (select * from "users" where "id" = ?)')
    expect(builder.getBindings()).toEqual([1, 2])

    const expectedSql = '(select * from "users" where "id" = ?) union all (select * from "users" where "id" = ?)'
    builder = getPostgresBuilder()
    builder.select('*').from('users').where('id', '=', 1)
    builder.unionAll(getBuilder().select('*').from('users').where('id', '=', 2))
    expect(builder.toSql()).toBe(expectedSql)
    expect(builder.getBindings()).toEqual([1, 2])

    builder = getBuilder()
    const eloquentBuilder = new EloquentBuilder(getBuilder())
    builder.select('*').from('users').where('id', '=', 1)
    builder.unionAll(eloquentBuilder.select('*').from('users').where('id', '=', 2))
    expect(builder.toSql()).toBe('(select * from "users" where "id" = ?) union all (select * from "users" where "id" = ?)')
    expect(builder.getBindings()).toEqual([1, 2])
  })

  test('testMultipleUnions', () => {
    const builder = getBuilder()
    builder.select('*').from('users').where('id', '=', 1)
    builder.union(getBuilder().select('*').from('users').where('id', '=', 2))
    builder.union(getBuilder().select('*').from('users').where('id', '=', 3))
    expect(builder.toSql()).toBe('(select * from "users" where "id" = ?) union (select * from "users" where "id" = ?) union (select * from "users" where "id" = ?)')
    expect(builder.getBindings()).toEqual([1, 2, 3])
  })

  test('testMultipleUnionAlls', () => {
    const builder = getBuilder()
    builder.select('*').from('users').where('id', '=', 1)
    builder.unionAll(getBuilder().select('*').from('users').where('id', '=', 2))
    builder.unionAll(getBuilder().select('*').from('users').where('id', '=', 3))
    expect(builder.toSql()).toBe('(select * from "users" where "id" = ?) union all (select * from "users" where "id" = ?) union all (select * from "users" where "id" = ?)')
    expect(builder.getBindings()).toEqual([1, 2, 3])
  })

  test('testUnionOrderBys', () => {
    const builder = getBuilder()
    builder.select('*').from('users').where('id', '=', 1)
    builder.union(getBuilder().select('*').from('users').where('id', '=', 2))
    builder.orderBy('id', 'desc')
    expect(builder.toSql()).toBe('(select * from "users" where "id" = ?) union (select * from "users" where "id" = ?) order by "id" desc')
    expect(builder.getBindings()).toEqual([1, 2])
  })

  test('testUnionLimitsAndOffsets', () => {
    let builder = getBuilder()
    builder.select('*').from('users')
    builder.union(getBuilder().select('*').from('dogs'))
    builder.offset(5).limit(10)
    expect(builder.toSql()).toBe('(select * from "users") union (select * from "dogs") limit 10 offset 5')

    let expectedSql = '(select * from "users") union (select * from "dogs") limit 10 offset 5'
    builder = getPostgresBuilder()
    builder.select('*').from('users')
    builder.union(getBuilder().select('*').from('dogs'))
    builder.offset(5).limit(10)
    expect(builder.toSql()).toBe(expectedSql)

    expectedSql = '(select * from "users" limit 11) union (select * from "dogs" limit 22) limit 10 offset 5'
    builder = getPostgresBuilder()
    builder.select('*').from('users').limit(11)
    builder.union(getBuilder().select('*').from('dogs').limit(22))
    builder.offset(5).limit(10)
    expect(builder.toSql()).toBe(expectedSql)
  })

  test('testUnionWithJoin', () => {
    const builder = getBuilder()
    builder.select('*').from('users')
    builder.union(getBuilder().select('*').from('dogs').join('breeds', (join: Builder) => join.on('dogs.breed_id', '=', 'breeds.id').where('breeds.is_native', '=', 1)))
    expect(builder.toSql()).toBe('(select * from "users") union (select * from "dogs" inner join "breeds" on "dogs"."breed_id" = "breeds"."id" and "breeds"."is_native" = ?)')
    expect(builder.getBindings()).toEqual([1])
  })

  test('testMySqlUnionOrderBys', () => {
    const builder = getMySqlBuilder()
    builder.select('*').from('users').where('id', '=', 1)
    builder.union(getMySqlBuilder().select('*').from('users').where('id', '=', 2))
    builder.orderBy('id', 'desc')
    expect(builder.toSql()).toBe('(select * from `users` where `id` = ?) union (select * from `users` where `id` = ?) order by `id` desc')
    expect(builder.getBindings()).toEqual([1, 2])
  })

  test('testMySqlUnionLimitsAndOffsets', () => {
    const builder = getMySqlBuilder()
    builder.select('*').from('users')
    builder.union(getMySqlBuilder().select('*').from('dogs'))
    builder.offset(5).limit(10)
    expect(builder.toSql()).toBe('(select * from `users`) union (select * from `dogs`) limit 10 offset 5')
  })

  test('testUnionAggregate', async () => {
    let expected = 'select count(*) as `aggregate` from ((select * from `posts`) union (select * from `videos`)) as `temp_table`'
    let builder = getMySqlBuilder()
    const selectSpyMySql = jest.spyOn(builder.getConnection(), 'select')
      .mockImplementationOnce(() => [])
    const processSelectSpyMySql = jest.spyOn(builder.getProcessor(), 'processSelect')
    await builder.from('posts').union(getMySqlBuilder().from('videos')).count()
    expect(selectSpyMySql).toHaveBeenCalledWith(expected, [])
    expect(processSelectSpyMySql).toHaveBeenCalled()

    expected = 'select count(*) as `aggregate` from ((select `id` from `posts`) union (select `id` from `videos`)) as `temp_table`'
    builder = getMySqlBuilder()
    const selectSpyMySqlWithId = jest.spyOn(builder.getConnection(), 'select')
      .mockImplementationOnce(() => [])
    const processSelectSpyMySqlWithId = jest.spyOn(builder.getProcessor(), 'processSelect')
    await builder.from('posts').select('id').union(getMySqlBuilder().from('videos').select('id')).count()
    expect(selectSpyMySqlWithId).toHaveBeenCalledWith(expected, [])
    expect(processSelectSpyMySqlWithId).toHaveBeenCalled()

    expected = 'select count(*) as "aggregate" from ((select * from "posts") union (select * from "videos")) as "temp_table"'
    builder = getPostgresBuilder()
    const selectSpyPostgres = jest.spyOn(builder.getConnection(), 'select')
      .mockImplementationOnce(() => [])
    const processSelectSpyPostgres = jest.spyOn(builder.getProcessor(), 'processSelect')
    await builder.from('posts').union(getPostgresBuilder().from('videos')).count()
    expect(selectSpyPostgres).toHaveBeenCalledWith(expected, [])
    expect(processSelectSpyPostgres).toHaveBeenCalled()

    expected = 'select count(*) as "aggregate" from (select * from (select * from "posts") union select * from (select * from "videos")) as "temp_table"'
    builder = getSQLiteBuilder()
    const selectSpySqlite = jest.spyOn(builder.getConnection(), 'select')
      .mockImplementationOnce(() => [])
    const processSelectSpySqlite = jest.spyOn(builder.getProcessor(), 'processSelect')
    await builder.from('posts').union(getSQLiteBuilder().from('videos')).count()
    expect(selectSpySqlite).toHaveBeenCalledWith(expected, [])
    expect(processSelectSpySqlite).toHaveBeenCalled()

    expected = 'select count(*) as [aggregate] from (select * from (select * from [posts]) as [temp_table] union select * from (select * from [videos]) as [temp_table]) as [temp_table]'
    builder = getSqlServerBuilder()
    const selectSpySqlServer = jest.spyOn(builder.getConnection(), 'select')
      .mockImplementationOnce(() => [])
    const processSelectSpySqlServer = jest.spyOn(builder.getProcessor(), 'processSelect')
    await builder.from('posts').union(getSqlServerBuilder().from('videos')).count()
    expect(selectSpySqlServer).toHaveBeenCalledWith(expected, [])
    expect(processSelectSpySqlServer).toHaveBeenCalled()
  })

  test('testHavingAggregate', async () => {
    const expected = 'select count(*) as `aggregate` from (select (select `count(*)` from `videos` where `posts`.`id` = `videos`.`post_id`) as `videos_count` from `posts` having `videos_count` > ?) as `temp_table`'
    const builder = getMySqlBuilder()
    const selectSpyMySql = jest.spyOn(builder.getConnection(), 'select')
      .mockImplementationOnce(() => [])
    const processSelectSpyMySql = jest.spyOn(builder.getProcessor(), 'processSelect')

    await builder.from('posts').selectSub((query: Builder) => {
      query.from('videos').select('count(*)').whereColumn('posts.id', '=', 'videos.post_id')
    }, 'videos_count').having('videos_count', '>', 1).count()
    expect(selectSpyMySql).toHaveBeenCalledWith(expected, [1])
    expect(processSelectSpyMySql).toHaveBeenCalled()
  })

  test('testSubSelectWhereIns', () => {
    let builder = getBuilder()
    builder.select('*').from('users').whereIn('id', (q: Builder) => {
      q.select('id').from('users').where('age', '>', 25).limit(3)
    })
    expect(builder.toSql()).toBe('select * from "users" where "id" in (select "id" from "users" where "age" > ? limit 3)')
    expect(builder.getBindings()).toEqual([25])

    builder = getBuilder()
    builder.select('*').from('users').whereNotIn('id', (q: Builder) => {
      q.select('id').from('users').where('age', '>', 25).limit(3)
    })
    expect(builder.toSql()).toBe('select * from "users" where "id" not in (select "id" from "users" where "age" > ? limit 3)')
    expect(builder.getBindings()).toEqual([25])
  })

  test('testBasicWhereNulls', () => {
    let builder = getBuilder()
    builder.select('*').from('users').whereNull('id')
    expect(builder.toSql()).toBe('select * from "users" where "id" is null')
    expect(builder.getBindings()).toEqual([])

    builder = getBuilder()
    builder.select('*').from('users').where('id', '=', 1).orWhereNull('id')
    expect(builder.toSql()).toBe('select * from "users" where "id" = ? or "id" is null')
    expect(builder.getBindings()).toEqual([1])
  })

  test('testBasicWhereNullExpressionsMysql', () => {
    let builder = getMySqlBuilder()
    builder.select('*').from('users').whereNull(new Raw('id'))
    expect(builder.toSql()).toBe('select * from `users` where id is null')
    expect(builder.getBindings()).toEqual([])

    builder = getMySqlBuilder()
    builder.select('*').from('users').where('id', '=', 1).orWhereNull(new Raw('id'))
    expect(builder.toSql()).toBe('select * from `users` where `id` = ? or id is null')
    expect(builder.getBindings()).toEqual([1])
  })

  test('testJsonWhereNullMysql', () => {
    const builder = getMySqlBuilder()
    builder.select('*').from('users').whereNull('items->id')
    expect(builder.toSql()).toBe('select * from `users` where (json_extract(`items`, \'$."id"\') is null OR json_type(json_extract(`items`, \'$."id"\')) = \'NULL\')')
  })

  test('testJsonWhereNotNullMysql', () => {
    const builder = getMySqlBuilder()
    builder.select('*').from('users').whereNotNull('items->id')
    expect(builder.toSql()).toBe('select * from `users` where (json_extract(`items`, \'$."id"\') is not null AND json_type(json_extract(`items`, \'$."id"\')) != \'NULL\')')
  })

  test('testJsonWhereNullExpressionMysql', () => {
    const builder = getMySqlBuilder()
    builder.select('*').from('users').whereNull(new Raw('items->id'))
    expect(builder.toSql()).toBe('select * from `users` where (json_extract(`items`, \'$."id"\') is null OR json_type(json_extract(`items`, \'$."id"\')) = \'NULL\')')
  })

  test('testJsonWhereNotNullExpressionMysql', () => {
    const builder = getMySqlBuilder()
    builder.select('*').from('users').whereNotNull(new Raw('items->id'))
    expect(builder.toSql()).toBe('select * from `users` where (json_extract(`items`, \'$."id"\') is not null AND json_type(json_extract(`items`, \'$."id"\')) != \'NULL\')')
  })

  test('testArrayWhereNulls', () => {
    let builder = getBuilder()
    builder.select('*').from('users').whereNull(['id', 'expires_at'])
    expect(builder.toSql()).toBe('select * from "users" where "id" is null and "expires_at" is null')
    expect(builder.getBindings()).toEqual([])

    builder = getBuilder()
    builder.select('*').from('users').where('id', '=', 1).orWhereNull(['id', 'expires_at'])
    expect(builder.toSql()).toBe('select * from "users" where "id" = ? or "id" is null or "expires_at" is null')
    expect(builder.getBindings()).toEqual([1])
  })

  test('testBasicWhereNotNulls', () => {
    let builder = getBuilder()
    builder.select('*').from('users').whereNotNull('id')
    expect(builder.toSql()).toBe('select * from "users" where "id" is not null')
    expect(builder.getBindings()).toEqual([])

    builder = getBuilder()
    builder.select('*').from('users').where('id', '>', 1).orWhereNotNull('id')
    expect(builder.toSql()).toBe('select * from "users" where "id" > ? or "id" is not null')
    expect(builder.getBindings()).toEqual([1])
  })

  test('testArrayWhereNotNulls', () => {
    let builder = getBuilder()
    builder.select('*').from('users').whereNotNull(['id', 'expires_at'])
    expect(builder.toSql()).toBe('select * from "users" where "id" is not null and "expires_at" is not null')
    expect(builder.getBindings()).toEqual([])

    builder = getBuilder()
    builder.select('*').from('users').where('id', '>', 1).orWhereNotNull(['id', 'expires_at'])
    expect(builder.toSql()).toBe('select * from "users" where "id" > ? or "id" is not null or "expires_at" is not null')
    expect(builder.getBindings()).toEqual([1])
  })

  test('testGroupBys', () => {
    let builder = getBuilder()
    builder.select('*').from('users').groupBy('email')
    expect(builder.toSql()).toBe('select * from "users" group by "email"')

    builder = getBuilder()
    builder.select('*').from('users').groupBy('id', 'email')
    expect(builder.toSql()).toBe('select * from "users" group by "id", "email"')

    builder = getBuilder()
    builder.select('*').from('users').groupBy(['id', 'email'])
    expect(builder.toSql()).toBe('select * from "users" group by "id", "email"')

    builder = getBuilder()
    builder.select('*').from('users').groupBy(new Raw('DATE(created_at)'))
    expect(builder.toSql()).toBe('select * from "users" group by DATE(created_at)')

    builder = getBuilder()
    builder.select('*').from('users').groupByRaw('DATE(created_at), ? DESC', ['foo'])
    expect(builder.toSql()).toBe('select * from "users" group by DATE(created_at), ? DESC')
    expect(builder.getBindings()).toEqual(['foo'])

    builder = getBuilder()
    builder.havingRaw('?', ['havingRawBinding']).groupByRaw('?', ['groupByRawBinding']).whereRaw('?', ['whereRawBinding'])
    expect(builder.getBindings()).toEqual(['whereRawBinding', 'groupByRawBinding', 'havingRawBinding'])
  })

  test('testOrderBys', () => {
    let builder = getBuilder()
    builder.select('*').from('users').orderBy('email').orderBy('age', 'desc')
    expect(builder.toSql()).toBe('select * from "users" order by "email" asc, "age" desc')
    expect(builder.getBindings()).toEqual([])

    builder = getBuilder()
    builder.select('*').from('users').orderBy('email').orderByRaw('"age" ? desc', ['foo'])
    expect(builder.toSql()).toBe('select * from "users" order by "email" asc, "age" ? desc')
    expect(builder.getBindings()).toEqual(['foo'])

    builder = getBuilder()
    builder.select('*').from('users').orderByDesc('name')
    expect(builder.toSql()).toBe('select * from "users" order by "name" desc')

    builder = getBuilder()
    builder.select('*').from('posts').where('public', 1)
    builder.unionAll(getBuilder().select('*').from('videos').where('public', 1))
    builder.orderByRaw('field(category, ?, ?) asc', ['news', 'opinion'])
    expect(builder.toSql()).toBe('(select * from "posts" where "public" = ?) union all (select * from "videos" where "public" = ?) order by field(category, ?, ?) asc')
    expect(builder.getBindings()).toEqual([1, 1, 'news', 'opinion'])
  })

  test('testLatest', () => {
    let builder = getBuilder()
    builder.select('*').from('users').latest()
    expect(builder.toSql()).toBe('select * from "users" order by "created_at" desc')

    builder = getBuilder()
    builder.select('*').from('users').latest().limit(1)
    expect(builder.toSql()).toBe('select * from "users" order by "created_at" desc limit 1')

    builder = getBuilder()
    builder.select('*').from('users').latest('updated_at')
    expect(builder.toSql()).toBe('select * from "users" order by "updated_at" desc')
  })

  test('testOldest', () => {
    let builder = getBuilder()
    builder.select('*').from('users').oldest()
    expect(builder.toSql()).toBe('select * from "users" order by "created_at" asc')

    builder = getBuilder()
    builder.select('*').from('users').oldest().limit(1)
    expect(builder.toSql()).toBe('select * from "users" order by "created_at" asc limit 1')

    builder = getBuilder()
    builder.select('*').from('users').oldest('updated_at')
    expect(builder.toSql()).toBe('select * from "users" order by "updated_at" asc')
  })

  test('testInRandomOrderMySql', () => {
    const builder = getBuilder()
    builder.select('*').from('users').inRandomOrder()
    expect(builder.toSql()).toBe('select * from "users" order by RANDOM()')
  })

  test('testInRandomOrderMySqlGrammarWithoutSeed', () => {
    const builder = getMySqlBuilder()
    builder.select('*').from('users').inRandomOrder()
    expect(builder.toSql()).toBe('select * from `users` order by RAND()')
  })

  test('testInRandomOrderMySqlGrammarWithSeed', () => {
    const builder = getMySqlBuilder()
    builder.select('*').from('users').inRandomOrder(123)
    expect(builder.toSql()).toBe('select * from `users` order by RAND(123)')
  })

  test('testInRandomOrderPostgres', () => {
    const builder = getPostgresBuilder()
    builder.select('*').from('users').inRandomOrder()
    expect(builder.toSql()).toBe('select * from "users" order by RANDOM()')
  })

  test('testInRandomOrderSqlServer', () => {
    const builder = getSqlServerBuilder()
    builder.select('*').from('users').inRandomOrder()
    expect(builder.toSql()).toBe('select * from [users] order by NEWID()')
  })

  test('testInOrderOf', () => {
    const builder = getBuilder()
    builder.select('*').from('users').inOrderOf('status', ['active', 'pending', 'inactive'])
    expect(builder.toSql()).toBe('select * from "users" order by case when "status" = ? then 0 when "status" = ? then 1 when "status" = ? then 2 else 3 end')
    expect(builder.getBindings()).toEqual(['active', 'pending', 'inactive'])
  })

  test('testInOrderOfWithExistingOrders', () => {
    const builder = getBuilder()
    builder.select('*').from('users').inOrderOf('status', ['active', 'pending']).orderBy('name')
    expect(builder.toSql()).toBe('select * from "users" order by case when "status" = ? then 0 when "status" = ? then 1 else 2 end, "name" asc')
    expect(builder.getBindings()).toEqual(['active', 'pending'])
  })

  test('testInOrderOfWithEmptyValues', () => {
    const builder = getBuilder()
    builder.select('*').from('users').inOrderOf('status', [])
    expect(builder.toSql()).toBe('select * from "users"')
  })

  test('testInOrderOfWithSingleValue', () => {
    const builder = getBuilder()
    builder.select('*').from('users').inOrderOf('status', ['active'])
    expect(builder.toSql()).toBe('select * from "users" order by case when "status" = ? then 0 else 1 end')
    expect(builder.getBindings()).toEqual(['active'])
  })

  test('testInOrderOfMySql', () => {
    const builder = getMySqlBuilder()
    builder.select('*').from('users').inOrderOf('status', ['active', 'pending'])
    expect(builder.toSql()).toBe('select * from `users` order by case when `status` = ? then 0 when `status` = ? then 1 else 2 end')
    expect(builder.getBindings()).toEqual(['active', 'pending'])
  })

  test('testInOrderOfPostgres', () => {
    const builder = getPostgresBuilder()
    builder.select('*').from('users').inOrderOf('status', ['active', 'pending'])
    expect(builder.toSql()).toBe('select * from "users" order by case when "status" = ? then 0 when "status" = ? then 1 else 2 end')
    expect(builder.getBindings()).toEqual(['active', 'pending'])
  })

  test('testInOrderOfSqlServer', () => {
    const builder = getSqlServerBuilder()
    builder.select('*').from('users').inOrderOf('status', ['active', 'pending'])
    expect(builder.toSql()).toBe('select * from [users] order by case when [status] = ? then 0 when [status] = ? then 1 else 2 end')
    expect(builder.getBindings()).toEqual(['active', 'pending'])
  })

  test('testInOrderOfWithIntegerValues', () => {
    const builder = getBuilder()
    builder.select('*').from('users').inOrderOf('id', [5, 2, 8])
    expect(builder.toSql()).toBe('select * from "users" order by case when "id" = ? then 0 when "id" = ? then 1 when "id" = ? then 2 else 3 end')
    expect(builder.getBindings()).toEqual([5, 2, 8])
  })

  test('testInOrderOfWithWhereClause', () => {
    const builder = getBuilder()
    builder.select('*').from('users').where('active', true).inOrderOf('status', ['pending', 'approved'])
    expect(builder.toSql()).toBe('select * from "users" where "active" = ? order by case when "status" = ? then 0 when "status" = ? then 1 else 2 end')
    expect(builder.getBindings()).toEqual([true, 'pending', 'approved'])
  })

  test('testInOrderOfWithBackedEnumValues', () => {
    const builder = getBuilder()
    builder.select('*').from('users').inOrderOf('status', [StringStatus.pending, StringStatus.done, StringStatus.draft])
    expect(builder.toSql()).toBe('select * from "users" order by case when "status" = ? then 0 when "status" = ? then 1 when "status" = ? then 2 else 3 end')
    expect(builder.getBindings()).toEqual(['pending', 'done', 'draft'])
  })

  test('testInOrderOfWithIntegerBackedEnumValues', () => {
    const builder = getBuilder()
    builder.select('*').from('users').inOrderOf('status', [IntegerStatus.done, IntegerStatus.pending])
    expect(builder.toSql()).toBe('select * from "users" order by case when "status" = ? then 0 when "status" = ? then 1 else 2 end')
    expect(builder.getBindings()).toEqual([2, 1])
  })

  test('testOrderBysSqlServer', () => {
    let builder = getSqlServerBuilder()
    builder.select('*').from('users').orderBy('email').orderBy('age', 'desc')
    expect(builder.toSql()).toBe('select * from [users] order by [email] asc, [age] desc')

    builder.orders = []
    expect(builder.toSql()).toBe('select * from [users]')

    builder.orders = []
    expect(builder.toSql()).toBe('select * from [users]')

    builder = getSqlServerBuilder()
    builder.select('*').from('users').orderBy('email')
    expect(builder.toSql()).toBe('select * from [users] order by [email] asc')

    builder = getSqlServerBuilder()
    builder.select('*').from('users').orderByDesc('name')
    expect(builder.toSql()).toBe('select * from [users] order by [name] desc')

    builder = getSqlServerBuilder()
    builder.select('*').from('users').orderByRaw('[age] asc')
    expect(builder.toSql()).toBe('select * from [users] order by [age] asc')

    builder = getSqlServerBuilder()
    builder.select('*').from('users').orderBy('email').orderByRaw('[age] ? desc', ['foo'])
    expect(builder.toSql()).toBe('select * from [users] order by [email] asc, [age] ? desc')
    expect(builder.getBindings()).toEqual(['foo'])

    builder = getSqlServerBuilder()
    builder.select('*').from('users').offset(25).limit(10).orderByRaw('[email] desc')
    expect(builder.toSql()).toBe('select * from [users] order by [email] desc offset 25 rows fetch next 10 rows only')
  })

  test('testReorder', () => {
    let builder = getBuilder()
    builder.select('*').from('users').orderBy('name')
    expect(builder.toSql()).toBe('select * from "users" order by "name" asc')
    builder.reorder()
    expect(builder.toSql()).toBe('select * from "users"')

    builder = getBuilder()
    builder.select('*').from('users').orderBy('name')
    expect(builder.toSql()).toBe('select * from "users" order by "name" asc')
    builder.reorder('email', 'desc')
    expect(builder.toSql()).toBe('select * from "users" order by "email" desc')

    builder = getBuilder()
    builder.select('*').from('first')
    builder.union(getBuilder().select('*').from('second'))
    builder.orderBy('name')
    expect(builder.toSql()).toBe('(select * from "first") union (select * from "second") order by "name" asc')
    builder.reorder()
    expect(builder.toSql()).toBe('(select * from "first") union (select * from "second")')

    builder = getBuilder()
    builder.select('*').from('users').orderByRaw('?', [true])
    expect(builder.getBindings()).toEqual([true])
    builder.reorder()
    expect(builder.getBindings()).toEqual([])
  })

  test('testOrderBySubQueries', () => {
    const expected = 'select * from "users" order by (select "created_at" from "logins" where "user_id" = "users"."id" limit 1)'
    const subQuery = (query: Builder) => {
      return query.select('created_at').from('logins').whereColumn('user_id', 'users.id').limit(1)
    }

    let builder = getBuilder().select('*').from('users').orderBy(subQuery)
    expect(builder.toSql()).toBe(`${expected} asc`)

    builder = getBuilder().select('*').from('users').orderBy(subQuery, 'desc')
    expect(builder.toSql()).toBe(`${expected} desc`)

    builder = getBuilder().select('*').from('users').orderByDesc(subQuery)
    expect(builder.toSql()).toBe(`${expected} desc`)

    builder = getBuilder()
    builder.select('*').from('posts').where('public', 1)
      .unionAll(getBuilder().select('*').from('videos').where('public', 1))
      .orderBy(getBuilder().selectRaw('field(category, ?, ?)', ['news', 'opinion']))
    expect(builder.toSql()).toBe('(select * from "posts" where "public" = ?) union all (select * from "videos" where "public" = ?) order by (select field(category, ?, ?)) asc')
    expect(builder.getBindings()).toEqual([1, 1, 'news', 'opinion'])
  })

  test('testOrderByInvalidDirectionParam', () => {
    const builder = getBuilder()

    expect(() => {
      builder.select('*').from('users').orderBy('age', 'asec')
    }).toThrow('InvalidArgumentException: Order direction must be a SortDirection, "asc" or "desc".')
  })

  test('testHavings', () => {
    let builder = getBuilder()
    builder.select('*').from('users').having('email', '>', 1)
    expect(builder.toSql()).toBe('select * from "users" having "email" > ?')

    builder = getBuilder()
    builder.select('*').from('users')
      .orHaving('email', '=', 'test@example.com')
      .orHaving('email', '=', 'test2@example.com')
    expect(builder.toSql()).toBe('select * from "users" having "email" = ? or "email" = ?')

    builder = getBuilder()
    builder.select('*').from('users').groupBy('email').having('email', '>', 1)
    expect(builder.toSql()).toBe('select * from "users" group by "email" having "email" > ?')

    builder = getBuilder()
    builder.select('email as foo_email').from('users').having('foo_email', '>', 1)
    expect(builder.toSql()).toBe('select "email" as "foo_email" from "users" having "foo_email" > ?')

    builder = getBuilder()
    builder.select(['category', new Raw('count(*) as "total"')]).from('item').where('department', '=', 'popular').groupBy('category').having('total', '>', new Raw('3'))
    expect(builder.toSql()).toBe('select "category", count(*) as "total" from "item" where "department" = ? group by "category" having "total" > 3')

    builder = getBuilder()
    builder.select(['category', new Raw('count(*) as "total"')]).from('item').where('department', '=', 'popular').groupBy('category').having('total', '>', 3)
    expect(builder.toSql()).toBe('select "category", count(*) as "total" from "item" where "department" = ? group by "category" having "total" > ?')
  })

  test('testNestedHavings', () => {
    const builder = getBuilder()
    builder.select('*').from('users').having('email', '=', 'foo').orHaving((q: Builder) => {
      q.having('name', '=', 'bar').having('age', '=', 25)
    })
    expect(builder.toSql()).toBe('select * from "users" having "email" = ? or ("name" = ? and "age" = ?)')
    expect(builder.getBindings()).toEqual(['foo', 'bar', 25])
  })

  test('testNestedHavingBindings', () => {
    const builder = getBuilder()
    builder.having('email', '=', 'foo').having((q: Builder) => {
      q.selectRaw('?', ['ignore']).having('name', '=', 'bar')
    })
    expect(builder.getBindings()).toEqual(['foo', 'bar'])
  })

  test('testHavingBetweens', () => {
    let builder = getBuilder()
    builder.select('*').from('users').havingBetween('id', [1, 2, 3])
    expect(builder.toSql()).toBe('select * from "users" having "id" between ? and ?')
    expect(builder.getBindings()).toEqual([1, 2])

    builder = getBuilder()
    builder.select('*').from('users').havingBetween('id', [[1, 2], [3, 4]])
    expect(builder.toSql()).toBe('select * from "users" having "id" between ? and ?')
    expect(builder.getBindings()).toEqual([1, 2])
  })

  test('testHavingNull', () => {
    let builder = getBuilder()
    builder.select('*').from('users').havingNull('email')
    expect(builder.toSql()).toBe('select * from "users" having "email" is null')

    builder = getBuilder()
    builder.select('*').from('users')
      .havingNull('email')
      .havingNull('phone')
    expect(builder.toSql()).toBe('select * from "users" having "email" is null and "phone" is null')

    builder = getBuilder()
    builder.select('*').from('users')
      .orHavingNull('email')
      .orHavingNull('phone')
    expect(builder.toSql()).toBe('select * from "users" having "email" is null or "phone" is null')

    builder = getBuilder()
    builder.select('*').from('users').groupBy('email').havingNull('email')
    expect(builder.toSql()).toBe('select * from "users" group by "email" having "email" is null')

    builder = getBuilder()
    builder.select('email as foo_email').from('users').havingNull('foo_email')
    expect(builder.toSql()).toBe('select "email" as "foo_email" from "users" having "foo_email" is null')

    builder = getBuilder()
    builder.select(['category', new Raw('count(*) as "total"')]).from('item').where('department', '=', 'popular').groupBy('category').havingNull('total')
    expect(builder.toSql()).toBe('select "category", count(*) as "total" from "item" where "department" = ? group by "category" having "total" is null')

    builder = getBuilder()
    builder.select(['category', new Raw('count(*) as "total"')]).from('item').where('department', '=', 'popular').groupBy('category').havingNull('total')
    expect(builder.toSql()).toBe('select "category", count(*) as "total" from "item" where "department" = ? group by "category" having "total" is null')
  })

  test('testHavingNotNull', () => {
    let builder = getBuilder()
    builder.select('*').from('users').havingNotNull('email')
    expect(builder.toSql()).toBe('select * from "users" having "email" is not null')

    builder = getBuilder()
    builder.select('*').from('users')
      .havingNotNull('email')
      .havingNotNull('phone')
    expect(builder.toSql()).toBe('select * from "users" having "email" is not null and "phone" is not null')

    builder = getBuilder()
    builder.select('*').from('users')
      .orHavingNotNull('email')
      .orHavingNotNull('phone')
    expect(builder.toSql()).toBe('select * from "users" having "email" is not null or "phone" is not null')

    builder = getBuilder()
    builder.select('*').from('users').groupBy('email').havingNotNull('email')
    expect(builder.toSql()).toBe('select * from "users" group by "email" having "email" is not null')

    builder = getBuilder()
    builder.select('email as foo_email').from('users').havingNotNull('foo_email')
    expect(builder.toSql()).toBe('select "email" as "foo_email" from "users" having "foo_email" is not null')

    builder = getBuilder()
    builder.select(['category', new Raw('count(*) as "total"')]).from('item').where('department', '=', 'popular').groupBy('category').havingNotNull('total')
    expect(builder.toSql()).toBe('select "category", count(*) as "total" from "item" where "department" = ? group by "category" having "total" is not null')

    builder = getBuilder()
    builder.select(['category', new Raw('count(*) as "total"')]).from('item').where('department', '=', 'popular').groupBy('category').havingNotNull('total')
    expect(builder.toSql()).toBe('select "category", count(*) as "total" from "item" where "department" = ? group by "category" having "total" is not null')
  })

  test('testHavingExpression', () => {
    const builder = getBuilder()

    const expression = new (class extends Expression {
      constructor () {
        super('1 = 1')
      }

      public getValue () {
        return '1 = 1'
      }
    })()

    builder.select('*').from('users').having(expression)

    expect(builder.toSql()).toBe('select * from "users" having 1 = 1')
    expect(builder.getBindings()).toEqual([])
  })

  test('testHavingShortcut', () => {
    const builder = getBuilder()
    builder.select('*').from('users').having('email', 1).orHaving('email', 2)
    expect(builder.toSql()).toBe('select * from "users" having "email" = ? or "email" = ?')
  })

  test('testHavingFollowedBySelectGet', async () => {
    const rows = [{ category: 'rock', total: 5 }]

    let builder = getBuilder()
    let query = 'select "category", count(*) as "total" from "item" where "department" = ? group by "category" having "total" > ?'
    const selectSpy = jest.spyOn(builder.getConnection(), 'select')
      .mockResolvedValueOnce(rows)
    const processSelectSpy = jest.spyOn(builder.getProcessor(), 'processSelect')
      .mockImplementation((_builder, results) => results)

    builder.from('item')
    let result = await builder.select(['category', new Raw('count(*) as "total"')]).where('department', '=', 'popular').groupBy('category').having('total', '>', 3).get()
    expect(selectSpy).toHaveBeenCalledWith(query, ['popular', 3])
    expect(processSelectSpy).toHaveBeenCalled()
    expect(result.all()).toEqual(rows)

    // Using Raw value
    builder = getBuilder()
    query = 'select "category", count(*) as "total" from "item" where "department" = ? group by "category" having "total" > 3'
    const selectSpyRaw = jest.spyOn(builder.getConnection(), 'select')
      .mockResolvedValueOnce(rows)
    const processSelectSpyRaw = jest.spyOn(builder.getProcessor(), 'processSelect')
      .mockImplementation((_builder, results) => results)

    builder.from('item')
    result = await builder.select(['category', new Raw('count(*) as "total"')]).where('department', '=', 'popular').groupBy('category').having('total', '>', new Raw('3')).get()
    expect(selectSpyRaw).toHaveBeenCalledWith(query, ['popular'])
    expect(processSelectSpyRaw).toHaveBeenCalled()
    expect(result.all()).toEqual(rows)
  })

  test('testRawHavings', () => {
    let builder = getBuilder()
    builder.select('*').from('users').havingRaw('user_foo < user_bar')
    expect(builder.toSql()).toBe('select * from "users" having user_foo < user_bar')

    builder = getBuilder()
    builder.select('*').from('users').having('baz', '=', 1).orHavingRaw('user_foo < user_bar')
    expect(builder.toSql()).toBe('select * from "users" having "baz" = ? or user_foo < user_bar')

    builder = getBuilder()
    builder.select('*').from('users').havingBetween('last_login_date', ['2018-11-16', '2018-12-16']).orHavingRaw('user_foo < user_bar')
    expect(builder.toSql()).toBe('select * from "users" having "last_login_date" between ? and ? or user_foo < user_bar')
  })

  test('testLimitsAndOffsets', () => {
    let builder = getBuilder()
    builder.select('*').from('users').offset(5).limit(10)
    expect(builder.toSql()).toBe('select * from "users" limit 10 offset 5')

    builder = getBuilder()
    builder.select('*').from('users').limit(undefined)
    expect(builder.toSql()).toBe('select * from "users"')

    builder = getBuilder()
    builder.select('*').from('users').limit(0)
    expect(builder.toSql()).toBe('select * from "users" limit 0')

    builder = getBuilder()
    builder.select('*').from('users').offset(5).limit(10)
    expect(builder.toSql()).toBe('select * from "users" limit 10 offset 5')

    builder = getBuilder()
    builder.select('*').from('users').offset(0).limit(0)
    expect(builder.toSql()).toBe('select * from "users" limit 0 offset 0')

    builder = getBuilder()
    builder.select('*').from('users').offset(-5).limit(-10)
    expect(builder.toSql()).toBe('select * from "users" offset 0')

    builder = getBuilder()
    builder.select('*').from('users').offset(undefined).limit(undefined)
    expect(builder.toSql()).toBe('select * from "users" offset 0')

    builder = getBuilder()
    builder.select('*').from('users').offset(5).limit(undefined)
    expect(builder.toSql()).toBe('select * from "users" offset 5')

    builder = getBuilder()
    builder.select('*').from('users').offset(5).limit(undefined)
    expect(builder.toSql()).toBe('select * from "users" offset 5')
  })

  test('testForPage', () => {
    let builder = getBuilder()
    builder.select('*').from('users').forPage(2, 15)
    expect(builder.toSql()).toBe('select * from "users" limit 15 offset 15')

    builder = getBuilder()
    builder.select('*').from('users').forPage(0, 15)
    expect(builder.toSql()).toBe('select * from "users" limit 15 offset 0')

    builder = getBuilder()
    builder.select('*').from('users').forPage(-2, 15)
    expect(builder.toSql()).toBe('select * from "users" limit 15 offset 0')

    builder = getBuilder()
    builder.select('*').from('users').forPage(2, 0)
    expect(builder.toSql()).toBe('select * from "users" limit 0 offset 0')

    builder = getBuilder()
    builder.select('*').from('users').forPage(0, 0)
    expect(builder.toSql()).toBe('select * from "users" limit 0 offset 0')

    builder = getBuilder()
    builder.select('*').from('users').forPage(-2, 0)
    expect(builder.toSql()).toBe('select * from "users" limit 0 offset 0')
  })

  test('testForPageBeforeId', () => {
    let builder = getBuilder()
    builder.select('*').from('users').forPageBeforeId(15, undefined)
    expect(builder.toSql()).toBe('select * from "users" where "id" is not null order by "id" desc limit 15')

    builder = getBuilder()
    builder.select('*').from('users').forPageBeforeId(15, 0)
    expect(builder.toSql()).toBe('select * from "users" where "id" < ? order by "id" desc limit 15')
  })

  test('testForPageAfterId', () => {
    let builder = getBuilder()
    builder.select('*').from('users').forPageAfterId(15, undefined)
    expect(builder.toSql()).toBe('select * from "users" where "id" is not null order by "id" asc limit 15')

    builder = getBuilder()
    builder.select('*').from('users').forPageAfterId(15, 0)
    expect(builder.toSql()).toBe('select * from "users" where "id" > ? order by "id" asc limit 15')
  })

  test('testGetCountForPaginationWithBindings', async () => {
    const builder = getBuilder()
    builder.from('users').selectSub((q: Builder) => {
      q.select('body').from('posts').where('id', 4)
    }, 'post')

    const processor = builder.getProcessor()
    const connection = builder.getConnection()

    const selectSpy = jest.spyOn(connection, 'select').mockResolvedValueOnce([{ aggregate: 1 }])
    const processSelectSpy = jest.spyOn(processor, 'processSelect').mockImplementation((builder: Builder, results: unknown[]) => results)

    const count = await builder.getCountForPagination()
    expect(selectSpy).toHaveBeenCalledWith('select count(*) as "aggregate" from "users"', [4])
    expect(processSelectSpy).toHaveBeenCalled()
    expect(count).toBe(1)
    expect(builder.getBindings()).toEqual([4])
  })

  test('testGetCountForPaginationWithColumnAliases', async () => {
    const builder = getBuilder()
    const columns = ['body as post_body', 'teaser', 'posts.created as published']
    builder.from('posts').select(columns)

    const selectSpy = jest.spyOn(builder.getConnection(), 'select')
      .mockResolvedValueOnce([{ aggregate: 1 }])
    const processSelectSpy = jest.spyOn(builder.getProcessor(), 'processSelect')
      .mockImplementation((_builder, results) => results)

    const count = await builder.getCountForPagination(columns)
    expect(selectSpy).toHaveBeenCalledWith('select count("body", "teaser", "posts"."created") as "aggregate" from "posts"', [])
    expect(processSelectSpy).toHaveBeenCalled()
    expect(count).toBe(1)
  })

  test('testGetCountForPaginationWithUnion', async () => {
    const builder = getBuilder()
    builder.from('posts').select('id').union(getBuilder().from('videos').select('id'))

    const selectSpy = jest.spyOn(builder.getConnection(), 'select')
      .mockResolvedValueOnce([{ aggregate: 1 }])
    const processSelectSpy = jest.spyOn(builder.getProcessor(), 'processSelect')
      .mockImplementation((builder: Builder, results: unknown[]) => results)

    const count = await builder.getCountForPagination()
    expect(selectSpy).toHaveBeenCalledWith('select count(*) as "aggregate" from ((select "id" from "posts") union (select "id" from "videos")) as "temp_table"', [])
    expect(processSelectSpy).toHaveBeenCalled()
    expect(count).toBe(1)
  })

  test('testGetCountForPaginationWithUnionOrders', async () => {
    const builder = getBuilder()
    builder.from('posts').select('id').union(getBuilder().from('videos').select('id')).latest()

    const selectSpy = jest.spyOn(builder.getConnection(), 'select')
      .mockResolvedValueOnce([{ aggregate: 1 }])
    const processSelectSpy = jest.spyOn(builder.getProcessor(), 'processSelect')
      .mockImplementation((_builder, results) => results)

    const count = await builder.getCountForPagination()
    expect(selectSpy).toHaveBeenCalledWith('select count(*) as "aggregate" from ((select "id" from "posts") union (select "id" from "videos")) as "temp_table"', [])
    expect(processSelectSpy).toHaveBeenCalled()
    expect(count).toBe(1)
  })

  test('testGetCountForPaginationWithUnionLimitAndOffset', async () => {
    const builder = getBuilder()
    builder.from('posts').select('id').union(getBuilder().from('videos').select('id')).limit(15).offset(1)

    const selectSpy = jest.spyOn(builder.getConnection(), 'select')
      .mockResolvedValueOnce([{ aggregate: 1 }])
    const processSelectSpy = jest.spyOn(builder.getProcessor(), 'processSelect')
      .mockImplementation((_builder, results) => results)

    const count = await builder.getCountForPagination()
    expect(selectSpy).toHaveBeenCalledWith('select count(*) as "aggregate" from ((select "id" from "posts") union (select "id" from "videos")) as "temp_table"', [])
    expect(processSelectSpy).toHaveBeenCalled()
    expect(count).toBe(1)
  })

  test('testWhereShortcut', () => {
    const builder = getBuilder()
    builder.select('*').from('users').where('id', 1).orWhere('name', 'foo')
    expect(builder.toSql()).toBe('select * from "users" where "id" = ? or "name" = ?')
    expect(builder.getBindings()).toEqual([1, 'foo'])
  })

  test('testOrWheresHaveConsistentResults', () => {
    let queries = []
    let builder = getBuilder()
    builder.select('*').from('users').where('xxxx', 'xxxx').orWhere({ foo: 1, bar: 2 })
    queries.push(builder.toSql())

    builder = getBuilder()
    builder.select('*').from('users').where('xxxx', 'xxxx').orWhere([['foo', 1], ['bar', 2]])
    queries.push(builder.toSql())

    expect(queries).toEqual([
      'select * from "users" where "xxxx" = ? or ("foo" = ? or "bar" = ?)',
      'select * from "users" where "xxxx" = ? or ("foo" = ? or "bar" = ?)'
    ])

    queries = []
    builder = getBuilder()
    builder.select('*').from('users').where('xxxx', 'xxxx').orWhereColumn({ foo: '_foo', bar: '_bar' })
    queries.push(builder.toSql())

    builder = getBuilder()
    builder.select('*').from('users').where('xxxx', 'xxxx').orWhereColumn([['foo', '_foo'], ['bar', '_bar']])
    queries.push(builder.toSql())

    expect(queries).toEqual([
      'select * from "users" where "xxxx" = ? or ("foo" = "_foo" or "bar" = "_bar")',
      'select * from "users" where "xxxx" = ? or ("foo" = "_foo" or "bar" = "_bar")'
    ])
  })

  test('testWhereWithArrayConditions', () => {
    // where(key, value)

    let builder = getBuilder()
    builder.select('*').from('users').where([['foo', 1], ['bar', 2]])
    expect(builder.toSql()).toBe('select * from "users" where ("foo" = ? and "bar" = ?)')
    expect(builder.getBindings()).toEqual([1, 2])

    builder = getBuilder()
    builder.select('*').from('users').where([['foo', 1], ['bar', 2]], 'or')
    expect(builder.toSql()).toBe('select * from "users" where ("foo" = ? or "bar" = ?)')
    expect(builder.getBindings()).toEqual([1, 2])

    builder = getBuilder()
    builder.select('*').from('users').where([['foo', 1], ['bar', 2]], 'and')
    expect(builder.toSql()).toBe('select * from "users" where ("foo" = ? and "bar" = ?)')
    expect(builder.getBindings()).toEqual([1, 2])

    builder = getBuilder()
    builder.select('*').from('users').where({ foo: 1, bar: 2 })
    expect(builder.toSql()).toBe('select * from "users" where ("foo" = ? and "bar" = ?)')
    expect(builder.getBindings()).toEqual([1, 2])

    builder = getBuilder()
    builder.select('*').from('users').where({ foo: 1, bar: 2 }, 'or')
    expect(builder.toSql()).toBe('select * from "users" where ("foo" = ? or "bar" = ?)')
    expect(builder.getBindings()).toEqual([1, 2])

    builder = getBuilder()
    builder.select('*').from('users').where({ foo: 1, bar: 2 }, 'and')
    expect(builder.toSql()).toBe('select * from "users" where ("foo" = ? and "bar" = ?)')
    expect(builder.getBindings()).toEqual([1, 2])

    // where(key, <, value)

    builder = getBuilder()
    builder.select('*').from('users').where([['foo', 1], ['bar', '<', 2]])
    expect(builder.toSql()).toBe('select * from "users" where ("foo" = ? and "bar" < ?)')
    expect(builder.getBindings()).toEqual([1, 2])

    builder = getBuilder()
    builder.select('*').from('users').where([['foo', 1], ['bar', '<', 2]], 'or')
    expect(builder.toSql()).toBe('select * from "users" where ("foo" = ? or "bar" < ?)')
    expect(builder.getBindings()).toEqual([1, 2])

    builder = getBuilder()
    builder.select('*').from('users').where([['foo', 1], ['bar', '<', 2]], 'and')
    expect(builder.toSql()).toBe('select * from "users" where ("foo" = ? and "bar" < ?)')
    expect(builder.getBindings()).toEqual([1, 2])

    // whereNot(key, value)

    builder = getBuilder()
    builder.select('*').from('users').whereNot([['foo', 1], ['bar', 2]])
    expect(builder.toSql()).toBe('select * from "users" where not (("foo" = ? and "bar" = ?))')
    expect(builder.getBindings()).toEqual([1, 2])

    builder = getBuilder()
    builder.select('*').from('users').whereNot([['foo', 1], ['bar', 2]], 'or')
    expect(builder.toSql()).toBe('select * from "users" where not (("foo" = ? or "bar" = ?))')
    expect(builder.getBindings()).toEqual([1, 2])

    builder = getBuilder()
    builder.select('*').from('users').whereNot([['foo', 1], ['bar', 2]], 'and')
    expect(builder.toSql()).toBe('select * from "users" where not (("foo" = ? and "bar" = ?))')
    expect(builder.getBindings()).toEqual([1, 2])

    builder = getBuilder()
    builder.select('*').from('users').whereNot({ foo: 1, bar: 2 })
    expect(builder.toSql()).toBe('select * from "users" where not (("foo" = ? and "bar" = ?))')
    expect(builder.getBindings()).toEqual([1, 2])

    builder = getBuilder()
    builder.select('*').from('users').whereNot({ foo: 1, bar: 2 }, 'or')
    expect(builder.toSql()).toBe('select * from "users" where not (("foo" = ? or "bar" = ?))')
    expect(builder.getBindings()).toEqual([1, 2])

    builder = getBuilder()
    builder.select('*').from('users').whereNot({ foo: 1, bar: 2 }, 'and')
    expect(builder.toSql()).toBe('select * from "users" where not (("foo" = ? and "bar" = ?))')
    expect(builder.getBindings()).toEqual([1, 2])

    // whereNot(key, <, value)

    builder = getBuilder()
    builder.select('*').from('users').whereNot([['foo', 1], ['bar', '<', 2]])
    expect(builder.toSql()).toBe('select * from "users" where not (("foo" = ? and "bar" < ?))')
    expect(builder.getBindings()).toEqual([1, 2])

    builder = getBuilder()
    builder.select('*').from('users').whereNot([['foo', 1], ['bar', '<', 2]], 'or')
    expect(builder.toSql()).toBe('select * from "users" where not (("foo" = ? or "bar" < ?))')
    expect(builder.getBindings()).toEqual([1, 2])

    builder = getBuilder()
    builder.select('*').from('users').whereNot([['foo', 1], ['bar', '<', 2]], 'and')
    expect(builder.toSql()).toBe('select * from "users" where not (("foo" = ? and "bar" < ?))')
    expect(builder.getBindings()).toEqual([1, 2])

    // whereColumn(col1, col2)

    builder = getBuilder()
    builder.select('*').from('users').whereColumn([['foo', '_foo'], ['bar', '_bar']])
    expect(builder.toSql()).toBe('select * from "users" where ("foo" = "_foo" and "bar" = "_bar")')
    expect(builder.getBindings()).toEqual([])

    builder = getBuilder()
    builder.select('*').from('users').whereColumn([['foo', '_foo'], ['bar', '_bar']], 'or')
    expect(builder.toSql()).toBe('select * from "users" where ("foo" = "_foo" or "bar" = "_bar")')
    expect(builder.getBindings()).toEqual([])

    builder = getBuilder()
    builder.select('*').from('users').whereColumn([['foo', '_foo'], ['bar', '_bar']], 'and')
    expect(builder.toSql()).toBe('select * from "users" where ("foo" = "_foo" and "bar" = "_bar")')
    expect(builder.getBindings()).toEqual([])

    builder = getBuilder()
    builder.select('*').from('users').whereColumn({ foo: '_foo', bar: '_bar' })
    expect(builder.toSql()).toBe('select * from "users" where ("foo" = "_foo" and "bar" = "_bar")')
    expect(builder.getBindings()).toEqual([])

    builder = getBuilder()
    builder.select('*').from('users').whereColumn({ foo: '_foo', bar: '_bar' }, 'or')
    expect(builder.toSql()).toBe('select * from "users" where ("foo" = "_foo" or "bar" = "_bar")')
    expect(builder.getBindings()).toEqual([])

    builder = getBuilder()
    builder.select('*').from('users').whereColumn({ foo: '_foo', bar: '_bar' }, 'and')
    expect(builder.toSql()).toBe('select * from "users" where ("foo" = "_foo" and "bar" = "_bar")')
    expect(builder.getBindings()).toEqual([])

    // whereColumn(col1, <, col2)

    builder = getBuilder()
    builder.select('*').from('users').whereColumn([['foo', '_foo'], ['bar', '<', '_bar']])
    expect(builder.toSql()).toBe('select * from "users" where ("foo" = "_foo" and "bar" < "_bar")')
    expect(builder.getBindings()).toEqual([])

    builder = getBuilder()
    builder.select('*').from('users').whereColumn([['foo', '_foo'], ['bar', '<', '_bar']], 'or')
    expect(builder.toSql()).toBe('select * from "users" where ("foo" = "_foo" or "bar" < "_bar")')
    expect(builder.getBindings()).toEqual([])

    builder = getBuilder()
    builder.select('*').from('users').whereColumn([['foo', '_foo'], ['bar', '<', '_bar']], 'and')
    expect(builder.toSql()).toBe('select * from "users" where ("foo" = "_foo" and "bar" < "_bar")')
    expect(builder.getBindings()).toEqual([])

    // whereAll([...keys], value)

    builder = getBuilder()
    builder.select('*').from('users').whereAll(['foo', 'bar'], 2)
    expect(builder.toSql()).toBe('select * from "users" where ("foo" = ? and "bar" = ?)')
    expect(builder.getBindings()).toEqual([2, 2])

    builder = getBuilder()
    builder.select('*').from('users').whereAll(['foo', 'bar'], 2)
    expect(builder.toSql()).toBe('select * from "users" where ("foo" = ? and "bar" = ?)')
    expect(builder.getBindings()).toEqual([2, 2])

    // whereAny([...keys], value)

    builder = getBuilder()
    builder.select('*').from('users').whereAny(['foo', 'bar'], 2)
    expect(builder.toSql()).toBe('select * from "users" where ("foo" = ? or "bar" = ?)')
    expect(builder.getBindings()).toEqual([2, 2])

    builder = getBuilder()
    builder.select('*').from('users').whereAny(['foo', 'bar'], 2)
    expect(builder.toSql()).toBe('select * from "users" where ("foo" = ? or "bar" = ?)')
    expect(builder.getBindings()).toEqual([2, 2])

    // whereNone([...keys], value)

    builder = getBuilder()
    builder.select('*').from('users').whereNone(['foo', 'bar'], 2)
    expect(builder.toSql()).toBe('select * from "users" where not ("foo" = ? or "bar" = ?)')
    expect(builder.getBindings()).toEqual([2, 2])

    builder = getBuilder()
    builder.select('*').from('users').whereNone(['foo', 'bar'], 2)
    expect(builder.toSql()).toBe('select * from "users" where not ("foo" = ? or "bar" = ?)')
    expect(builder.getBindings()).toEqual([2, 2])

    // where()->orWhere(key, value)

    builder = getBuilder()
    builder.select('*').from('users').where('xxxx', 'xxxx').orWhere([['foo', 1], ['bar', 2]])
    expect(builder.toSql()).toBe('select * from "users" where "xxxx" = ? or ("foo" = ? or "bar" = ?)')
    expect(builder.getBindings()).toEqual(['xxxx', 1, 2])

    builder = getBuilder()
    builder.select('*').from('users').where('xxxx', 'xxxx').orWhere({ foo: 1, bar: 2 })
    expect(builder.toSql()).toBe('select * from "users" where "xxxx" = ? or ("foo" = ? or "bar" = ?)')
    expect(builder.getBindings()).toEqual(['xxxx', 1, 2])

    // where()->orWhere(key, <, value)

    builder = getBuilder()
    builder.select('*').from('users').where('xxxx', 'xxxx').orWhere([['foo', 1], ['bar', '<', 2]])
    expect(builder.toSql()).toBe('select * from "users" where "xxxx" = ? or ("foo" = ? or "bar" < ?)')
    expect(builder.getBindings()).toEqual(['xxxx', 1, 2])

    // where()->orWhereColumn(col1, col2)

    builder = getBuilder()
    builder.select('*').from('users').where('xxxx', 'xxxx').orWhereColumn([['foo', '_foo'], ['bar', '_bar']])
    expect(builder.toSql()).toBe('select * from "users" where "xxxx" = ? or ("foo" = "_foo" or "bar" = "_bar")')
    expect(builder.getBindings()).toEqual(['xxxx'])

    builder = getBuilder()
    builder.select('*').from('users').where('xxxx', 'xxxx').orWhereColumn({ foo: '_foo', bar: '_bar' })
    expect(builder.toSql()).toBe('select * from "users" where "xxxx" = ? or ("foo" = "_foo" or "bar" = "_bar")')
    expect(builder.getBindings()).toEqual(['xxxx'])

    // where()->orWhere(key, <, value)

    builder = getBuilder()
    builder.select('*').from('users').where('xxxx', 'xxxx').orWhere([['foo', 1], ['bar', '<', 2]])
    expect(builder.toSql()).toBe('select * from "users" where "xxxx" = ? or ("foo" = ? or "bar" < ?)')
    expect(builder.getBindings()).toEqual(['xxxx', 1, 2])

    // where()->orWhereNot(key, value)

    builder = getBuilder()
    builder.select('*').from('users').where('xxxx', 'xxxx').orWhereNot([['foo', 1], ['bar', 2]])
    expect(builder.toSql()).toBe('select * from "users" where "xxxx" = ? or not (("foo" = ? or "bar" = ?))')
    expect(builder.getBindings()).toEqual(['xxxx', 1, 2])

    builder = getBuilder()
    builder.select('*').from('users').where('xxxx', 'xxxx').orWhereNot({ foo: 1, bar: 2 })
    expect(builder.toSql()).toBe('select * from "users" where "xxxx" = ? or not (("foo" = ? or "bar" = ?))')
    expect(builder.getBindings()).toEqual(['xxxx', 1, 2])

    // where()->orWhereNot(key, <, value)

    builder = getBuilder()
    builder.select('*').from('users').where('xxxx', 'xxxx').orWhereNot([['foo', 1], ['bar', '<', 2]])
    expect(builder.toSql()).toBe('select * from "users" where "xxxx" = ? or not (("foo" = ? or "bar" < ?))')
    expect(builder.getBindings()).toEqual(['xxxx', 1, 2])

    // where()->orWhereAll([...keys], value)

    builder = getBuilder()
    builder.select('*').from('users').where('xxxx', 'xxxx').orWhereAll(['foo', 'bar'], 2)
    expect(builder.toSql()).toBe('select * from "users" where "xxxx" = ? or ("foo" = ? and "bar" = ?)')
    expect(builder.getBindings()).toEqual(['xxxx', 2, 2])

    builder = getBuilder()
    builder.select('*').from('users').where('xxxx', 'xxxx').orWhereAll(['foo', 'bar'], 2)
    expect(builder.toSql()).toBe('select * from "users" where "xxxx" = ? or ("foo" = ? and "bar" = ?)')
    expect(builder.getBindings()).toEqual(['xxxx', 2, 2])

    // where()->orWhereAny([...keys], value)

    builder = getBuilder()
    builder.select('*').from('users').where('xxxx', 'xxxx').orWhereAny(['foo', 'bar'], 2)
    expect(builder.toSql()).toBe('select * from "users" where "xxxx" = ? or ("foo" = ? or "bar" = ?)')
    expect(builder.getBindings()).toEqual(['xxxx', 2, 2])

    builder = getBuilder()
    builder.select('*').from('users').where('xxxx', 'xxxx').orWhereAny(['foo', 'bar'], 2)
    expect(builder.toSql()).toBe('select * from "users" where "xxxx" = ? or ("foo" = ? or "bar" = ?)')
    expect(builder.getBindings()).toEqual(['xxxx', 2, 2])

    // where()->orWhereNone([...keys], value)

    builder = getBuilder()
    builder.select('*').from('users').where('xxxx', 'xxxx').orWhereNone(['foo', 'bar'], 2)
    expect(builder.toSql()).toBe('select * from "users" where "xxxx" = ? or not ("foo" = ? or "bar" = ?)')
    expect(builder.getBindings()).toEqual(['xxxx', 2, 2])

    builder = getBuilder()
    builder.select('*').from('users').where('xxxx', 'xxxx').orWhereNone(['foo', 'bar'], 2)
    expect(builder.toSql()).toBe('select * from "users" where "xxxx" = ? or not ("foo" = ? or "bar" = ?)')
    expect(builder.getBindings()).toEqual(['xxxx', 2, 2])
  })

  test('testNestedWheres', () => {
    const builder = getBuilder()
    builder.select('*').from('users').where('email', '=', 'foo').orWhere((q: Builder) => {
      q.where('name', '=', 'bar').where('age', '=', 25)
    })
    expect(builder.toSql()).toBe('select * from "users" where "email" = ? or ("name" = ? and "age" = ?)')
    expect(builder.getBindings()).toEqual(['foo', 'bar', 25])
  })

  test('testNestedWhereBindings', () => {
    const builder = getBuilder()
    builder.where('email', '=', 'foo').where((q: Builder) => {
      q.selectRaw('?', ['ignore']).where('name', '=', 'bar')
    })
    expect(builder.getBindings()).toEqual(['foo', 'bar'])
  })

  test('testWhereNot', () => {
    let builder = getBuilder()
    builder.select('*').from('users').whereNot((q: Builder) => {
      q.where('email', '=', 'foo')
    })
    expect(builder.toSql()).toBe('select * from "users" where not ("email" = ?)')
    expect(builder.getBindings()).toEqual(['foo'])

    builder = getBuilder()
    builder.select('*').from('users').where('name', '=', 'bar').whereNot((q: Builder) => {
      q.where('email', '=', 'foo')
    })
    expect(builder.toSql()).toBe('select * from "users" where "name" = ? and not ("email" = ?)')
    expect(builder.getBindings()).toEqual(['bar', 'foo'])

    builder = getBuilder()
    builder.select('*').from('users').where('name', '=', 'bar').orWhereNot((q: Builder) => {
      q.where('email', '=', 'foo')
    })
    expect(builder.toSql()).toBe('select * from "users" where "name" = ? or not ("email" = ?)')
    expect(builder.getBindings()).toEqual(['bar', 'foo'])
  })

  test('testIncrementManyArgumentValidation1', () => {
    expect(() => {
      const builder = getBuilder()
      builder.from('users').incrementEach({ col: 'a' })
    }).toThrow(new Error('InvalidArgumentException: Non-numeric value passed as increment amount for column: \'col\'.'))
  })

  test('testIncrementManyArgumentValidation2', () => {
    expect(() => {
      const builder = getBuilder()
      builder.from('users').incrementEach({ 11: 12 })
    }).toThrow(new Error('InvalidArgumentException: Non-associative array passed to incrementEach method.'))
  })

  test('testWhereNotWithArrayConditions', () => {
    let builder = getBuilder()
    builder.select('*').from('users').whereNot([['foo', 1], ['bar', 2]])
    expect(builder.toSql()).toBe('select * from "users" where not (("foo" = ? and "bar" = ?))')
    expect(builder.getBindings()).toEqual([1, 2])

    builder = getBuilder()
    builder.select('*').from('users').whereNot({ foo: 1, bar: 2 })
    expect(builder.toSql()).toBe('select * from "users" where not (("foo" = ? and "bar" = ?))')
    expect(builder.getBindings()).toEqual([1, 2])

    builder = getBuilder()
    builder.select('*').from('users').whereNot([['foo', 1], ['bar', '<', 2]])
    expect(builder.toSql()).toBe('select * from "users" where not (("foo" = ? and "bar" < ?))')
    expect(builder.getBindings()).toEqual([1, 2])
  })

  test('testFullSubSelects', () => {
    const builder = getBuilder()
    builder.select('*').from('users').where('email', '=', 'foo').orWhere('id', '=', (q: Builder) => {
      return q.select(new Raw('max(id)')).from('users').where('email', '=', 'bar')
    })

    expect(builder.toSql()).toBe('select * from "users" where "email" = ? or "id" = (select max(id) from "users" where "email" = ?)')
    expect(builder.getBindings()).toEqual(['foo', 'bar'])
  })

  test('testWhereExists', () => {
    let builder = getBuilder()
    builder.select('*').from('orders').whereExists((q: Builder) => {
      q.select('*').from('products').where('products.id', '=', new Raw('"orders"."id"'))
    })
    expect(builder.toSql()).toBe('select * from "orders" where exists (select * from "products" where "products"."id" = "orders"."id")')

    builder = getBuilder()
    builder.select('*').from('orders').whereNotExists((q: Builder) => {
      q.select('*').from('products').where('products.id', '=', new Raw('"orders"."id"'))
    })
    expect(builder.toSql()).toBe('select * from "orders" where not exists (select * from "products" where "products"."id" = "orders"."id")')

    builder = getBuilder()
    builder.select('*').from('orders').where('id', '=', 1).orWhereExists((q: Builder) => {
      q.select('*').from('products').where('products.id', '=', new Raw('"orders"."id"'))
    })
    expect(builder.toSql()).toBe('select * from "orders" where "id" = ? or exists (select * from "products" where "products"."id" = "orders"."id")')

    builder = getBuilder()
    builder.select('*').from('orders').where('id', '=', 1).orWhereNotExists((q: Builder) => {
      q.select('*').from('products').where('products.id', '=', new Raw('"orders"."id"'))
    })
    expect(builder.toSql()).toBe('select * from "orders" where "id" = ? or not exists (select * from "products" where "products"."id" = "orders"."id")')

    builder = getBuilder()
    builder.select('*').from('orders').whereExists(
      getBuilder().select('*').from('products').where('products.id', '=', new Raw('"orders"."id"'))
    )
    expect(builder.toSql()).toBe('select * from "orders" where exists (select * from "products" where "products"."id" = "orders"."id")')

    builder = getBuilder()
    builder.select('*').from('orders').whereNotExists(
      getBuilder().select('*').from('products').where('products.id', '=', new Raw('"orders"."id"'))
    )
    expect(builder.toSql()).toBe('select * from "orders" where not exists (select * from "products" where "products"."id" = "orders"."id")')

    builder = getBuilder()
    builder.select('*').from('orders').where('id', '=', 1).orWhereExists(
      getBuilder().select('*').from('products').where('products.id', '=', new Raw('"orders"."id"'))
    )
    expect(builder.toSql()).toBe('select * from "orders" where "id" = ? or exists (select * from "products" where "products"."id" = "orders"."id")')

    builder = getBuilder()
    builder.select('*').from('orders').where('id', '=', 1).orWhereNotExists(
      getBuilder().select('*').from('products').where('products.id', '=', new Raw('"orders"."id"'))
    )
    expect(builder.toSql()).toBe('select * from "orders" where "id" = ? or not exists (select * from "products" where "products"."id" = "orders"."id")')

    builder = getBuilder()
    builder.select('*').from('orders').whereExists(
      (new EloquentBuilder(getBuilder())).select('*').from('products').where('products.id', '=', new Raw('"orders"."id"'))
    )
    expect(builder.toSql()).toBe('select * from "orders" where exists (select * from "products" where "products"."id" = "orders"."id")')
  })

  test('testBasicJoins', () => {
    let builder = getBuilder()
    builder.select('*').from('users').join('contacts', 'users.id', 'contacts.id')
    expect(builder.toSql()).toBe('select * from "users" inner join "contacts" on "users"."id" = "contacts"."id"')

    builder = getBuilder()
    builder.select('*').from('users').join('contacts', 'users.id', '=', 'contacts.id').leftJoin('photos', 'users.id', '=', 'photos.id')
    expect(builder.toSql()).toBe('select * from "users" inner join "contacts" on "users"."id" = "contacts"."id" left join "photos" on "users"."id" = "photos"."id"')

    builder = getBuilder()
    builder.select('*').from('users').leftJoinWhere('photos', 'users.id', '=', 'bar').joinWhere('photos', 'users.id', '=', 'foo')
    expect(builder.toSql()).toBe('select * from "users" left join "photos" on "users"."id" = ? inner join "photos" on "users"."id" = ?')
    expect(builder.getBindings()).toEqual(['bar', 'foo'])
  })

  test('testCrossJoins', () => {
    let builder = getBuilder()
    builder.select('*').from('sizes').crossJoin('colors')
    expect(builder.toSql()).toBe('select * from "sizes" cross join "colors"')

    builder = getBuilder()
    builder.select('*').from('tableB').join('tableA', 'tableA.column1', '=', 'tableB.column2', 'cross')
    expect(builder.toSql()).toBe('select * from "tableB" cross join "tableA" on "tableA"."column1" = "tableB"."column2"')

    builder = getBuilder()
    builder.select('*').from('tableB').crossJoin('tableA', 'tableA.column1', '=', 'tableB.column2')
    expect(builder.toSql()).toBe('select * from "tableB" cross join "tableA" on "tableA"."column1" = "tableB"."column2"')
  })

  test('testCrossJoinSubs', () => {
    const builder = getBuilder()
    builder.selectRaw('(sale / overall.sales) * 100 AS percent_of_total').from('sales').crossJoinSub(getBuilder().selectRaw('SUM(sale) AS sales').from('sales'), 'overall')
    expect(builder.toSql()).toBe('select (sale / overall.sales) * 100 AS percent_of_total from "sales" cross join (select SUM(sale) AS sales from "sales") as "overall"')
  })

  test('testComplexJoin', () => {
    let builder = getBuilder()
    builder.select('*').from('users').join('contacts', (j: JoinClause) => {
      j.on('users.id', '=', 'contacts.id').orOn('users.name', '=', 'contacts.name')
    })
    expect(builder.toSql()).toBe('select * from "users" inner join "contacts" on "users"."id" = "contacts"."id" or "users"."name" = "contacts"."name"')

    builder = getBuilder()
    builder.select('*').from('users').join('contacts', (j: JoinClause) => {
      j.where('users.id', '=', 'foo').orWhere('users.name', '=', 'bar')
    })
    expect(builder.toSql()).toBe('select * from "users" inner join "contacts" on "users"."id" = ? or "users"."name" = ?')
    expect(builder.getBindings()).toEqual(['foo', 'bar'])

    // Run the assertions again
    expect(builder.toSql()).toBe('select * from "users" inner join "contacts" on "users"."id" = ? or "users"."name" = ?')
    expect(builder.getBindings()).toEqual(['foo', 'bar'])
  })

  test('testJoinWhereNull', () => {
    let builder = getBuilder()
    builder.select('*').from('users').join('contacts', (j: JoinClause) => {
      j.on('users.id', '=', 'contacts.id').whereNull('contacts.deleted_at')
    })
    expect(builder.toSql()).toBe('select * from "users" inner join "contacts" on "users"."id" = "contacts"."id" and "contacts"."deleted_at" is null')

    builder = getBuilder()
    builder.select('*').from('users').join('contacts', (j: JoinClause) => {
      j.on('users.id', '=', 'contacts.id').orWhereNull('contacts.deleted_at')
    })
    expect(builder.toSql()).toBe('select * from "users" inner join "contacts" on "users"."id" = "contacts"."id" or "contacts"."deleted_at" is null')
  })

  test('testJoinWhereNotNull', () => {
    let builder = getBuilder()
    builder.select('*').from('users').join('contacts', (j: JoinClause) => {
      j.on('users.id', '=', 'contacts.id').whereNotNull('contacts.deleted_at')
    })
    expect(builder.toSql()).toBe('select * from "users" inner join "contacts" on "users"."id" = "contacts"."id" and "contacts"."deleted_at" is not null')

    builder = getBuilder()
    builder.select('*').from('users').join('contacts', (j: JoinClause) => {
      j.on('users.id', '=', 'contacts.id').orWhereNotNull('contacts.deleted_at')
    })
    expect(builder.toSql()).toBe('select * from "users" inner join "contacts" on "users"."id" = "contacts"."id" or "contacts"."deleted_at" is not null')
  })

  test('testJoinWhereIn', () => {
    let builder = getBuilder()
    builder.select('*').from('users').join('contacts', (j: JoinClause) => {
      j.on('users.id', '=', 'contacts.id').whereIn('contacts.name', [48, 'baz', null])
    })
    expect(builder.toSql()).toBe('select * from "users" inner join "contacts" on "users"."id" = "contacts"."id" and "contacts"."name" in (?, ?, ?)')
    expect(builder.getBindings()).toEqual([48, 'baz', null])

    builder = getBuilder()
    builder.select('*').from('users').join('contacts', (j: JoinClause) => {
      j.on('users.id', '=', 'contacts.id').orWhereIn('contacts.name', [48, 'baz', null])
    })
    expect(builder.toSql()).toBe('select * from "users" inner join "contacts" on "users"."id" = "contacts"."id" or "contacts"."name" in (?, ?, ?)')
    expect(builder.getBindings()).toEqual([48, 'baz', null])
  })

  test('testJoinWhereInSubquery', () => {
    let builder = getBuilder()
    builder.select('*').from('users').join('contacts', (j: JoinClause) => {
      const q = getBuilder()
      q.select('name').from('contacts').where('name', 'baz')
      j.on('users.id', '=', 'contacts.id').whereIn('contacts.name', q)
    })
    expect(builder.toSql()).toBe('select * from "users" inner join "contacts" on "users"."id" = "contacts"."id" and "contacts"."name" in (select "name" from "contacts" where "name" = ?)')
    expect(builder.getBindings()).toEqual(['baz'])

    builder = getBuilder()
    builder.select('*').from('users').join('contacts', (j: JoinClause) => {
      const q = getBuilder()
      q.select('name').from('contacts').where('name', 'baz')
      j.on('users.id', '=', 'contacts.id').orWhereIn('contacts.name', q)
    })
    expect(builder.toSql()).toBe('select * from "users" inner join "contacts" on "users"."id" = "contacts"."id" or "contacts"."name" in (select "name" from "contacts" where "name" = ?)')
    expect(builder.getBindings()).toEqual(['baz'])
  })

  test('testJoinWhereNotIn', () => {
    let builder = getBuilder()
    builder.select('*').from('users').join('contacts', (j: JoinClause) => {
      j.on('users.id', '=', 'contacts.id').whereNotIn('contacts.name', [48, 'baz', null])
    })
    expect(builder.toSql()).toBe('select * from "users" inner join "contacts" on "users"."id" = "contacts"."id" and "contacts"."name" not in (?, ?, ?)')
    expect(builder.getBindings()).toEqual([48, 'baz', null])

    builder = getBuilder()
    builder.select('*').from('users').join('contacts', (j: JoinClause) => {
      j.on('users.id', '=', 'contacts.id').orWhereNotIn('contacts.name', [48, 'baz', null])
    })
    expect(builder.toSql()).toBe('select * from "users" inner join "contacts" on "users"."id" = "contacts"."id" or "contacts"."name" not in (?, ?, ?)')
    expect(builder.getBindings()).toEqual([48, 'baz', null])
  })

  test('testJoinsWithNestedConditions', () => {
    let builder = getBuilder()
    builder.select('*').from('users').leftJoin('contacts', (j: JoinClause) => {
      j.on('users.id', '=', 'contacts.id').where((j: JoinClause) => {
        j.where('contacts.country', '=', 'US').orWhere('contacts.is_partner', '=', 1)
      })
    })
    expect(builder.toSql()).toBe('select * from "users" left join "contacts" on "users"."id" = "contacts"."id" and ("contacts"."country" = ? or "contacts"."is_partner" = ?)')
    expect(builder.getBindings()).toEqual(['US', 1])

    builder = getBuilder()
    builder.select('*').from('users').leftJoin('contacts', (j: JoinClause) => {
      j.on('users.id', '=', 'contacts.id').where('contacts.is_active', '=', 1).orOn((j: JoinClause) => {
        j.orWhere((j: JoinClause) => {
          j.where('contacts.country', '=', 'UK').orOn('contacts.type', '=', 'users.type')
        }).where((j: JoinClause) => {
          j.where('contacts.country', '=', 'US').orWhereNull('contacts.is_partner')
        })
      })
    })
    expect(builder.toSql()).toBe('select * from "users" left join "contacts" on "users"."id" = "contacts"."id" and "contacts"."is_active" = ? or (("contacts"."country" = ? or "contacts"."type" = "users"."type") and ("contacts"."country" = ? or "contacts"."is_partner" is null))')
    expect(builder.getBindings()).toEqual([1, 'UK', 'US'])
  })

  test.skip('testJoinsWithAdvancedConditions', () => {
    const builder = getBuilder()
    builder.select('*').from('users').leftJoin('contacts', (j: JoinClause) => {
      j.on('users.id', 'contacts.id').where((j: JoinClause) => {
        j.whereRole('admin')
          .orWhereNull('contacts.disabled')
          .orWhereRaw('year(contacts.created_at) = 2016')
      })
    })
    expect(builder.toSql()).toBe('select * from "users" left join "contacts" on "users"."id" = "contacts"."id" and ("role" = ? or "contacts"."disabled" is null or year(contacts.created_at) = 2016)')
    expect(builder.getBindings()).toEqual(['admin'])
  })

  test('testJoinsWithSubqueryCondition', () => {
    let builder = getBuilder()
    builder.select('*').from('users').leftJoin('contacts', (j: JoinClause) => {
      j.on('users.id', 'contacts.id').whereIn('contact_type_id', (q: Builder) => {
        q.select('id').from('contact_types').where('category_id', '1').whereNull('deleted_at')
      })
    })
    expect(builder.toSql()).toBe('select * from "users" left join "contacts" on "users"."id" = "contacts"."id" and "contact_type_id" in (select "id" from "contact_types" where "category_id" = ? and "deleted_at" is null)')
    expect(builder.getBindings()).toEqual(['1'])

    builder = getBuilder()
    builder.select('*').from('users').leftJoin('contacts', (j: JoinClause) => {
      j.on('users.id', 'contacts.id').whereExists((q: Builder) => {
        q.selectRaw('1').from('contact_types')
          .whereRaw('contact_types.id = contacts.contact_type_id')
          .where('category_id', '1')
          .whereNull('deleted_at')
      })
    })
    expect(builder.toSql()).toBe('select * from "users" left join "contacts" on "users"."id" = "contacts"."id" and exists (select 1 from "contact_types" where contact_types.id = contacts.contact_type_id and "category_id" = ? and "deleted_at" is null)')
    expect(builder.getBindings()).toEqual(['1'])
  })

  test('testJoinsWithAdvancedSubqueryCondition', () => {
    const builder = getBuilder()
    builder.select('*').from('users').leftJoin('contacts', (j: JoinClause) => {
      j.on('users.id', 'contacts.id').whereExists((q: Builder) => {
        q.selectRaw('1').from('contact_types')
          .whereRaw('contact_types.id = contacts.contact_type_id').where('category_id', '1').whereNull('deleted_at').whereIn('level_id', (q: Builder) => {
            q.select('id').from('levels').where('is_active', true)
          })
      })
    })
    expect(builder.toSql()).toBe('select * from "users" left join "contacts" on "users"."id" = "contacts"."id" and exists (select 1 from "contact_types" where contact_types.id = contacts.contact_type_id and "category_id" = ? and "deleted_at" is null and "level_id" in (select "id" from "levels" where "is_active" = ?))')
    expect(builder.getBindings()).toEqual(['1', true])
  })

  test('testJoinsWithNestedJoins', () => {
    const builder = getBuilder()
    builder.select('users.id', 'contacts.id', 'contact_types.id').from('users').leftJoin('contacts', (j: JoinClause) => {
      j.on('users.id', 'contacts.id').join('contact_types', 'contacts.contact_type_id', '=', 'contact_types.id')
    })
    expect(builder.toSql()).toBe('select "users"."id", "contacts"."id", "contact_types"."id" from "users" left join ("contacts" inner join "contact_types" on "contacts"."contact_type_id" = "contact_types"."id") on "users"."id" = "contacts"."id"')
  })

  test('testJoinsWithMultipleNestedJoins', () => {
    const builder = getBuilder()
    builder.select('users.id', 'contacts.id', 'contact_types.id', 'countries.id', 'planets.id').from('users').leftJoin('contacts', (j: JoinClause) => {
      j.on('users.id', 'contacts.id')
        .join('contact_types', 'contacts.contact_type_id', '=', 'contact_types.id')
        .leftJoin('countries', (q: JoinClause) => {
          q.on('contacts.country', '=', 'countries.country')
            .join('planets', (q: JoinClause) => {
              q.on('countries.planet_id', '=', 'planet.id')
                .where('planet.is_settled', '=', 1)
                .where('planet.population', '>=', 10000)
            })
        })
    })
    expect(builder.toSql()).toBe('select "users"."id", "contacts"."id", "contact_types"."id", "countries"."id", "planets"."id" from "users" left join ("contacts" inner join "contact_types" on "contacts"."contact_type_id" = "contact_types"."id" left join ("countries" inner join "planets" on "countries"."planet_id" = "planet"."id" and "planet"."is_settled" = ? and "planet"."population" >= ?) on "contacts"."country" = "countries"."country") on "users"."id" = "contacts"."id"')
    expect(builder.getBindings()).toEqual([1, 10000])
  })

  test('testJoinsWithNestedJoinWithAdvancedSubqueryCondition', () => {
    const builder = getBuilder()
    builder.select('users.id', 'contacts.id', 'contact_types.id').from('users').leftJoin('contacts', (j: JoinClause) => {
      j.on('users.id', 'contacts.id')
        .join('contact_types', 'contacts.contact_type_id', '=', 'contact_types.id')
        .whereExists((q: Builder) => {
          q.select('*').from('countries')
            .whereColumn('contacts.country', '=', 'countries.country')
            .join('planets', (q: JoinClause) => {
              q.on('countries.planet_id', '=', 'planet.id')
                .where('planet.is_settled', '=', 1)
            })
            .where('planet.population', '>=', 10000)
        })
    })
    expect(builder.toSql()).toBe('select "users"."id", "contacts"."id", "contact_types"."id" from "users" left join ("contacts" inner join "contact_types" on "contacts"."contact_type_id" = "contact_types"."id") on "users"."id" = "contacts"."id" and exists (select * from "countries" inner join "planets" on "countries"."planet_id" = "planet"."id" and "planet"."is_settled" = ? where "contacts"."country" = "countries"."country" and "planet"."population" >= ?)')
    expect(builder.getBindings()).toEqual([1, 10000])
  })

  test('testJoinWithNestedOnCondition', () => {
    const builder = getBuilder()
    builder.select('users.id').from('users').join('contacts', (j: JoinClause) => {
      return j
        .on('users.id', 'contacts.id')
        .addNestedWhereQuery(getBuilder().where('contacts.id', 1))
    })
    expect(builder.toSql()).toBe('select "users"."id" from "users" inner join "contacts" on "users"."id" = "contacts"."id" and ("contacts"."id" = ?)')
    expect(builder.getBindings()).toEqual([1])
  })

  test('testJoinSub', () => {
    let builder = getBuilder()
    builder.from('users').joinSub('select * from "contacts"', 'sub', 'users.id', '=', 'sub.id')
    expect(builder.toSql()).toBe('select * from "users" inner join (select * from "contacts") as "sub" on "users"."id" = "sub"."id"')

    builder = getBuilder()
    builder.from('users').joinSub((q: Builder) => {
      q.from('contacts')
    }, 'sub', 'users.id', '=', 'sub.id')
    expect(builder.toSql()).toBe('select * from "users" inner join (select * from "contacts") as "sub" on "users"."id" = "sub"."id"')

    builder = getBuilder()
    const eloquentBuilder = new EloquentBuilder(getBuilder().from('contacts'))
    builder.from('users').joinSub(eloquentBuilder, 'sub', 'users.id', '=', 'sub.id')
    expect(builder.toSql()).toBe('select * from "users" inner join (select * from "contacts") as "sub" on "users"."id" = "sub"."id"')

    builder = getBuilder()
    const sub1 = getBuilder().from('contacts').where('name', 'foo')
    const sub2 = getBuilder().from('contacts').where('name', 'bar')
    builder.from('users')
      .joinSub(sub1, 'sub1', 'users.id', '=', 1, 'inner', true)
      .joinSub(sub2, 'sub2', 'users.id', '=', 'sub2.user_id')
    let expected = 'select * from "users" '
    expected += 'inner join (select * from "contacts" where "name" = ?) as "sub1" on "users"."id" = ? '
    expected += 'inner join (select * from "contacts" where "name" = ?) as "sub2" on "users"."id" = "sub2"."user_id"'
    expect(builder.toSql()).toBe(expected)
    expect(builder.getRawBindings().join).toEqual(['foo', 1, 'bar'])

    expect(()
    => {
      const builder = getBuilder()
      builder.from('users').joinSub(['foo'], 'sub', 'users.id', '=', 'sub.id')
    }).toThrow(Error)
  })

  test('testJoinSubWithPrefix', () => {
    const builder = getBuilder('prefix_')
    builder.from('users').joinSub('select * from "contacts"', 'sub', 'users.id', '=', 'sub.id')
    expect(builder.toSql()).toBe('select * from "prefix_users" inner join (select * from "contacts") as "prefix_sub" on "prefix_users"."id" = "prefix_sub"."id"')
  })

  test('testLeftJoinSub', () => {
    const builder = getBuilder()
    builder.from('users').leftJoinSub(getBuilder().from('contacts'), 'sub', 'users.id', '=', 'sub.id')
    expect(builder.toSql()).toBe('select * from "users" left join (select * from "contacts") as "sub" on "users"."id" = "sub"."id"')

    expect(() => {
      const builder = getBuilder()
      builder.from('users').leftJoinSub(['foo'], 'sub', 'users.id', '=', 'sub.id')
    }).toThrow(Error)
  })

  test('testRightJoinSub', () => {
    const builder = getBuilder()
    builder.from('users').rightJoinSub(getBuilder().from('contacts'), 'sub', 'users.id', '=', 'sub.id')
    expect(builder.toSql()).toBe('select * from "users" right join (select * from "contacts") as "sub" on "users"."id" = "sub"."id"')

    expect(() => {
      const builder = getBuilder()
      builder.from('users').rightJoinSub(['foo'], 'sub', 'users.id', '=', 'sub.id')
    }).toThrow(Error)
  })

  test('testStraightJoin', () => {
    let builder = getMySqlBuilder()
    builder.select('*').from('users').straightJoin('contacts', 'users.id', 'contacts.id')
    expect(builder.toSql()).toBe('select * from `users` straight_join `contacts` on `users`.`id` = `contacts`.`id`')

    builder = getMySqlBuilder()
    builder.select('*').from('users').join('contacts', 'users.id', '=', 'contacts.id').straightJoin('photos', 'users.id', '=', 'photos.id')
    expect(builder.toSql()).toBe('select * from `users` inner join `contacts` on `users`.`id` = `contacts`.`id` straight_join `photos` on `users`.`id` = `photos`.`id`')

    builder = getMySqlBuilder()
    builder.select('*').from('users').straightJoinWhere('photos', 'users.id', '=', 'bar').joinWhere('photos', 'users.id', '=', 'foo')
    expect(builder.toSql()).toBe('select * from `users` straight_join `photos` on `users`.`id` = ? inner join `photos` on `users`.`id` = ?')
    expect(builder.getBindings()).toEqual(['bar', 'foo'])
  })

  test('testStraightJoinNoSupport', () => {
    expect(() => {
      const builder = getBuilder()
      builder.select('*').from('users').straightJoin('contacts', 'users.id', 'contacts.id')
      builder.toSql()
    }).toThrow(Error)
  })

  test('testStraightJoinSub', () => {
    const builder = getMySqlBuilder()
    builder.from('users').straightJoinSub(getBuilder().from('contacts'), 'sub', 'users.id', '=', 'sub.id')
    expect(builder.toSql()).toBe('select * from `users` straight_join (select * from "contacts") as `sub` on `users`.`id` = `sub`.`id`')

    expect(() => {
      const builder = getBuilder()
      builder.from('users').straightJoinSub(['foo'], 'sub', 'users.id', '=', 'sub.id')
    }).toThrow(Error)
  })

  test('testStraightJoinSubNoSupport', () => {
    expect(() => {
      const builder = getBuilder()
      builder.from('users').straightJoinSub(getBuilder().from('contacts'), 'sub', 'users.id', '=', 'sub.id')
      builder.toSql()
    }).toThrow(Error)
  })

  test('testJoinLateral', () => {
    let builder = getMySqlBuilder()
    builder.from('users').joinLateral('select * from `contacts` where `contracts`.`user_id` = `users`.`id`', 'sub')
    expect(builder.toSql()).toBe('select * from `users` inner join lateral (select * from `contacts` where `contracts`.`user_id` = `users`.`id`) as `sub` on true')

    builder = getMySqlBuilder()
    builder.from('users').joinLateral((q: Builder) => {
      q.from('contacts').whereColumn('contracts.user_id', 'users.id')
    }, 'sub')
    expect(builder.toSql()).toBe('select * from `users` inner join lateral (select * from `contacts` where `contracts`.`user_id` = `users`.`id`) as `sub` on true')

    builder = getMySqlBuilder()
    const sub = getMySqlBuilder()
    const eloquentBuilder = new EloquentBuilder(sub.from('contacts').whereColumn('contracts.user_id', 'users.id'))
    builder.from('users').joinLateral(eloquentBuilder, 'sub')
    expect(builder.toSql()).toBe('select * from `users` inner join lateral (select * from `contacts` where `contracts`.`user_id` = `users`.`id`) as `sub` on true')

    let sub1 = getMySqlBuilder()
    sub1 = sub1.from('contacts').whereColumn('contracts.user_id', 'users.id').where('name', 'foo')

    let sub2 = getMySqlBuilder()
    sub2 = sub2.from('contacts').whereColumn('contracts.user_id', 'users.id').where('name', 'bar')

    builder = getMySqlBuilder()
    builder.from('users').joinLateral(sub1, 'sub1').joinLateral(sub2, 'sub2')

    let expected = 'select * from `users` '
    expected += 'inner join lateral (select * from `contacts` where `contracts`.`user_id` = `users`.`id` and `name` = ?) as `sub1` on true '
    expected += 'inner join lateral (select * from `contacts` where `contracts`.`user_id` = `users`.`id` and `name` = ?) as `sub2` on true'

    expect(builder.toSql()).toBe(expected)
    expect(builder.getRawBindings().join).toEqual(['foo', 'bar'])

    expect(() => {
      const builder = getMySqlBuilder()
      builder.from('users').joinLateral(['foo'], 'sub')
    }).toThrow(Error)
  })

  test('testJoinLateralMariaDb', () => {
    expect(() => {
      const builder = getMariaDbBuilder()
      builder.from('users').joinLateral((q: Builder) => {
        q.from('contacts').whereColumn('contracts.user_id', 'users.id')
      }, 'sub')
      builder.toSql()
    }).toThrow(Error)
  })

  test('testJoinLateralSQLite', () => {
    expect(() => {
      const builder = getSQLiteBuilder()
      builder.from('users').joinLateral((q: Builder) => {
        q.from('contacts').whereColumn('contracts.user_id', 'users.id')
      }, 'sub')
      builder.toSql()
    }).toThrow(Error)
  })

  test('testJoinLateralPostgres', () => {
    const builder = getPostgresBuilder()
    builder.from('users').joinLateral((q: Builder) => {
      q.from('contacts').whereColumn('contracts.user_id', 'users.id')
    }, 'sub')
    expect(builder.toSql()).toBe('select * from "users" inner join lateral (select * from "contacts" where "contracts"."user_id" = "users"."id") as "sub" on true')
  })

  test('testJoinLateralSqlServer', () => {
    const builder = getSqlServerBuilder()
    builder.from('users').joinLateral((q: Builder) => {
      q.from('contacts').whereColumn('contracts.user_id', 'users.id')
    }, 'sub')
    expect(builder.toSql()).toBe('select * from [users] cross apply (select * from [contacts] where [contracts].[user_id] = [users].[id]) as [sub]')
  })

  test('testJoinLateralWithPrefix', () => {
    const builder = getMySqlBuilder('prefix_')
    builder.from('users').joinLateral('select * from `contacts` where `contracts`.`user_id` = `users`.`id`', 'sub')
    expect(builder.toSql()).toBe('select * from `prefix_users` inner join lateral (select * from `contacts` where `contracts`.`user_id` = `users`.`id`) as `prefix_sub` on true')
  })

  test('testLeftJoinLateral', () => {
    const builder = getMySqlBuilder()

    const sub = getMySqlBuilder()

    builder.from('users').leftJoinLateral(sub.from('contacts').whereColumn('contracts.user_id', 'users.id'), 'sub')
    expect(builder.toSql()).toBe('select * from `users` left join lateral (select * from `contacts` where `contracts`.`user_id` = `users`.`id`) as `sub` on true')

    expect(() => {
      const builder = getBuilder()
      builder.from('users').leftJoinLateral(['foo'], 'sub')
    }).toThrow(Error)
  })

  test('testLeftJoinLateralSqlServer', () => {
    const builder = getSqlServerBuilder()
    builder.from('users').leftJoinLateral((q: Builder) => {
      q.from('contacts').whereColumn('contracts.user_id', 'users.id')
    }, 'sub')
    expect(builder.toSql()).toBe('select * from [users] outer apply (select * from [contacts] where [contracts].[user_id] = [users].[id]) as [sub]')
  })

  test('testRawExpressionsInSelect', () => {
    const builder = getBuilder()
    builder.select(new Raw('substr(foo, 6)')).from('users')
    expect(builder.toSql()).toBe('select substr(foo, 6) from "users"')
  })

  test('testFindReturnsFirstResultByID', async () => {
    const builder = getBuilder()
    const connection = builder.getConnection()
    const processor = builder.getProcessor()

    jest.spyOn(connection, 'select').mockReturnValue([{ foo: 'bar' }])
    jest.spyOn(processor, 'processSelect').mockImplementation((query: Builder, results: unknown[]) => {
      return results
    })
    const results = await builder.from('users').find(1)
    expect(results).toEqual({ foo: 'bar' })
    expect(processor.processSelect).toHaveBeenCalledWith(builder, [{ foo: 'bar' }])
  })

  test('testFindOrReturnsFirstResultByID', async () => {
    const builder = getMockQueryBuilder()

    const data = {}
    jest.spyOn(builder, 'first').mockResolvedValue(data)
    jest.spyOn(builder, 'first').mockResolvedValue(data)
    jest.spyOn(builder, 'first').mockResolvedValue(undefined)

    expect(await builder.findOr(1, () => 'callback result')).toBe('callback result')
    expect(await builder.findOr(1, ['column'], () => 'callback result')).toBe('callback result')
    expect(await builder.findOr(1, () => 'callback result')).toBe('callback result')
  })

  test('testFirstMethodReturnsFirstResult', async () => {
    const builder = getBuilder()

    const connection = builder.getConnection()
    const processor = builder.getProcessor()

    jest.spyOn(connection, 'select').mockReturnValue([{ foo: 'bar' }])
    jest.spyOn(processor, 'processSelect').mockImplementation((query: Builder, results: unknown[]) => {
      return results
    })

    const results = await builder.from('users').where('id', '=', 1).first()
    expect(results).toEqual({ foo: 'bar' })
    expect(processor.processSelect).toHaveBeenCalledWith(builder, [{ foo: 'bar' }])
  })

  test('testFirstOrFailMethodReturnsFirstResult', async () => {
    const builder = getBuilder()
    const connection = builder.getConnection()
    const processor = builder.getProcessor()

    jest.spyOn(connection, 'select').mockReturnValue([{ foo: 'bar' }])
    jest.spyOn(processor, 'processSelect').mockImplementation((query: Builder, results: unknown[]) => {
      return results
    })
    const results = await builder.from('users').where('id', '=', 1).firstOrFail()
    expect(results).toEqual({ foo: 'bar' })
  })

  test('testFirstOrFailMethodThrowsRecordNotFoundException', async () => {
    const builder = getBuilder()
    const connection = builder.getConnection()
    const processor = builder.getProcessor()

    jest.spyOn(connection, 'select').mockResolvedValue([])
    jest.spyOn(processor, 'processSelect').mockImplementation((query: Builder, results: unknown[]) => {
      return results
    })

    await expect(builder.from('users').where('id', '=', 1).firstOrFail()).rejects.toThrow(
      'RecordNotFoundException: No record found for the given query.'
    )
  })

  test('testPluckMethodGetsCollectionOfColumnValues', async () => {
    let builder = getBuilder()
    let connection = builder.getConnection()
    let processor = builder.getProcessor()
    jest.spyOn(connection, 'select').mockReturnValue([{ foo: 'bar' }, { foo: 'baz' }])
    jest.spyOn(processor, 'processSelect').mockImplementation((query: Builder, results: unknown[]) => {
      return results
    })
    let results = await builder.from('users').where('id', '=', 1).pluck('foo')
    expect(results.all()).toEqual(['bar', 'baz'])
    expect(processor.processSelect).toHaveBeenCalledWith(builder, [{ foo: 'bar' }, { foo: 'baz' }])

    builder = getBuilder()
    connection = builder.getConnection()
    processor = builder.getProcessor()
    jest.spyOn(connection, 'select').mockReturnValue([{ id: 1, foo: 'bar' }, { id: 10, foo: 'baz' }])
    jest.spyOn(processor, 'processSelect').mockImplementation((query: Builder, results: unknown[]) => {
      return results
    })
    results = await builder.from('users').where('id', '=', 1).pluck('foo', 'id')
    expect(results.all()).toEqual({ 1: 'bar', 10: 'baz' })
    expect(processor.processSelect).toHaveBeenCalledWith(builder, [{ id: 1, foo: 'bar' }, { id: 10, foo: 'baz' }])
  })

  test('testPluckAvoidsDuplicateColumnSelection', async () => {
    const builder = getBuilder()
    const connection = builder.getConnection()
    const processor = builder.getProcessor()

    jest.spyOn(connection, 'select').mockImplementation((sql: string, bindings: unknown) => {
      expect(sql).toBe('select "foo" from "users" where "id" = ?')
      expect(bindings).toEqual([1])

      return Promise.resolve([{ foo: 'bar' }])
    })
    jest.spyOn(processor, 'processSelect').mockImplementation((query: Builder, results: unknown[]) => {
      return results
    })

    const results = await builder.from('users').where('id', '=', 1).pluck('foo', 'foo')
    expect(results.all()).toEqual({ bar: 'bar' })
  })

  test('testImplode', async () => {
    // Test without glue.
    let builder = getBuilder()
    let connection = builder.getConnection()
    let processor = builder.getProcessor()
    jest.spyOn(connection, 'select').mockResolvedValue([{ foo: 'bar' }, { foo: 'baz' }])
    jest.spyOn(processor, 'processSelect').mockImplementation((query: Builder, results: unknown[]) => {
      return results
    })
    let results = await builder.from('users').where('id', '=', 1).implode('foo')
    expect(results).toBe('barbaz')

    // Test with glue.
    builder = getBuilder()
    connection = builder.getConnection()
    processor = builder.getProcessor()
    jest.spyOn(connection, 'select').mockResolvedValue([{ foo: 'bar' }, { foo: 'baz' }])
    jest.spyOn(processor, 'processSelect').mockImplementation((query: Builder, results: unknown[]) => {
      return results
    })
    results = await builder.from('users').where('id', '=', 1).implode('foo', ',')
    expect(results).toBe('bar,baz')
  })

  test('testValueMethodReturnsSingleColumn', async () => {
    const builder = getBuilder()
    const connection = builder.getConnection()
    const processor = builder.getProcessor()

    jest.spyOn(connection, 'select').mockResolvedValue([{ foo: 'bar' }])
    jest.spyOn(processor, 'processSelect').mockImplementation((query: Builder, results: unknown[]) => {
      return results
    })
    const results = await builder.from('users').where('id', '=', 1).value('foo')
    expect(results).toBe('bar')
  })

  test('testRawValueMethodReturnsSingleColumn', async () => {
    const builder = getBuilder()
    const connection = builder.getConnection()
    const processor = builder.getProcessor()

    jest.spyOn(connection, 'select').mockResolvedValue([{ 'UPPER("foo")': 'BAR' }])
    jest.spyOn(processor, 'processSelect').mockImplementation((query: Builder, results: unknown[]) => {
      return results
    })
    const results = await builder.from('users').where('id', '=', 1).rawValue('UPPER("foo")')
    expect(results).toBe('BAR')
  })

  test('testAggregateFunctions', async () => {
    let builder = getBuilder()
    let connection = builder.getConnection()
    let processor = builder.getProcessor()

    jest.spyOn(connection, 'select').mockResolvedValue([{ aggregate: 1 }])
    jest.spyOn(processor, 'processSelect').mockImplementation((query: Builder, results: unknown[]) => {
      return results
    })
    let results = await builder.from('users').count()
    expect(connection.select).toHaveBeenCalledWith('select count(*) as "aggregate" from "users"', [])
    expect(results).toBe(1)

    builder = getBuilder()
    connection = builder.getConnection()
    processor = builder.getProcessor()
    jest.spyOn(connection, 'select').mockResolvedValue([{ exists: 1 }])
    jest.spyOn(processor, 'processSelect').mockImplementation((query: Builder, results: unknown[]) => {
      return results
    })
    results = await builder.from('users').exists()
    expect(connection.select).toHaveBeenCalledWith('select exists(select * from "users") as "exists"', [])
    expect(results).toBe(true)

    builder = getBuilder()
    connection = builder.getConnection()
    processor = builder.getProcessor()
    jest.spyOn(connection, 'select').mockResolvedValue([{ exists: 0 }])
    jest.spyOn(processor, 'processSelect').mockImplementation((query: Builder, results: unknown[]) => {
      return results
    })
    results = await builder.from('users').doesntExist()
    expect(connection.select).toHaveBeenCalledWith('select exists(select * from "users") as "exists"', [])
    expect(results).toBe(true)

    builder = getBuilder()
    connection = builder.getConnection()
    processor = builder.getProcessor()
    jest.spyOn(connection, 'select').mockResolvedValue([{ aggregate: 1 }])
    jest.spyOn(processor, 'processSelect').mockImplementation((query: Builder, results: unknown[]) => {
      return results
    })
    results = await builder.from('users').max('id')
    expect(connection.select).toHaveBeenCalledWith('select max("id") as "aggregate" from "users"', [])
    expect(results).toBe(1)

    builder = getBuilder()
    connection = builder.getConnection()
    processor = builder.getProcessor()
    jest.spyOn(connection, 'select').mockResolvedValue([{ aggregate: 1 }])
    jest.spyOn(processor, 'processSelect').mockImplementation((query: Builder, results: unknown[]) => {
      return results
    })
    results = await builder.from('users').min('id')
    expect(connection.select).toHaveBeenCalledWith('select min("id") as "aggregate" from "users"', [])
    expect(results).toBe(1)

    builder = getBuilder()
    connection = builder.getConnection()
    processor = builder.getProcessor()
    jest.spyOn(connection, 'select').mockResolvedValue([{ aggregate: 1 }])
    jest.spyOn(processor, 'processSelect').mockImplementation((query: Builder, results: unknown[]) => {
      return results
    })
    results = await builder.from('users').sum('id')
    expect(connection.select).toHaveBeenCalledWith('select sum("id") as "aggregate" from "users"', [])
    expect(results).toBe(1)

    builder = getBuilder()
    connection = builder.getConnection()
    processor = builder.getProcessor()
    jest.spyOn(connection, 'select').mockResolvedValue([{ aggregate: 1 }])
    jest.spyOn(processor, 'processSelect').mockImplementation((query: Builder, results: unknown[]) => {
      return results
    })
    results = await builder.from('users').avg('id')
    expect(connection.select).toHaveBeenCalledWith('select avg("id") as "aggregate" from "users"', [])
    expect(results).toBe(1)

    builder = getBuilder()
    connection = builder.getConnection()
    processor = builder.getProcessor()
    jest.spyOn(connection, 'select').mockResolvedValue([{ aggregate: 1 }])
    jest.spyOn(processor, 'processSelect').mockImplementation((query: Builder, results: unknown[]) => {
      return results
    })
    results = await builder.from('users').average('id')
    expect(connection.select).toHaveBeenCalledWith('select avg("id") as "aggregate" from "users"', [])
    expect(results).toBe(1)
  })

  test('testSqlServerExists', async () => {
    const builder = getSqlServerBuilder()
    const connection = builder.getConnection()
    jest.spyOn(connection, 'select').mockResolvedValue([{ exists: 1 }])
    const results = await builder.from('users').exists()
    expect(connection.select).toHaveBeenCalledWith('select top 1 1 [exists] from [users]', [])
    expect(results).toBe(true)
  })

  test('testExistsOr', async () => {
    let builder = getBuilder()
    let connection = builder.getConnection()
    jest.spyOn(connection, 'select').mockResolvedValue([{ exists: 1 }])
    let results = await builder.from('users').doesntExistOr(() => {
      return 123
    })
    expect(results).toBe(123)

    builder = getBuilder()
    connection = builder.getConnection()
    jest.spyOn(connection, 'select').mockResolvedValue([{ exists: 0 }])
    results = await builder.from('users').doesntExistOr(() => {
      throw new Error()
    })
    expect(results).toBe(true)
  })

  test('testDoesntExistsOr', async () => {
    let builder = getBuilder()
    let connection = builder.getConnection()
    jest.spyOn(connection, 'select').mockResolvedValue([{ exists: 0 }])
    let results = await builder.from('users').existsOr(() => {
      return 123
    })
    expect(results).toBe(123)

    builder = getBuilder()
    connection = builder.getConnection()
    jest.spyOn(connection, 'select').mockResolvedValue([{ exists: 1 }])
    results = await builder.from('users').existsOr(() => {
      expect(results).toBe(true)
    })
  })

  test('testAggregateResetFollowedByGet', async () => {
    const builder = getBuilder()
    const connection = builder.getConnection()
    jest.spyOn(connection, 'select')
      .mockResolvedValueOnce([{ aggregate: 1 }])
      .mockResolvedValueOnce([{ aggregate: 2 }])
      .mockResolvedValueOnce([{ column1: 'foo', column2: 'bar' }])
    jest.spyOn(builder.getProcessor(), 'processSelect').mockImplementation((query: Builder, results: unknown[]) => {
      return results
    })
    const count = await builder.from('users').count()
    expect(count).toBe(1)

    const sum = await builder.from('users').sum('id')
    expect(sum).toBe(2)
    const result = await builder.from('users').get()
    expect(result.all()).toEqual([{ column1: 'foo', column2: 'bar' }])
  })

  test('testAggregateResetFollowedBySelectGet', async () => {
    const builder = getBuilder()
    const connection = builder.getConnection()
    const processor = builder.getProcessor()
    jest.spyOn(connection, 'select')
      .mockResolvedValueOnce([{ aggregate: 1 }])
      .mockResolvedValueOnce([{ column2: 'foo', column3: 'bar' }])
    jest.spyOn(processor, 'processSelect').mockImplementation((query: Builder, results: unknown[]) => {
      return results
    })
    const count = await builder.from('users').count('column1')
    expect(count).toBe(1)
    const result = await builder.from('users').select('column2', 'column3').get()
    expect(result.all()).toEqual([{ column2: 'foo', column3: 'bar' }])
  })

  test('testAggregateResetFollowedByGetWithColumns', async () => {
    const builder = getBuilder()
    const connection = builder.getConnection()
    const processor = builder.getProcessor()
    jest.spyOn(connection, 'select')
      .mockResolvedValueOnce([{ aggregate: 1 }])
      .mockResolvedValueOnce([{ column2: 'foo', column3: 'bar' }])
    jest.spyOn(processor, 'processSelect').mockImplementation((query: Builder, results: unknown[]) => {
      return results
    })
    const count = await builder.from('users').count('column1')
    expect(count).toBe(1)
    const result = await builder.from('users').get(['column2', 'column3'])
    expect(result.all()).toEqual([{ column2: 'foo', column3: 'bar' }])
  })

  test('testAggregateWithSubSelect', async () => {
    const builder = getBuilder()
    const connection = builder.getConnection()
    const processor = builder.getProcessor()
    jest.spyOn(connection, 'select').mockResolvedValue([{ aggregate: 1 }])
    jest.spyOn(processor, 'processSelect').mockImplementation((query: Builder, results: unknown[]) => {
      return results
    })
    jest.spyOn(connection, 'select').mockResolvedValue([{ aggregate: 1 }])
    jest.spyOn(processor, 'processSelect').mockImplementation((query: Builder, results: unknown[]) => {
      return results
    })
    builder.from('users').selectSub((query: Builder) => {
      query.from('posts').select('foo', 'bar').where('title', 'foo')
    }, 'post')
    const count = await builder.count()
    expect(count).toBe(1)
    expect(builder.getGrammar().getValue(builder.columns[0])).toBe('(select "foo", "bar" from "posts" where "title" = ?) as "post"')
    expect(builder.getBindings()).toEqual(['foo'])
    expect(connection.select).toHaveBeenCalledWith('select count(*) as "aggregate" from "users"', [])
  })

  test('testSubqueriesBindings', async () => {
    let builder = getBuilder()
    const second = getBuilder().select('*').from('users').orderByRaw('id = ?', 2)
    const third = getBuilder().select('*').from('users').where('id', 3).groupBy('id').having('id', '!=', 4)
    builder.groupBy('a').having('a', '=', 1).union(second).union(third)
    expect(builder.getBindings()).toEqual([1, 2, 3, 4])

    builder = getBuilder().select('*').from('users').where('email', '=', (q: Builder) => {
      q.select(new Raw('max(id)'))
        .from('users')
        .where('email', '=', 'bar')
        .orderByRaw('email like ?', '%.com')
        .groupBy('id')
        .having('id', '=', 4)
    }).orWhere('id', '=', 'foo').groupBy('id').having('id', '=', 5)
    expect(builder.getBindings()).toEqual(['bar', 4, '%.com', 'foo', 5])
  })

  test('testInsertMethod', async () => {
    const builder = getBuilder()
    const connection = builder.getConnection()
    jest.spyOn(connection, 'insert').mockResolvedValue(true)

    const result = await builder.from('users').insert({ email: 'foo' })
    expect(connection.insert).toHaveBeenCalledWith('insert into "users" ("email") values (?)', ['foo'])
    expect(result).toBe(true)
  })

  test('testInsertUsingMethod', async () => {
    const builder = getBuilder()
    const connection = builder.getConnection()
    jest.spyOn(connection, 'affectingStatement').mockResolvedValue(1)
    const result = await builder.from('table1').insertUsing(['foo'], (query: Builder) => {
      query.select(['bar']).from('table2').where('foreign_id', '=', 5)
    })
    expect(result).toBe(1)
    expect(connection.affectingStatement).toHaveBeenCalledWith('insert into "table1" ("foo") select "bar" from "table2" where "foreign_id" = ?', [5])
  })

  test('testInsertUsingWithEmptyColumns', async () => {
    const builder = getBuilder()
    const connection = builder.getConnection()
    jest.spyOn(connection, 'affectingStatement').mockResolvedValue(1)
    const result = await builder.from('table1').insertUsing([], (query: Builder) => {
      query.from('table2').where('foreign_id', '=', 5)
    })
    expect(result).toBe(1)
    expect(connection.affectingStatement).toHaveBeenCalledWith('insert into "table1" select * from "table2" where "foreign_id" = ?', [5])
  })

  test('testInsertUsingInvalidSubquery', async () => {
    const builder = getBuilder()
    expect(() => {
      builder.from('table1').insertUsing(['foo'], ['bar'])
    }).toThrow(Error)
  })

  test('testInsertOrIgnoreMethod', async () => {
    const builder = getBuilder()
    expect(() => {
      builder.from('users').insertOrIgnore({ email: 'foo' })
    }).toThrow(new Error('RuntimeException: This database engine does not support inserting while ignoring errors.'))
  })

  test('testMySqlInsertOrIgnoreMethod', async () => {
    const builder = getMySqlBuilder()
    const connection = builder.getConnection()
    jest.spyOn(connection, 'affectingStatement').mockResolvedValue(1)
    const result = await builder.from('users').insertOrIgnore({ email: 'foo' })
    expect(result).toBe(1)
    expect(connection.affectingStatement).toHaveBeenCalledWith('insert ignore into `users` (`email`) values (?)', ['foo'])
  })

  test('testPostgresInsertOrIgnoreMethod', async () => {
    const builder = getPostgresBuilder()
    const connection = builder.getConnection()
    jest.spyOn(connection, 'affectingStatement').mockResolvedValue(1)

    const result = await builder.from('users').insertOrIgnore({ email: 'foo' })
    expect(result).toBe(1)
    expect(connection.affectingStatement).toHaveBeenCalledWith('insert into "users" ("email") values (?) on conflict do nothing', ['foo'])
  })

  test('testSQLiteInsertOrIgnoreMethod', async () => {
    const builder = getSQLiteBuilder()
    const connection = builder.getConnection()
    jest.spyOn(connection, 'affectingStatement').mockResolvedValue(1)
    const result = await builder.from('users').insertOrIgnore({ email: 'foo' })
    expect(result).toBe(1)
    expect(connection.affectingStatement).toHaveBeenCalledWith('insert or ignore into "users" ("email") values (?)', ['foo'])
  })

  test('testSqlServerInsertOrIgnoreMethod', async () => {
    const builder = getSqlServerBuilder()
    expect(() => {
      builder.from('users').insertOrIgnore({ email: 'foo' })
    }).toThrow(new Error('RuntimeException: This database engine does not support inserting while ignoring errors.'))
  })

  test('testInsertOrIgnoreReturningMethod', async () => {
    const builder = getBuilder()
    await expect(
      builder.from('users').insertOrIgnoreReturning({ email: 'foo' })
    ).rejects.toThrow(new Error('RuntimeException: This database engine does not support insert or ignore with returning.'))
  })

  test('testInsertOrIgnoreReturningMethodWithEmptyValues', async () => {
    const builder = getPostgresBuilder()
    const result = await builder.from('users').insertOrIgnoreReturning([])
    expect(result).toBeInstanceOf(Collection)
    expect(result.isEmpty()).toBe(true)
  })

  test('testMySqlInsertOrIgnoreReturningMethod', async () => {
    const builder = getMySqlBuilder()
    await expect(
      builder.from('users').insertOrIgnoreReturning({ email: 'foo' })
    ).rejects.toThrow(new Error('RuntimeException: This database engine does not support insert or ignore with returning.'))
  })

  test('testPostgresInsertOrIgnoreReturningMethod', async () => {
    const builder = getPostgresBuilder()
    const connection = builder.getConnection()
    jest.spyOn(connection, 'recordsHaveBeenModified').mockResolvedValue(true)
    jest.spyOn(connection, 'selectFromWriteConnection').mockResolvedValue([{ id: 1 }])
    const result = await builder.from('users').insertOrIgnoreReturning({ email: 'foo' }, ['id'])
    expect(result).toBeInstanceOf(Collection)
    expect(result.all()).toEqual([{ id: 1 }])
    expect(connection.selectFromWriteConnection).toHaveBeenCalledWith('insert into "users" ("email") values (?) on conflict do nothing returning "id"', ['foo'])
  })

  test('testPostgresInsertOrIgnoreReturningMethodWithUniqueByColumn', async () => {
    const builder = getPostgresBuilder()
    const connection = builder.getConnection()
    jest.spyOn(connection, 'recordsHaveBeenModified').mockResolvedValue(true)
    jest.spyOn(connection, 'selectFromWriteConnection').mockResolvedValue([{ id: 1, email: 'foo', name: 'bar' }])
    const result = await builder.from('users').insertOrIgnoreReturning({ email: 'foo', name: 'bar' }, ['*'], 'email')
    expect(result).toBeInstanceOf(Collection)
    expect(result.all()).toEqual([{ id: 1, email: 'foo', name: 'bar' }])
    expect(connection.selectFromWriteConnection).toHaveBeenCalledWith('insert into "users" ("email", "name") values (?, ?) on conflict ("email") do nothing returning *', ['foo', 'bar'])
  })

  test('testPostgresInsertOrIgnoreReturningMethodWithMultipleRecords', async () => {
    const builder = getPostgresBuilder()
    const connection = builder.getConnection()
    jest.spyOn(connection, 'recordsHaveBeenModified').mockResolvedValue(true)
    jest.spyOn(connection, 'selectFromWriteConnection').mockResolvedValue([{ id: 1, email: 'foo' }])

    const result = await builder.from('users').insertOrIgnoreReturning([{ email: 'foo' }, { email: 'bar' }], ['id', 'email'])

    expect(result).toBeInstanceOf(Collection)
    expect(result.all()).toEqual([{ id: 1, email: 'foo' }])
    expect(connection.selectFromWriteConnection).toHaveBeenCalledWith('insert into "users" ("email") values (?), (?) on conflict do nothing returning "id", "email"', ['foo', 'bar'])
  })

  test('testSqliteInsertOrIgnoreReturningMethod', async () => {
    const builder = getSQLiteBuilder()
    const connection = builder.getConnection()
    jest.spyOn(connection, 'recordsHaveBeenModified').mockResolvedValue(true)
    jest.spyOn(connection, 'selectFromWriteConnection').mockResolvedValue([{ id: 1 }])

    const result = await builder.from('users').insertOrIgnoreReturning({ email: 'foo' }, ['id'])

    expect(result).toBeInstanceOf(Collection)
    expect(result.all()).toEqual([{ id: 1 }])
    expect(connection.selectFromWriteConnection).toHaveBeenCalledWith('insert into "users" ("email") values (?) on conflict do nothing returning "id"', ['foo'])
  })

  test('testSqliteInsertOrIgnoreReturningMethodWithUniqueByColumn', async () => {
    const builder = getSQLiteBuilder()
    const connection = builder.getConnection()
    jest.spyOn(connection, 'recordsHaveBeenModified').mockResolvedValue(true)
    jest.spyOn(connection, 'selectFromWriteConnection').mockResolvedValue([{ id: 1, email: 'foo', name: 'bar' }])

    const result = await builder.from('users').insertOrIgnoreReturning({ email: 'foo', name: 'bar' }, ['*'], 'email')

    expect(result).toBeInstanceOf(Collection)
    expect(result.all()).toEqual([{ id: 1, email: 'foo', name: 'bar' }])
    expect(connection.selectFromWriteConnection).toHaveBeenCalledWith('insert into "users" ("email", "name") values (?, ?) on conflict ("email") do nothing returning *', ['foo', 'bar'])
  })

  test('testSqliteInsertOrIgnoreReturningMethodWithUniqueByColumns', async () => {
    const builder = getSQLiteBuilder()
    const connection = builder.getConnection()
    jest.spyOn(connection, 'recordsHaveBeenModified').mockResolvedValue(true)
    jest.spyOn(connection, 'selectFromWriteConnection').mockResolvedValue([{ id: 1, email: 'foo', name: 'bar' }])
    const result = await builder.from('users').insertOrIgnoreReturning({ email: 'foo', name: 'bar' }, ['*'], ['email', 'name'])
    expect(result).toBeInstanceOf(Collection)
    expect(result.all()).toEqual([{ id: 1, email: 'foo', name: 'bar' }])
    expect(connection.selectFromWriteConnection).toHaveBeenCalledWith('insert into "users" ("email", "name") values (?, ?) on conflict ("email", "name") do nothing returning *', ['foo', 'bar'])
  })

  test('testSqliteInsertOrIgnoreReturningMethodWithMultipleRecords', async () => {
    const builder = getSQLiteBuilder()
    const connection = builder.getConnection()
    jest.spyOn(connection, 'recordsHaveBeenModified').mockResolvedValue(true)
    jest.spyOn(connection, 'selectFromWriteConnection').mockResolvedValue([{ id: 1, email: 'foo' }])

    const result = await builder.from('users').insertOrIgnoreReturning([{ email: 'foo' }, { email: 'bar' }], ['id', 'email'])

    expect(result).toBeInstanceOf(Collection)
    expect(result.all()).toEqual([{ id: 1, email: 'foo' }])
    expect(connection.selectFromWriteConnection).toHaveBeenCalledWith('insert into "users" ("email") values (?), (?) on conflict do nothing returning "id", "email"', ['foo', 'bar'])
  })

  test('testSqlServerInsertOrIgnoreReturningMethod', async () => {
    const builder = getSqlServerBuilder()

    await expect(
      builder.from('users').insertOrIgnoreReturning({ email: 'foo' })
    ).rejects.toThrow(new Error('RuntimeException: This database engine does not support insert or ignore with returning.'))
  })

  test('testInsertOrIgnoreReturningWithEmptyUniqueByArray', async () => {
    const builder = getPostgresBuilder()

    await expect(
      builder.from('users').insertOrIgnoreReturning({ email: 'foo' }, ['*'], [])
    ).rejects.toThrow(new Error('InvalidArgumentException: The unique columns must not be empty.'))
  })

  test('testInsertOrIgnoreReturningWithEmptyUniqueByString', async () => {
    const builder = getPostgresBuilder()

    await expect(
      builder.from('users').insertOrIgnoreReturning({ email: 'foo' }, ['*'], '')
    ).rejects.toThrow(new Error('InvalidArgumentException: The unique columns must not be empty.'))
  })

  test('testInsertOrIgnoreReturningWithEmptyReturning', async () => {
    const builder = getPostgresBuilder()

    await expect(
      builder.from('users').insertOrIgnoreReturning({ email: 'foo' }, [])
    ).rejects.toThrow(new Error('InvalidArgumentException: The returning columns must not be empty.'))
  })

  test('testInsertOrIgnoreReturningDoesNotMarkRecordsModifiedWhenNoRowsWereInserted', async () => {
    const builder = getPostgresBuilder()
    const connection = builder.getConnection()
    jest.spyOn(connection, 'selectFromWriteConnection').mockResolvedValue([])
    jest.spyOn(connection, 'recordsHaveBeenModified').mockResolvedValue(false)

    const result = await builder.from('users').insertOrIgnoreReturning({ email: 'foo' })

    expect(connection.selectFromWriteConnection).toHaveBeenCalledWith('insert into "users" ("email") values (?) on conflict do nothing returning *', ['foo'])
    expect(result).toBeInstanceOf(Collection)
    expect(result.isEmpty()).toBe(true)
  })

  test('testInsertOrIgnoreUsingMethod', async () => {
    const builder = getBuilder()

    expect(() => {
      builder.from('users').insertOrIgnoreUsing({ email: 'foo' }, 'bar')
    }).toThrow(new Error('RuntimeException: This database engine does not support inserting while ignoring errors.'))
  })

  test('testSqlServerInsertOrIgnoreUsingMethod', async () => {
    const builder = getSqlServerBuilder()
    expect(() => {
      builder.from('users').insertOrIgnoreUsing({ email: 'foo' }, 'bar')
    }).toThrow(new Error('RuntimeException: This database engine does not support inserting while ignoring errors.'))
  })

  test('testMySqlInsertOrIgnoreUsingMethod', async () => {
    const builder = getMySqlBuilder()
    const connection = builder.getConnection()
    jest.spyOn(connection, 'affectingStatement').mockResolvedValue(1)

    const result = await builder.from('table1').insertOrIgnoreUsing(
      ['foo'],
      (query: Builder) => {
        query.select(['bar']).from('table2').where('foreign_id', '=', 5)
      }
    )

    expect(result).toBe(1)
    expect(connection.affectingStatement).toHaveBeenCalledWith('insert ignore into `table1` (`foo`) select `bar` from `table2` where `foreign_id` = ?', [5])
  })

  test('testMySqlInsertOrIgnoreUsingWithEmptyColumns', async () => {
    const builder = getMySqlBuilder()
    const connection = builder.getConnection()
    jest.spyOn(connection, 'affectingStatement').mockResolvedValue(1)

    const result = await builder.from('table1').insertOrIgnoreUsing([], (query: Builder) => {
      query.from('table2').where('foreign_id', '=', 5)
    })

    expect(result).toBe(1)
    expect(connection.affectingStatement).toHaveBeenCalledWith('insert ignore into `table1` select * from `table2` where `foreign_id` = ?', [5])
  })

  test('testMySqlInsertOrIgnoreUsingInvalidSubquery', async () => {
    const builder = getMySqlBuilder()

    expect(() => {
      builder.from('table1').insertOrIgnoreUsing(['foo'], ['bar'])
    }).toThrow(new Error('InvalidArgumentException: A subquery must be a query builder instance, a Closure, or a string.'))
  })

  test('testPostgresInsertOrIgnoreUsingMethod', async () => {
    const builder = getPostgresBuilder()
    const connection = builder.getConnection()
    jest.spyOn(connection, 'affectingStatement').mockResolvedValue(1)

    const result = await builder.from('table1').insertOrIgnoreUsing(
      ['foo'],
      (query: Builder) => {
        query.select(['bar']).from('table2').where('foreign_id', '=', 5)
      }
    )

    expect(result).toBe(1)
    expect(connection.affectingStatement).toHaveBeenCalledWith('insert into "table1" ("foo") select "bar" from "table2" where "foreign_id" = ? on conflict do nothing', [5])
  })

  test('testPostgresInsertOrIgnoreUsingWithEmptyColumns', async () => {
    const builder = getPostgresBuilder()
    const connection = builder.getConnection()
    jest.spyOn(connection, 'affectingStatement').mockResolvedValue(1)

    const result = await builder.from('table1').insertOrIgnoreUsing([], (query: Builder) => {
      query.from('table2').where('foreign_id', '=', 5)
    })

    expect(result).toBe(1)
    expect(connection.affectingStatement).toHaveBeenCalledWith('insert into "table1" select * from "table2" where "foreign_id" = ? on conflict do nothing', [5])
  })

  test('testPostgresInsertOrIgnoreUsingInvalidSubquery', async () => {
    const builder = getPostgresBuilder()

    expect(() => {
      builder.from('table1').insertOrIgnoreUsing(['foo'], ['bar'])
    }).toThrow(new Error('InvalidArgumentException: A subquery must be a query builder instance, a Closure, or a string.'))
  })

  test('testSQLiteInsertOrIgnoreUsingMethod', async () => {
    const builder = getSQLiteBuilder()
    const connection = builder.getConnection()
    jest.spyOn(connection, 'affectingStatement').mockResolvedValue(1)

    const result = await builder.from('table1').insertOrIgnoreUsing(['foo'], (query: Builder) => {
      query.select(['bar']).from('table2').where('foreign_id', '=', 5)
    })

    expect(result).toBe(1)
    expect(connection.affectingStatement).toHaveBeenCalledWith('insert or ignore into "table1" ("foo") select "bar" from "table2" where "foreign_id" = ?', [5])
  })

  test('testSQLiteInsertOrIgnoreUsingWithEmptyColumns', async () => {
    const builder = getSQLiteBuilder()
    const connection = builder.getConnection()
    jest.spyOn(connection, 'affectingStatement').mockResolvedValue(1)

    const result = await builder.from('table1').insertOrIgnoreUsing([], (query: Builder) => {
      query.from('table2').where('foreign_id', '=', 5)
    })

    expect(result).toBe(1)
    expect(connection.affectingStatement).toHaveBeenCalledWith('insert or ignore into "table1" select * from "table2" where "foreign_id" = ?', [5])
  })

  test('testSQLiteInsertOrIgnoreUsingInvalidSubquery', async () => {
    const builder = getSQLiteBuilder()

    expect(() => {
      builder.from('table1').insertOrIgnoreUsing(['foo'], ['bar'])
    }).toThrow(new Error('InvalidArgumentException: A subquery must be a query builder instance, a Closure, or a string.'))
  })

  test('testInsertGetIdMethod', async () => {
    const builder = getBuilder()
    const processor = builder.getProcessor()
    jest.spyOn(processor, 'processInsertGetId').mockResolvedValue(1)
    const result = await builder.from('users').insertGetId({ email: 'foo' }, 'id')
    expect(processor.processInsertGetId).toHaveBeenCalledWith(builder, 'insert into "users" ("email") values (?)', ['foo'], 'id')
    expect(result).toBe(1)
  })

  test('testInsertGetIdMethodRemovesExpressions', async () => {
    const builder = getBuilder()
    const processor = builder.getProcessor()
    jest.spyOn(processor, 'processInsertGetId').mockResolvedValue(1)
    const result = await builder.from('users').insertGetId({ email: 'foo', bar: new Raw('bar') }, 'id')
    expect(processor.processInsertGetId).toHaveBeenCalledWith(builder, 'insert into "users" ("email", "bar") values (?, bar)', ['foo'], 'id')
    expect(result).toBe(1)
  })

  test('testInsertGetIdWithEmptyValues', async () => {
    let builder = getMySqlBuilder()
    let processor = builder.getProcessor()
    jest.spyOn(processor, 'processInsertGetId').mockResolvedValue(1)

    let result = await builder.from('users').insertGetId([])
    expect(processor.processInsertGetId).toHaveBeenCalledWith(builder, 'insert into `users` () values ()', [], undefined)
    expect(result).toBe(1)

    builder = getPostgresBuilder()
    processor = builder.getProcessor()
    jest.spyOn(processor, 'processInsertGetId').mockResolvedValue(1)

    result = await builder.from('users').insertGetId([])
    expect(processor.processInsertGetId).toHaveBeenCalledWith(builder, 'insert into "users" default values returning "id"', [], undefined)
    expect(result).toBe(1)

    builder = getSQLiteBuilder()
    processor = builder.getProcessor()
    jest.spyOn(processor, 'processInsertGetId').mockResolvedValue(1)

    result = await builder.from('users').insertGetId([])
    expect(processor.processInsertGetId).toHaveBeenCalledWith(builder, 'insert into "users" default values', [], undefined)
    expect(result).toBe(1)

    builder = getSqlServerBuilder()
    processor = builder.getProcessor()
    jest.spyOn(processor, 'processInsertGetId').mockResolvedValue(1)

    result = await builder.from('users').insertGetId([])
    expect(processor.processInsertGetId).toHaveBeenCalledWith(builder, 'insert into [users] default values', [], undefined)
    expect(result).toBe(1)
  })

  test('testInsertMethodRespectsRawBindings', async () => {
    const builder = getBuilder()
    const connection = builder.getConnection()
    jest.spyOn(connection, 'insert').mockResolvedValue(true)

    const result = await builder.from('users').insert({ email: new Raw('CURRENT TIMESTAMP') })
    expect(connection.insert).toHaveBeenCalledWith('insert into "users" ("email") values (CURRENT TIMESTAMP)', [])
    expect(result).toBe(true)
  })

  test('testMultipleInsertsWithExpressionValues', async () => {
    const builder = getBuilder()
    const connection = builder.getConnection()
    jest.spyOn(connection, 'insert').mockResolvedValue(true)

    const result = await builder.from('users').insert([{ email: new Raw("UPPER('Foo')") }, { email: new Raw("LOWER('Foo')") }])
    expect(connection.insert).toHaveBeenCalledWith('insert into "users" ("email") values (UPPER(\'Foo\')), (LOWER(\'Foo\'))', [])
    expect(result).toBe(true)
  })

  test('testUpdateMethod', async () => {
    let builder = getBuilder()
    let connection = builder.getConnection()
    jest.spyOn(connection, 'update').mockResolvedValue(1)

    let result = await builder.from('users').where('id', '=', 1).update({ email: 'foo', name: 'bar' })
    expect(connection.update).toHaveBeenCalledWith('update "users" set "email" = ?, "name" = ? where "id" = ?', ['foo', 'bar', 1])
    expect(result).toBe(1)

    builder = getMySqlBuilder()
    connection = builder.getConnection()
    jest.spyOn(connection, 'update').mockResolvedValue(1)

    result = await builder.from('users').where('id', '=', 1).orderBy('foo', 'desc').limit(5).update({ email: 'foo', name: 'bar' })
    expect(connection.update).toHaveBeenCalledWith('update `users` set `email` = ?, `name` = ? where `id` = ? order by `foo` desc limit 5', ['foo', 'bar', 1])
    expect(result).toBe(1)

    builder = getSqlServerBuilder()
    connection = builder.getConnection()
    jest.spyOn(connection, 'update').mockResolvedValue(1)

    result = await builder.from('users').where('id', '=', 1).update({ email: 'foo', name: 'bar' })
    expect(connection.update).toHaveBeenCalledWith('update [users] set [email] = ?, [name] = ? where [id] = ?', ['foo', 'bar', 1])
    expect(result).toBe(1)

    builder = getSqlServerBuilder()
    connection = builder.getConnection()
    jest.spyOn(connection, 'update').mockResolvedValue(1)

    result = await builder.from('users').where('id', '=', 1).limit(5).update({ email: 'foo', name: 'bar' })
    expect(connection.update).toHaveBeenCalledWith('update top (5) [users] set [email] = ?, [name] = ? where [id] = ?', ['foo', 'bar', 1])
    expect(result).toBe(1)

    builder = getSqlServerBuilder()
    connection = builder.getConnection()
    jest.spyOn(connection, 'update').mockResolvedValue(1)

    result = await builder.from('users').where('id', '=', 1).limit(5).offset(5).update({ email: 'foo', name: 'bar' })
    expect(connection.update).toHaveBeenCalledWith('update [users] set [email] = ?, [name] = ? where [id] = ?', ['foo', 'bar', 1])
    expect(result).toBe(1)
  })

  test('testUpsertMethod', async () => {
    let builder = getMySqlBuilder()
    let connection = builder.getConnection()
    jest.spyOn(connection, 'affectingStatement').mockResolvedValue(2)

    let result = await builder.from('users').upsert([{ email: 'foo', name: 'bar' }, { name: 'bar2', email: 'foo2' }], 'email')
    expect(connection.affectingStatement).toHaveBeenCalledWith('insert into `users` (`email`, `name`) values (?, ?), (?, ?) on duplicate key update `email` = values(`email`), `name` = values(`name`)', ['foo', 'bar', 'foo2', 'bar2'])
    expect(result).toBe(2)

    builder = getMySqlBuilder()
    connection = builder.getConnection()
    jest.spyOn(connection, 'affectingStatement').mockResolvedValue(2)

    result = await builder.from('users').upsert([{ email: 'foo', name: 'bar' }, { name: 'bar2', email: 'foo2' }], 'email')
    expect(connection.affectingStatement).toHaveBeenCalledWith('insert into `users` (`email`, `name`) values (?, ?), (?, ?) as laravel_upsert_alias on duplicate key update `email` = `laravel_upsert_alias`.`email`, `name` = `laravel_upsert_alias`.`name`', ['foo', 'bar', 'foo2', 'bar2'])
    expect(result).toBe(2)

    builder = getPostgresBuilder()
    connection = builder.getConnection()
    jest.spyOn(connection, 'affectingStatement').mockResolvedValue(2)

    result = await builder.from('users').upsert([{ email: 'foo', name: 'bar' }, { name: 'bar2', email: 'foo2' }], 'email')
    expect(connection.affectingStatement).toHaveBeenCalledWith('insert into "users" ("email", "name") values (?, ?), (?, ?) on conflict ("email") do update set "email" = "excluded"."email", "name" = "excluded"."name"', ['foo', 'bar', 'foo2', 'bar2'])
    expect(result).toBe(2)

    builder = getSQLiteBuilder()
    connection = builder.getConnection()
    jest.spyOn(connection, 'affectingStatement').mockResolvedValue(2)

    result = await builder.from('users').upsert([{ email: 'foo', name: 'bar' }, { name: 'bar2', email: 'foo2' }], 'email')
    expect(connection.affectingStatement).toHaveBeenCalledWith('insert into "users" ("email", "name") values (?, ?), (?, ?) on conflict ("email") do update set "email" = "excluded"."email", "name" = "excluded"."name"', ['foo', 'bar', 'foo2', 'bar2'])
    expect(result).toBe(2)

    builder = getSqlServerBuilder()
    connection = builder.getConnection()
    jest.spyOn(connection, 'affectingStatement').mockResolvedValue(2)

    result = await builder.from('users').upsert([{ email: 'foo', name: 'bar' }, { name: 'bar2', email: 'foo2' }], 'email')
    expect(connection.affectingStatement).toHaveBeenCalledWith('merge [users] using (values (?, ?), (?, ?)) [laravel_source] ([email], [name]) on [laravel_source].[email] = [users].[email] when matched then update set [email] = [laravel_source].[email], [name] = [laravel_source].[name] when not matched then insert ([email], [name]) values ([email], [name]);', ['foo', 'bar', 'foo2', 'bar2'])
    expect(result).toBe(2)
  })
})

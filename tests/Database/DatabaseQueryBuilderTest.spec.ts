import { describe, expect, jest, test } from '@jest/globals'

import type { Builder, JoinClause } from '../../src/Illuminate/Database/Query'

import { Collection } from '../../src/Illuminate/Collections'
import { collect } from '../../src/Illuminate/Collections/helpers'
import { Builder as EloquentBuilder } from '../../src/Illuminate/Database/Eloquent/Builder'
import { ConditionExpression } from '../../src/Illuminate/Database/Query/ConditionExpression'
import { Expression as Raw } from '../../src/Illuminate/Database/Query/Expression'
import {
  Cursor,
  CursorPaginator,
  LengthAwarePaginator,
  Paginator
} from '../../src/Illuminate/Pagination'
import { Carbon, DateInterval, DatePeriod, Str } from '../../src/Illuminate/Support'
import { Bar } from '../../tests/Database/Fixtures/Enums/Bar'
import { IntegerStatus, NonBackedStatus, StringStatus } from './Fixtures/Enums'
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
    builder.select('*').from('users').where('first_name', 'like', '%Alvaro%').orWhereAll(['last_name', 'email'], 'like', '%Otwell%')
    expect(builder.toSql()).toBe('select * from "users" where "first_name" like ? or ("last_name" like ? and "email" like ?)')
    expect(builder.getBindings()).toEqual(['%Alvaro%', '%Otwell%', '%Otwell%'])

    builder = getBuilder()
    builder.select('*').from('users').where('first_name', 'like', '%Alvaro%').whereAll(['last_name', 'email'], 'like', '%Otwell%', 'or')
    expect(builder.toSql()).toBe('select * from "users" where "first_name" like ? or ("last_name" like ? and "email" like ?)')
    expect(builder.getBindings()).toEqual(['%Alvaro%', '%Otwell%', '%Otwell%'])

    builder = getBuilder()
    builder.select('*').from('users').where('first_name', 'like', '%Alvaro%').orWhereAll(['last_name', 'email'], '%Otwell%')
    expect(builder.toSql()).toBe('select * from "users" where "first_name" like ? or ("last_name" = ? and "email" = ?)')
    expect(builder.getBindings()).toEqual(['%Alvaro%', '%Otwell%', '%Otwell%'])

    builder = getBuilder()
    builder.select('*').from('users').where('first_name', 'like', '%Alvaro%').orWhereAll([
      (query: Builder) => query.where('last_name', 'like', '%Otwell%'),
      (query: Builder) => query.where('email', 'like', '%Otwell%')
    ])
    expect(builder.toSql()).toBe('select * from "users" where "first_name" like ? or (("last_name" like ?) and ("email" like ?))')
    expect(builder.getBindings()).toEqual(['%Alvaro%', '%Otwell%', '%Otwell%'])
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
    builder.select('*').from('users').where('first_name', 'like', '%Alvaro%').orWhereAny(['last_name', 'email'], 'like', '%Otwell%')
    expect(builder.toSql()).toBe('select * from "users" where "first_name" like ? or ("last_name" like ? or "email" like ?)')
    expect(builder.getBindings()).toEqual(['%Alvaro%', '%Otwell%', '%Otwell%'])

    builder = getBuilder()
    builder.select('*').from('users').where('first_name', 'like', '%Alvaro%').whereAny(['last_name', 'email'], 'like', '%Otwell%', 'or')
    expect(builder.toSql()).toBe('select * from "users" where "first_name" like ? or ("last_name" like ? or "email" like ?)')
    expect(builder.getBindings()).toEqual(['%Alvaro%', '%Otwell%', '%Otwell%'])

    builder = getBuilder()
    builder.select('*').from('users').where('first_name', 'like', '%Alvaro%').orWhereAny(['last_name', 'email'], '%Otwell%')
    expect(builder.toSql()).toBe('select * from "users" where "first_name" like ? or ("last_name" = ? or "email" = ?)')
    expect(builder.getBindings()).toEqual(['%Alvaro%', '%Otwell%', '%Otwell%'])

    builder = getBuilder()
    builder.select('*').from('users').where('first_name', 'like', '%Alvaro%').orWhereAny([
      (query: Builder) => query.where('last_name', 'like', '%Otwell%'),
      (query: Builder) => query.where('email', 'like', '%Otwell%')
    ])
    expect(builder.toSql()).toBe('select * from "users" where "first_name" like ? or (("last_name" like ?) or ("email" like ?))')
    expect(builder.getBindings()).toEqual(['%Alvaro%', '%Otwell%', '%Otwell%'])
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
    builder.select('*').from('users').where('first_name', 'like', '%Alvaro%').whereNone(['last_name', 'email'], 'like', '%Otwell%')
    expect(builder.toSql()).toBe('select * from "users" where "first_name" like ? and not ("last_name" like ? or "email" like ?)', builder.toSql())
    expect(builder.getBindings()).toEqual(['%Alvaro%', '%Otwell%', '%Otwell%'])

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
    builder.select('*').from('users').where('first_name', 'like', '%Alvaro%').orWhereNone(['last_name', 'email'], 'like', '%Otwell%')
    expect(builder.toSql()).toBe('select * from "users" where "first_name" like ? or not ("last_name" like ? or "email" like ?)')
    expect(builder.getBindings()).toEqual(['%Alvaro%', '%Otwell%', '%Otwell%'])

    builder = getBuilder()
    builder.select('*').from('users').where('first_name', 'like', '%Alvaro%').whereNone(['last_name', 'email'], 'like', '%Otwell%', 'or')
    expect(builder.toSql()).toBe('select * from "users" where "first_name" like ? or not ("last_name" like ? or "email" like ?)')
    expect(builder.getBindings()).toEqual(['%Alvaro%', '%Otwell%', '%Otwell%'])

    builder = getBuilder()
    builder.select('*').from('users').where('first_name', 'like', '%Alvaro%').orWhereNone(['last_name', 'email'], '%Otwell%')
    expect(builder.toSql()).toBe('select * from "users" where "first_name" like ? or not ("last_name" = ? or "email" = ?)')
    expect(builder.getBindings()).toEqual(['%Alvaro%', '%Otwell%', '%Otwell%'])

    builder = getBuilder()
    builder.select('*').from('users').where('first_name', 'like', '%Alvaro%').orWhereNone([
      (query: Builder) => query.where('last_name', 'like', '%Otwell%'),
      (query: Builder) => query.where('email', 'like', '%Otwell%')
    ])
    expect(builder.toSql()).toBe('select * from "users" where "first_name" like ? or not (("last_name" like ?) or ("email" like ?))')
    expect(builder.getBindings()).toEqual(['%Alvaro%', '%Otwell%', '%Otwell%'])
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

    builder.select('*').from('users').having(new ConditionExpression('1 = 1'))

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
    jest.spyOn(connection, 'getConfig').mockReturnValue(false)

    let result = await builder.from('users').upsert([{ email: 'foo', name: 'bar' }, { name: 'bar2', email: 'foo2' }], 'email')
    expect(connection.affectingStatement).toHaveBeenCalledWith('insert into `users` (`email`, `name`) values (?, ?), (?, ?) on duplicate key update `email` = values(`email`), `name` = values(`name`)', ['foo', 'bar', 'foo2', 'bar2'])
    expect(connection.getConfig).toHaveBeenCalledWith('use_upsert_alias')
    expect(result).toBe(2)

    builder = getMySqlBuilder()
    connection = builder.getConnection()
    jest.spyOn(connection, 'affectingStatement').mockResolvedValue(2)
    jest.spyOn(connection, 'getConfig').mockReturnValue(true)

    result = await builder.from('users').upsert([{ email: 'foo', name: 'bar' }, { name: 'bar2', email: 'foo2' }], 'email')
    expect(connection.affectingStatement).toHaveBeenCalledWith('insert into `users` (`email`, `name`) values (?, ?), (?, ?) as lihtne_upsert_alias on duplicate key update `email` = `lihtne_upsert_alias`.`email`, `name` = `lihtne_upsert_alias`.`name`', ['foo', 'bar', 'foo2', 'bar2'])
    expect(connection.getConfig).toHaveBeenCalledWith('use_upsert_alias')
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
    expect(connection.affectingStatement).toHaveBeenCalledWith('merge [users] using (values (?, ?), (?, ?)) [lihtne_source] ([email], [name]) on [lihtne_source].[email] = [users].[email] when matched then update set [email] = [lihtne_source].[email], [name] = [lihtne_source].[name] when not matched then insert ([email], [name]) values ([email], [name]);', ['foo', 'bar', 'foo2', 'bar2'])
    expect(result).toBe(2)
  })

  test('testUpsertMethodWithUpdateColumns', async () => {
    let builder = getMySqlBuilder()
    let connection = builder.getConnection()
    jest.spyOn(connection, 'affectingStatement').mockResolvedValue(2)
    jest.spyOn(connection, 'getConfig').mockReturnValue(false)

    let result = await builder.from('users').upsert([{ email: 'foo', name: 'bar' }, { name: 'bar2', email: 'foo2' }], 'email', ['name'])
    expect(connection.affectingStatement).toHaveBeenCalledWith('insert into `users` (`email`, `name`) values (?, ?), (?, ?) on duplicate key update `name` = values(`name`)', ['foo', 'bar', 'foo2', 'bar2'])
    expect(connection.getConfig).toHaveBeenCalledWith('use_upsert_alias')
    expect(result).toBe(2)

    builder = getMySqlBuilder()
    connection = builder.getConnection()
    jest.spyOn(connection, 'affectingStatement').mockResolvedValue(2)
    jest.spyOn(connection, 'getConfig').mockReturnValue(true)

    result = await builder.from('users').upsert([{ email: 'foo', name: 'bar' }, { name: 'bar2', email: 'foo2' }], 'email', ['name'])
    expect(connection.affectingStatement).toHaveBeenCalledWith('insert into `users` (`email`, `name`) values (?, ?), (?, ?) as lihtne_upsert_alias on duplicate key update `name` = `lihtne_upsert_alias`.`name`', ['foo', 'bar', 'foo2', 'bar2'])
    expect(connection.getConfig).toHaveBeenCalledWith('use_upsert_alias')
    expect(result).toBe(2)

    builder = getPostgresBuilder()
    connection = builder.getConnection()
    jest.spyOn(connection, 'affectingStatement').mockResolvedValue(2)

    result = await builder.from('users').upsert([{ email: 'foo', name: 'bar' }, { name: 'bar2', email: 'foo2' }], 'email', ['name'])
    expect(connection.affectingStatement).toHaveBeenCalledWith('insert into "users" ("email", "name") values (?, ?), (?, ?) on conflict ("email") do update set "name" = "excluded"."name"', ['foo', 'bar', 'foo2', 'bar2'])
    expect(result).toBe(2)

    builder = getSQLiteBuilder()
    connection = builder.getConnection()
    jest.spyOn(connection, 'affectingStatement').mockResolvedValue(2)

    result = await builder.from('users').upsert([{ email: 'foo', name: 'bar' }, { name: 'bar2', email: 'foo2' }], 'email', ['name'])
    expect(connection.affectingStatement).toHaveBeenCalledWith('insert into "users" ("email", "name") values (?, ?), (?, ?) on conflict ("email") do update set "name" = "excluded"."name"', ['foo', 'bar', 'foo2', 'bar2'])
    expect(result).toBe(2)

    builder = getSqlServerBuilder()
    connection = builder.getConnection()
    jest.spyOn(connection, 'affectingStatement').mockResolvedValue(2)

    result = await builder.from('users').upsert([{ email: 'foo', name: 'bar' }, { name: 'bar2', email: 'foo2' }], 'email', ['name'])
    expect(connection.affectingStatement).toHaveBeenCalledWith('merge [users] using (values (?, ?), (?, ?)) [lihtne_source] ([email], [name]) on [lihtne_source].[email] = [users].[email] when matched then update set [name] = [lihtne_source].[name] when not matched then insert ([email], [name]) values ([email], [name]);', ['foo', 'bar', 'foo2', 'bar2'])
    expect(result).toBe(2)
  })

  test('testUpsertMethodWithEmptyUniqueByArray', async () => {
    await expect(async () => {
      await getPostgresBuilder().from('users').upsert([{ email: 'foo', name: 'bar' }], [])
    }).rejects.toThrow(new Error('InvalidArgumentException: The unique columns must not be empty.'))
  })

  test('testUpsertMethodWithEmptyUniqueByString', async () => {
    await expect(async () => {
      await getPostgresBuilder().from('users').upsert([{ email: 'foo', name: 'bar' }], '')
    }).rejects.toThrow(new Error('InvalidArgumentException: The unique columns must not be empty.'))
  })

  test('testUpdateMethodWithJoins', async () => {
    let builder = getBuilder()
    let connection = builder.getConnection()
    jest.spyOn(connection, 'update').mockResolvedValue(1)

    let result = await builder.from('users').join('orders', 'users.id', '=', 'orders.user_id').where('users.id', '=', 1).update({ email: 'foo', name: 'bar' })
    expect(connection.update).toHaveBeenCalledWith('update "users" inner join "orders" on "users"."id" = "orders"."user_id" set "email" = ?, "name" = ? where "users"."id" = ?', ['foo', 'bar', 1])
    expect(result).toBe(1)

    builder = getBuilder()
    connection = builder.getConnection()
    jest.spyOn(connection, 'update').mockResolvedValue(1)

    result = await builder.from('users').join('orders', (join: JoinClause) => {
      join.on('users.id', '=', 'orders.user_id')
        .where('users.id', '=', 1)
    }).update({ email: 'foo', name: 'bar' })
    expect(connection.update).toHaveBeenCalledWith('update "users" inner join "orders" on "users"."id" = "orders"."user_id" and "users"."id" = ? set "email" = ?, "name" = ?', [1, 'foo', 'bar'])
    expect(result).toBe(1)
  })

  test('testUpdateMethodWithJoinsOnSqlServer', async () => {
    let builder = getSqlServerBuilder()
    let connection = builder.getConnection()
    jest.spyOn(connection, 'update').mockResolvedValue(1)

    let result = await builder.from('users').join('orders', 'users.id', '=', 'orders.user_id').where('users.id', '=', 1).update({ email: 'foo', name: 'bar' })
    expect(connection.update).toHaveBeenCalledWith('update [users] set [email] = ?, [name] = ? from [users] inner join [orders] on [users].[id] = [orders].[user_id] where [users].[id] = ?', ['foo', 'bar', 1])
    expect(result).toBe(1)

    builder = getSqlServerBuilder()
    connection = builder.getConnection()
    jest.spyOn(connection, 'update').mockResolvedValue(1)

    result = await builder.from('users').join('orders', (join: JoinClause) => {
      join.on('users.id', '=', 'orders.user_id')
        .where('users.id', '=', 1)
    }).update({ email: 'foo', name: 'bar' })
    expect(connection.update).toHaveBeenCalledWith('update [users] set [email] = ?, [name] = ? from [users] inner join [orders] on [users].[id] = [orders].[user_id] and [users].[id] = ?', ['foo', 'bar', 1])
    expect(result).toBe(1)
  })

  test('testUpdateMethodWithJoinsOnMySql', async () => {
    let builder = getMySqlBuilder()
    let connection = builder.getConnection()
    jest.spyOn(connection, 'update').mockResolvedValue(1)

    let result = await builder.from('users').join('orders', 'users.id', '=', 'orders.user_id').where('users.id', '=', 1).update({ email: 'foo', name: 'bar' })
    expect(connection.update).toHaveBeenCalledWith('update `users` inner join `orders` on `users`.`id` = `orders`.`user_id` set `email` = ?, `name` = ? where `users`.`id` = ?', ['foo', 'bar', 1])
    expect(result).toBe(1)

    builder = getMySqlBuilder()
    connection = builder.getConnection()
    jest.spyOn(connection, 'update').mockResolvedValue(1)

    result = await builder.from('users').join('orders', (join: JoinClause) => {
      join.on('users.id', '=', 'orders.user_id')
        .where('users.id', '=', 1)
    }).update({ email: 'foo', name: 'bar' })
    expect(connection.update).toHaveBeenCalledWith('update `users` inner join `orders` on `users`.`id` = `orders`.`user_id` and `users`.`id` = ? set `email` = ?, `name` = ?', [1, 'foo', 'bar'])
    expect(result).toBe(1)
  })

  test('testUpdateMethodWithJoinsOnSQLite', async () => {
    let builder = getSQLiteBuilder()
    let connection = builder.getConnection()
    jest.spyOn(connection, 'update').mockResolvedValue(1)

    let result = await builder.from('users').where('users.id', '>', 1).limit(3).oldest('id').update({ email: 'foo', name: 'bar' })
    expect(connection.update).toHaveBeenCalledWith('update "users" set "email" = ?, "name" = ? where "rowid" in (select "users"."rowid" from "users" where "users"."id" > ? order by "id" asc limit 3)', ['foo', 'bar', 1])
    expect(result).toBe(1)

    builder = getSQLiteBuilder()
    connection = builder.getConnection()
    jest.spyOn(connection, 'update').mockResolvedValue(1)

    result = await builder.from('users').join('orders', 'users.id', '=', 'orders.user_id').where('users.id', '=', 1).update({ email: 'foo', name: 'bar' })
    expect(connection.update).toHaveBeenCalledWith('update "users" set "email" = ?, "name" = ? where "rowid" in (select "users"."rowid" from "users" inner join "orders" on "users"."id" = "orders"."user_id" where "users"."id" = ?)', ['foo', 'bar', 1])
    expect(result).toBe(1)

    builder = getSQLiteBuilder()
    connection = builder.getConnection()
    jest.spyOn(connection, 'update').mockResolvedValue(1)

    result = await builder.from('users').join('orders', (join: JoinClause) => {
      join.on('users.id', '=', 'orders.user_id')
        .where('users.id', '=', 1)
    }).update({ email: 'foo', name: 'bar' })
    expect(connection.update).toHaveBeenCalledWith('update "users" set "email" = ?, "name" = ? where "rowid" in (select "users"."rowid" from "users" inner join "orders" on "users"."id" = "orders"."user_id" and "users"."id" = ?)', ['foo', 'bar', 1])
    expect(result).toBe(1)

    builder = getSQLiteBuilder()
    connection = builder.getConnection()
    jest.spyOn(connection, 'update').mockResolvedValue(1)

    result = await builder.from('users as u').join('orders as o', 'u.id', '=', 'o.user_id').update({ email: 'foo', name: 'bar' })
    expect(connection.update).toHaveBeenCalledWith('update "users" as "u" set "email" = ?, "name" = ? where "rowid" in (select "u"."rowid" from "users" as "u" inner join "orders" as "o" on "u"."id" = "o"."user_id")', ['foo', 'bar'])
    expect(result).toBe(1)
  })

  test('testUpdateMethodWithJoinsAndAliasesOnSqlServer', async () => {
    const builder = getSqlServerBuilder()
    const connection = builder.getConnection()
    jest.spyOn(connection, 'update').mockResolvedValue(1)

    const result = await builder.from('users as u').join('orders', 'u.id', '=', 'orders.user_id').where('u.id', '=', 1).update({ email: 'foo', name: 'bar' })
    expect(connection.update).toHaveBeenCalledWith('update [u] set [email] = ?, [name] = ? from [users] as [u] inner join [orders] on [u].[id] = [orders].[user_id] where [u].[id] = ?', ['foo', 'bar', 1])
    expect(result).toBe(1)
  })

  test('testUpdateMethodWithoutJoinsOnPostgres', async () => {
    let builder = getPostgresBuilder()
    let connection = builder.getConnection()
    jest.spyOn(connection, 'update').mockResolvedValue(1)

    let result = await builder.from('users').where('id', '=', 1).update({ 'users.email': 'foo', name: 'bar' })
    expect(connection.update).toHaveBeenCalledWith('update "users" set "email" = ?, "name" = ? where "id" = ?', ['foo', 'bar', 1])
    expect(result).toBe(1)

    builder = getPostgresBuilder()
    connection = builder.getConnection()
    jest.spyOn(connection, 'update').mockResolvedValue(1)

    result = await builder.from('users').where('id', '=', 1).selectRaw('?', ['ignore']).update({ 'users.email': 'foo', name: 'bar' })
    expect(connection.update).toHaveBeenCalledWith('update "users" set "email" = ?, "name" = ? where "id" = ?', ['foo', 'bar', 1])
    expect(result).toBe(1)

    builder = getPostgresBuilder()
    connection = builder.getConnection()
    jest.spyOn(connection, 'update').mockResolvedValue(1)

    result = await builder.from('users.users').where('id', '=', 1).selectRaw('?', ['ignore']).update({ 'users.users.email': 'foo', name: 'bar' })
    expect(connection.update).toHaveBeenCalledWith('update "users"."users" set "email" = ?, "name" = ? where "id" = ?', ['foo', 'bar', 1])
    expect(result).toBe(1)
  })

  test('testUpdateMethodWithJoinsOnPostgres', async () => {
    let builder = getPostgresBuilder()
    let connection = builder.getConnection()
    jest.spyOn(connection, 'update').mockResolvedValue(1)

    let result = await builder.from('users').join('orders', 'users.id', '=', 'orders.user_id').where('users.id', '=', 1).update({ email: 'foo', name: 'bar' })
    expect(connection.update).toHaveBeenCalledWith('update "users" set "email" = ?, "name" = ? where "ctid" in (select "users"."ctid" from "users" inner join "orders" on "users"."id" = "orders"."user_id" where "users"."id" = ?)', ['foo', 'bar', 1])
    expect(result).toBe(1)

    builder = getPostgresBuilder()
    connection = builder.getConnection()
    jest.spyOn(connection, 'update').mockResolvedValue(1)

    result = await builder.from('users').join('orders', (join: JoinClause) => {
      join.on('users.id', '=', 'orders.user_id')
        .where('users.id', '=', 1)
    }).update({ email: 'foo', name: 'bar' })
    expect(connection.update).toHaveBeenCalledWith('update "users" set "email" = ?, "name" = ? where "ctid" in (select "users"."ctid" from "users" inner join "orders" on "users"."id" = "orders"."user_id" and "users"."id" = ?)', ['foo', 'bar', 1])
    expect(result).toBe(1)

    builder = getPostgresBuilder()
    connection = builder.getConnection()
    jest.spyOn(connection, 'update').mockResolvedValue(1)

    result = await builder.from('users').join('orders', (join: JoinClause) => {
      join.on('users.id', '=', 'orders.user_id')
        .where('users.id', '=', 1)
    }).where('name', 'baz').update({ email: 'foo', name: 'bar' })
    expect(connection.update).toHaveBeenCalledWith('update "users" set "email" = ?, "name" = ? where "ctid" in (select "users"."ctid" from "users" inner join "orders" on "users"."id" = "orders"."user_id" and "users"."id" = ? where "name" = ?)', ['foo', 'bar', 1, 'baz'])
    expect(result).toBe(1)
  })

  test('testUpdateFromMethodWithJoinsOnPostgres', async () => {
    let builder = getPostgresBuilder()
    let connection = builder.getConnection()
    jest.spyOn(connection, 'update').mockResolvedValue(1)

    let result = await builder.from('users').join('orders', 'users.id', '=', 'orders.user_id').where('users.id', '=', 1).updateFrom({ email: 'foo', name: 'bar' })
    expect(connection.update).toHaveBeenCalledWith('update "users" set "email" = ?, "name" = ? from "orders" where "users"."id" = ? and "users"."id" = "orders"."user_id"', ['foo', 'bar', 1])
    expect(result).toBe(1)

    builder = getPostgresBuilder()
    connection = builder.getConnection()
    jest.spyOn(connection, 'update').mockResolvedValue(1)

    result = await builder.from('users').join('orders', (join: JoinClause) => {
      join.on('users.id', '=', 'orders.user_id')
        .where('users.id', '=', 1)
    }).updateFrom({ email: 'foo', name: 'bar' })
    expect(connection.update).toHaveBeenCalledWith('update "users" set "email" = ?, "name" = ? from "orders" where "users"."id" = "orders"."user_id" and "users"."id" = ?', ['foo', 'bar', 1])
    expect(result).toBe(1)

    builder = getPostgresBuilder()
    connection = builder.getConnection()
    jest.spyOn(connection, 'update').mockResolvedValue(1)

    builder = getPostgresBuilder()
    connection = builder.getConnection()
    jest.spyOn(connection, 'update').mockResolvedValue(1)

    result = await builder.from('users').join('orders', (join: JoinClause) => {
      join.on('users.id', '=', 'orders.user_id')
        .where('users.id', '=', 1)
    }).where('name', 'baz').updateFrom({ email: 'foo', name: 'bar' })
    expect(connection.update).toHaveBeenCalledWith('update "users" set "email" = ?, "name" = ? from "orders" where "name" = ? and "users"."id" = "orders"."user_id" and "users"."id" = ?', ['foo', 'bar', 'baz', 1])
    expect(result).toBe(1)
  })

  test('testUpdateMethodRespectsRaw', async () => {
    const builder = getBuilder()
    const connection = builder.getConnection()
    jest.spyOn(connection, 'update').mockResolvedValue(1)

    const result = await builder.from('users').where('id', '=', 1).update({ email: new Raw('foo'), name: 'bar' })
    expect(connection.update).toHaveBeenCalledWith('update "users" set "email" = foo, "name" = ? where "id" = ?', ['bar', 1])
    expect(result).toBe(1)
  })

  test('testUpdateMethodWorksWithQueryAsValue', async () => {
    let builder = getBuilder()
    let connection = builder.getConnection()
    jest.spyOn(connection, 'update').mockResolvedValue(1)

    let subQueryBuilder = getBuilder()
    let result = await builder.from('users').where('id', '=', 1).update({ credits: subQueryBuilder.from('transactions').selectRaw('sum(credits)').whereColumn('transactions.user_id', 'users.id').where('type', 'foo') })

    expect(connection.update).toHaveBeenCalledWith('update "users" set "credits" = (select sum(credits) from "transactions" where "transactions"."user_id" = "users"."id" and "type" = ?) where "id" = ?', ['foo', 1])
    expect(result).toBe(1)

    builder = getBuilder()
    subQueryBuilder = new EloquentBuilder(getBuilder())
    connection = builder.getConnection()
    jest.spyOn(connection, 'update').mockResolvedValue(1)

    result = await builder.from('users').where('id', '=', 1).update({ credits: subQueryBuilder.from('transactions').selectRaw('sum(credits)').whereColumn('transactions.user_id', 'users.id').where('type', 'foo') })
    expect(connection.update).toHaveBeenCalledWith('update "users" set "credits" = (select sum(credits) from "transactions" where "transactions"."user_id" = "users"."id" and "type" = ?) where "id" = ?', ['foo', 1])
    expect(result).toBe(1)
  })

  test('testUpdateOrInsertMethod', async () => {
    let builder = getMockQueryBuilder()

    jest.spyOn(builder, 'where').mockReturnValue(builder)
    jest.spyOn(builder, 'exists').mockResolvedValue(false)
    jest.spyOn(builder, 'insert').mockReturnValue(true)

    let result = await builder.updateOrInsert({ email: 'foo' }, { name: 'bar' })
    expect(result).toBe(true)

    expect(builder.where).toHaveBeenCalledWith({ email: 'foo' })
    expect(builder.insert).toHaveBeenCalledWith({ email: 'foo', name: 'bar' })

    builder = getMockQueryBuilder()

    jest.spyOn(builder, 'where').mockReturnValue(builder)
    jest.spyOn(builder, 'exists').mockResolvedValue(true)
    jest.spyOn(builder, 'update').mockResolvedValue(1)

    result = await builder.updateOrInsert({ email: 'foo' }, { name: 'bar' })
    expect(result).toBe(true)

    expect(builder.where).toHaveBeenCalledWith({ email: 'foo' })
    expect(builder.update).toHaveBeenCalledWith({ name: 'bar' })
  })

  test('testUpdateOrInsertMethodWorksWithEmptyUpdateValues', async () => {
    const builder = getMockQueryBuilder()

    jest.spyOn(builder, 'where').mockReturnValue(builder)
    jest.spyOn(builder, 'exists').mockResolvedValue(true)
    jest.spyOn(builder, 'update').mockResolvedValue(1)

    const result = await builder.updateOrInsert({ email: 'foo' })
    expect(result).toBe(true)

    expect(builder.where).toHaveBeenCalledWith({ email: 'foo' })
    expect(builder.update).not.toHaveBeenCalled()
  })

  test('testDeleteMethod', async () => {
    let builder = getBuilder()
    let connection = builder.getConnection()
    jest.spyOn(connection, 'delete').mockResolvedValue(1)

    let result = await builder.from('users').where('email', '=', 'foo').delete()
    expect(connection.delete).toHaveBeenCalledWith('delete from "users" where "email" = ?', ['foo'])
    expect(result).toBe(1)

    builder = getBuilder()
    connection = builder.getConnection()
    jest.spyOn(connection, 'delete').mockResolvedValue(1)

    result = await builder.from('users').delete(1)
    expect(connection.delete).toHaveBeenCalledWith('delete from "users" where "users"."id" = ?', [1])
    expect(result).toBe(1)

    builder = getBuilder()
    connection = builder.getConnection()
    jest.spyOn(connection, 'delete').mockResolvedValue(1)

    result = await builder.from('users').selectRaw('?', ['ignore']).delete(1)
    expect(connection.delete).toHaveBeenCalledWith('delete from "users" where "users"."id" = ?', [1])
    expect(result).toBe(1)

    builder = getSQLiteBuilder()
    connection = builder.getConnection()
    jest.spyOn(connection, 'delete').mockResolvedValue(1)

    result = await builder.from('users').where('email', '=', 'foo').orderBy('id').limit(1).delete()
    expect(connection.delete).toHaveBeenCalledWith('delete from "users" where "rowid" in (select "users"."rowid" from "users" where "email" = ? order by "id" asc limit 1)', ['foo'])
    expect(result).toBe(1)

    builder = getMySqlBuilder()
    connection = builder.getConnection()
    jest.spyOn(connection, 'delete').mockResolvedValue(1)

    result = await builder.from('users').where('email', '=', 'foo').orderBy('id').limit(1).delete()
    expect(connection.delete).toHaveBeenCalledWith('delete from `users` where `email` = ? order by `id` asc limit 1', ['foo'])
    expect(result).toBe(1)

    builder = getSqlServerBuilder()
    connection = builder.getConnection()
    jest.spyOn(connection, 'delete').mockResolvedValue(1)

    result = await builder.from('users').where('email', '=', 'foo').delete()
    expect(connection.delete).toHaveBeenCalledWith('delete from [users] where [email] = ?', ['foo'])
    expect(result).toBe(1)

    builder = getSqlServerBuilder()
    connection = builder.getConnection()
    jest.spyOn(connection, 'delete').mockResolvedValue(1)

    result = await builder.from('users').where('email', '=', 'foo').orderBy('id').limit(1).delete()
    expect(connection.delete).toHaveBeenCalledWith('delete top (1) from [users] where [email] = ?', ['foo'])
    expect(result).toBe(1)
  })

  test('testDeleteWithJoinMethod', async () => {
    let builder = getSQLiteBuilder()
    let connection = builder.getConnection()
    jest.spyOn(connection, 'delete').mockResolvedValue(1)

    let result = await builder.from('users').join('contacts', 'users.id', '=', 'contacts.id').where('users.email', '=', 'foo').orderBy('users.id').limit(1).delete()
    expect(connection.delete).toHaveBeenCalledWith('delete from "users" where "rowid" in (select "users"."rowid" from "users" inner join "contacts" on "users"."id" = "contacts"."id" where "users"."email" = ? order by "users"."id" asc limit 1)', ['foo'])
    expect(result).toBe(1)

    builder = getSQLiteBuilder()
    connection = builder.getConnection()
    jest.spyOn(connection, 'delete').mockResolvedValue(1)

    result = await builder.from('users as u').join('contacts as c', 'u.id', '=', 'c.id').delete()
    expect(connection.delete).toHaveBeenCalledWith('delete from "users" as "u" where "rowid" in (select "u"."rowid" from "users" as "u" inner join "contacts" as "c" on "u"."id" = "c"."id")', [])
    expect(result).toBe(1)

    builder = getMySqlBuilder()
    connection = builder.getConnection()
    jest.spyOn(connection, 'delete').mockResolvedValue(1)

    result = await builder.from('users').join('contacts', 'users.id', '=', 'contacts.id').where('email', '=', 'foo').delete()
    expect(connection.delete).toHaveBeenCalledWith('delete `users` from `users` inner join `contacts` on `users`.`id` = `contacts`.`id` where `email` = ?', ['foo'])
    expect(result).toBe(1)

    builder = getMySqlBuilder()
    connection = builder.getConnection()
    jest.spyOn(connection, 'delete').mockResolvedValue(1)

    result = await builder.from('users AS a').join('users AS b', 'a.id', '=', 'b.user_id').where('email', '=', 'foo').delete()
    expect(connection.delete).toHaveBeenCalledWith('delete `a` from `users` as `a` inner join `users` as `b` on `a`.`id` = `b`.`user_id` where `email` = ?', ['foo'])
    expect(result).toBe(1)

    builder = getMySqlBuilder()
    connection = builder.getConnection()
    jest.spyOn(connection, 'delete').mockResolvedValue(1)

    result = await builder.from('users').join('contacts', 'users.id', '=', 'contacts.id').delete(1)
    expect(connection.delete).toHaveBeenCalledWith('delete `users` from `users` inner join `contacts` on `users`.`id` = `contacts`.`id` where `users`.`id` = ?', [1])
    expect(result).toBe(1)

    builder = getSqlServerBuilder()
    connection = builder.getConnection()
    jest.spyOn(connection, 'delete').mockResolvedValue(1)

    result = await builder.from('users').join('contacts', 'users.id', '=', 'contacts.id').where('email', '=', 'foo').delete()
    expect(connection.delete).toHaveBeenCalledWith('delete [users] from [users] inner join [contacts] on [users].[id] = [contacts].[id] where [email] = ?', ['foo'])
    expect(result).toBe(1)

    builder = getSqlServerBuilder()
    connection = builder.getConnection()
    jest.spyOn(connection, 'delete').mockResolvedValue(1)

    result = await builder.from('users AS a').join('users AS b', 'a.id', '=', 'b.user_id').where('email', '=', 'foo').orderBy('id').limit(1).delete()
    expect(connection.delete).toHaveBeenCalledWith('delete [a] from [users] as [a] inner join [users] as [b] on [a].[id] = [b].[user_id] where [email] = ?', ['foo'])
    expect(result).toBe(1)

    builder = getSqlServerBuilder()
    connection = builder.getConnection()
    jest.spyOn(connection, 'delete').mockResolvedValue(1)

    result = await builder.from('users').join('contacts', 'users.id', '=', 'contacts.id').delete(1)
    expect(connection.delete).toHaveBeenCalledWith('delete [users] from [users] inner join [contacts] on [users].[id] = [contacts].[id] where [users].[id] = ?', [1])
    expect(result).toBe(1)

    builder = getPostgresBuilder()
    connection = builder.getConnection()
    jest.spyOn(connection, 'delete').mockResolvedValue(1)

    result = await builder.from('users').join('contacts', 'users.id', '=', 'contacts.id').where('users.email', '=', 'foo').delete()
    expect(connection.delete).toHaveBeenCalledWith('delete from "users" where "ctid" in (select "users"."ctid" from "users" inner join "contacts" on "users"."id" = "contacts"."id" where "users"."email" = ?)', ['foo'])
    expect(result).toBe(1)

    builder = getPostgresBuilder()
    connection = builder.getConnection()
    jest.spyOn(connection, 'delete').mockResolvedValue(1)

    result = await builder.from('users AS a').join('users AS b', 'a.id', '=', 'b.user_id').where('email', '=', 'foo').orderBy('id').limit(1).delete()
    expect(connection.delete).toHaveBeenCalledWith('delete from "users" as "a" where "ctid" in (select "a"."ctid" from "users" as "a" inner join "users" as "b" on "a"."id" = "b"."user_id" where "email" = ? order by "id" asc limit 1)', ['foo'])
    expect(result).toBe(1)

    builder = getPostgresBuilder()
    connection = builder.getConnection()
    jest.spyOn(connection, 'delete').mockResolvedValue(1)

    result = await builder.from('users').join('contacts', 'users.id', '=', 'contacts.id').orderBy('id').limit(1).delete(1)
    expect(connection.delete).toHaveBeenCalledWith('delete from "users" where "ctid" in (select "users"."ctid" from "users" inner join "contacts" on "users"."id" = "contacts"."id" where "users"."id" = ? order by "id" asc limit 1)', [1])
    expect(result).toBe(1)

    builder = getPostgresBuilder()
    connection = builder.getConnection()
    jest.spyOn(connection, 'delete').mockResolvedValue(1)

    result = await builder.from('users').join('contacts', (join: JoinClause) => {
      join.on('users.id', '=', 'contacts.user_id')
        .where('users.id', '=', 1)
    }).where('name', 'baz').delete()
    expect(connection.delete).toHaveBeenCalledWith('delete from "users" where "ctid" in (select "users"."ctid" from "users" inner join "contacts" on "users"."id" = "contacts"."user_id" and "users"."id" = ? where "name" = ?)', [1, 'baz'])
    expect(result).toBe(1)

    builder = getPostgresBuilder()
    connection = builder.getConnection()
    jest.spyOn(connection, 'delete').mockResolvedValue(1)

    result = await builder.from('users').join('contacts', 'users.id', '=', 'contacts.id').delete()
    expect(connection.delete).toHaveBeenCalledWith('delete from "users" where "ctid" in (select "users"."ctid" from "users" inner join "contacts" on "users"."id" = "contacts"."id")', [])
    expect(result).toBe(1)
  })

  test('testTruncateMethod', async () => {
    let builder = getBuilder()
    let connection = builder.getConnection()
    jest.spyOn(connection, 'statement').mockResolvedValue(true)

    await builder.from('users').truncate()
    expect(connection.statement).toHaveBeenCalledWith('truncate table "users"', [])

    builder = getSQLiteBuilder()
    connection = builder.getConnection()
    jest.spyOn(connection, 'getSchemaBuilder').mockReturnValue({
      parseSchemaAndTable: () => [null, 'users']
    })

    builder.from('users')
    expect(builder.getGrammar().compileTruncate(builder)).toEqual({
      'delete from sqlite_sequence where name = ?': ['users'],
      'delete from "users"': []
    })
  })

  test('testTruncateMethodWithPrefix', async () => {
    let builder = getBuilder('prefix_')
    let connection = builder.getConnection()
    jest.spyOn(connection, 'statement').mockResolvedValue(true)

    await builder.from('users').truncate()
    expect(connection.statement).toHaveBeenCalledWith('truncate table "prefix_users"', [])

    builder = getSQLiteBuilder('prefix_')
    connection = builder.getConnection()
    jest.spyOn(connection, 'getSchemaBuilder').mockReturnValue({
      parseSchemaAndTable: () => [null, 'users']
    })

    builder.from('users')
    expect(builder.getGrammar().compileTruncate(builder)).toEqual({
      'delete from sqlite_sequence where name = ?': ['prefix_users'],
      'delete from "prefix_users"': []
    })
  })

  test('testTruncateMethodWithPrefixAndSchema', async () => {
    let builder = getBuilder('prefix_')
    let connection = builder.getConnection()
    jest.spyOn(connection, 'statement').mockResolvedValue(true)

    await builder.from('my_schema.users').truncate()
    expect(connection.statement).toHaveBeenCalledWith('truncate table "my_schema"."prefix_users"', [])

    builder = getSQLiteBuilder('prefix_')
    connection = builder.getConnection()
    jest.spyOn(connection, 'getSchemaBuilder').mockReturnValue({
      parseSchemaAndTable: () => ['my_schema', 'users']
    })

    builder.from('my_schema.users')
    expect(builder.getGrammar().compileTruncate(builder)).toEqual({
      'delete from "my_schema".sqlite_sequence where name = ?': ['prefix_users'],
      'delete from "my_schema"."prefix_users"': []
    })
  })

  test('testPreserveAddsClosureToArray', () => {
    const builder = getBuilder()

    builder.beforeQuery(() => {})

    expect(builder.beforeQueryCallbacks).toHaveLength(1)
    expect(typeof builder.beforeQueryCallbacks[0]).toBe('function')
  })

  test('testApplyPreserveCleansArray', () => {
    const builder = getBuilder()

    builder.beforeQuery(() => {})
    expect(builder.beforeQueryCallbacks).toHaveLength(1)

    builder.applyBeforeQueryCallbacks()
    expect(builder.beforeQueryCallbacks).toHaveLength(0)
  })

  test('testPreservedAreAppliedByToSql', () => {
    const builder = getBuilder()

    builder.beforeQuery((query) => {
      query.where('foo', 'bar')
    })

    expect(builder.toSql()).toBe('select * where "foo" = ?')
    expect(builder.getBindings()).toEqual(['bar'])
  })

  test('testPreservedAreAppliedByInsert', async () => {
    const builder = getBuilder()
    const connection = builder.getConnection()
    jest.spyOn(connection, 'insert').mockResolvedValue(true)

    builder.beforeQuery((query) => {
      query.from('users')
    })

    const result = await builder.insert({ email: 'foo' })
    expect(connection.insert).toHaveBeenCalledWith('insert into "users" ("email") values (?)', ['foo'])
    expect(result).toBe(true)
  })

  test('testPreservedAreAppliedByInsertGetId', async () => {
    const builder = getBuilder()
    const processor = builder.getProcessor()
    jest.spyOn(processor, 'processInsertGetId').mockReturnValue(1)

    builder.beforeQuery((query) => {
      query.from('users')
    })

    const result = await builder.insertGetId({ email: 'foo' }, 'id')
    expect(processor.processInsertGetId).toHaveBeenCalledWith(builder, 'insert into "users" ("email") values (?)', ['foo'], 'id')
    expect(result).toBe(1)
  })

  test('testPreservedAreAppliedByInsertUsing', async () => {
    const builder = getBuilder()
    const connection = builder.getConnection()
    jest.spyOn(connection, 'affectingStatement').mockResolvedValue(1)

    builder.beforeQuery((query) => {
      query.from('users')
    })

    const result = await builder.insertUsing(['email'], getBuilder())
    expect(connection.affectingStatement).toHaveBeenCalledWith('insert into "users" ("email") select *', [])
    expect(result).toBe(1)
  })

  test('testPreservedAreAppliedByUpsert', async () => {
    let builder = getMySqlBuilder()
    let connection = builder.getConnection()
    jest.spyOn(connection, 'affectingStatement').mockResolvedValue(1)
    jest.spyOn(connection, 'getConfig').mockReturnValue(false)

    builder.beforeQuery((query) => {
      query.from('users')
    })

    let result = await builder.upsert({ email: 'foo' }, 'id')
    expect(connection.affectingStatement).toHaveBeenCalledWith('insert into `users` (`email`) values (?) on duplicate key update `email` = values(`email`)', ['foo'])
    expect(connection.getConfig).toHaveBeenCalledWith('use_upsert_alias')
    expect(result).toBe(1)

    builder = getMySqlBuilder()
    connection = builder.getConnection()
    jest.spyOn(connection, 'affectingStatement').mockResolvedValue(1)
    jest.spyOn(connection, 'getConfig').mockReturnValue(true)

    builder.beforeQuery((query) => {
      query.from('users')
    })

    result = await builder.upsert({ email: 'foo' }, 'id')
    expect(connection.affectingStatement).toHaveBeenCalledWith('insert into `users` (`email`) values (?) as lihtne_upsert_alias on duplicate key update `email` = `lihtne_upsert_alias`.`email`', ['foo'])
    expect(connection.getConfig).toHaveBeenCalledWith('use_upsert_alias')
    expect(result).toBe(1)
  })

  test('testPreservedAreAppliedByUpdate', async () => {
    const builder = getBuilder()
    const connection = builder.getConnection()
    jest.spyOn(connection, 'update').mockResolvedValue(1)

    builder.from('users').beforeQuery((query) => {
      query.where('id', 1)
    })

    const result = await builder.update({ email: 'foo' })
    expect(connection.update).toHaveBeenCalledWith('update "users" set "email" = ? where "id" = ?', ['foo', 1])
    expect(result).toBe(1)
  })

  test('testPreservedAreAppliedByDelete', async () => {
    const builder = getBuilder()
    const connection = builder.getConnection()
    jest.spyOn(connection, 'delete').mockResolvedValue(1)

    builder.beforeQuery((query) => {
      query.from('users')
    })

    const result = await builder.delete()
    expect(connection.delete).toHaveBeenCalledWith('delete from "users"', [])
    expect(result).toBe(1)
  })

  test('testPreservedAreAppliedByTruncate', async () => {
    const builder = getBuilder()
    const connection = builder.getConnection()
    jest.spyOn(connection, 'statement').mockResolvedValue(true)

    builder.beforeQuery((query) => {
      query.from('users')
    })

    await builder.truncate()
    expect(connection.statement).toHaveBeenCalledWith('truncate table "users"', [])
  })

  test('testPreservedAreAppliedByExists', async () => {
    const builder = getBuilder()
    const connection = builder.getConnection()
    jest.spyOn(connection, 'select').mockResolvedValue([{ exists: 1 }])

    builder.beforeQuery((query) => {
      query.from('users')
    })

    const result = await builder.exists()
    expect(connection.select).toHaveBeenCalledWith('select exists(select * from "users") as "exists"', [])
    expect(result).toBe(true)
  })

  test('testPostgresInsertGetId', async () => {
    const builder = getPostgresBuilder()
    const processor = builder.getProcessor()
    jest.spyOn(processor, 'processInsertGetId').mockReturnValue(1)

    const result = await builder.from('users').insertGetId({ email: 'foo' }, 'id')
    expect(processor.processInsertGetId).toHaveBeenCalledWith(builder, 'insert into "users" ("email") values (?) returning "id"', ['foo'], 'id')
    expect(result).toBe(1)
  })

  test('testMySqlWrapping', () => {
    const builder = getMySqlBuilder()
    builder.select('*').from('users')
    expect(builder.toSql()).toBe('select * from `users`')
  })

  test('testMySqlUpdateWrappingJson', async () => {
    const builder = getMySqlBuilder()
    const connection = builder.getConnection()
    jest.spyOn(connection, 'update').mockResolvedValue(1)

    const result = await builder.from('users').where('active', '=', 1).update({
      'name->first_name': 'John',
      'name->last_name': 'Doe'
    })
    expect(connection.update).toHaveBeenCalledWith(
      'update `users` set `name` = json_set(`name`, \'$."first_name"\', ?), `name` = json_set(`name`, \'$."last_name"\', ?) where `active` = ?',
      ['John', 'Doe', 1]
    )
    expect(result).toBe(1)
  })

  test('testMySqlUpdateWrappingNestedJson', async () => {
    const builder = getMySqlBuilder()
    const connection = builder.getConnection()
    jest.spyOn(connection, 'update').mockResolvedValue(1)

    const result = await builder.from('users').where('active', '=', 1).update({
      'meta->name->first_name': 'John',
      'meta->name->last_name': 'Doe'
    })
    expect(connection.update).toHaveBeenCalledWith(
      'update `users` set `meta` = json_set(`meta`, \'$."name"."first_name"\', ?), `meta` = json_set(`meta`, \'$."name"."last_name"\', ?) where `active` = ?',
      ['John', 'Doe', 1]
    )
    expect(result).toBe(1)
  })

  test('testMySqlUpdateWrappingJsonArray', async () => {
    const builder = getMySqlBuilder()
    const connection = builder.getConnection()
    jest.spyOn(connection, 'update').mockResolvedValue(1)

    const createdAt = new Date('2019-08-06')

    const result = await builder.from('users').where('active', '=', 1).update({
      options: { '2fa': false, presets: ['lihtne', 'vue'] },
      'meta->tags': ['white', 'large'],
      group_id: new Raw('45'),
      created_at: createdAt
    })
    expect(connection.update).toHaveBeenCalledWith(
      'update `users` set `options` = ?, `meta` = json_set(`meta`, \'$."tags"\', cast(? as json)), `group_id` = 45, `created_at` = ? where `active` = ?',
      [
        JSON.stringify({ '2fa': false, presets: ['lihtne', 'vue'] }),
        JSON.stringify(['white', 'large']),
        createdAt,
        1
      ]
    )
    expect(result).toBe(1)
  })

  test('testMySqlUpdateWrappingJsonPathArrayIndex', async () => {
    const builder = getMySqlBuilder()
    const connection = builder.getConnection()
    jest.spyOn(connection, 'update').mockResolvedValue(1)

    const result = await builder.from('users').where('active', '=', 1).update({
      'options->[1]->2fa': false,
      'meta->tags[0][2]': 'large'
    })
    expect(connection.update).toHaveBeenCalledWith(
      'update `users` set `options` = json_set(`options`, \'$[1]."2fa"\', false), `meta` = json_set(`meta`, \'$."tags"[0][2]\', ?) where `active` = ?',
      ['large', 1]
    )
    expect(result).toBe(1)
  })

  test('testMySqlUpdateWithJsonPreparesBindingsCorrectly', async () => {
    let builder = getMySqlBuilder()
    let connection = builder.getConnection()
    jest.spyOn(connection, 'update').mockResolvedValue(1)

    await builder.from('users').where('id', '=', 0).update({
      'options->enable': false,
      updated_at: '2015-05-26 22:02:06'
    })
    expect(connection.update).toHaveBeenCalledWith(
      'update `users` set `options` = json_set(`options`, \'$."enable"\', false), `updated_at` = ? where `id` = ?',
      ['2015-05-26 22:02:06', 0]
    )

    builder = getMySqlBuilder()
    connection = builder.getConnection()
    jest.spyOn(connection, 'update').mockResolvedValue(1)

    await builder.from('users').where('id', '=', 0).update({
      'options->size': 45,
      updated_at: '2015-05-26 22:02:06'
    })
    expect(connection.update).toHaveBeenCalledWith(
      'update `users` set `options` = json_set(`options`, \'$."size"\', ?), `updated_at` = ? where `id` = ?',
      [45, '2015-05-26 22:02:06', 0]
    )

    builder = getMySqlBuilder()
    connection = builder.getConnection()
    jest.spyOn(connection, 'update').mockResolvedValue(1)

    await builder.from('users').update({ 'options->size': null })
    expect(connection.update).toHaveBeenCalledWith(
      'update `users` set `options` = json_set(`options`, \'$."size"\', ?)',
      [null]
    )

    builder = getMySqlBuilder()
    connection = builder.getConnection()
    jest.spyOn(connection, 'update').mockResolvedValue(1)

    await builder.from('users').update({ 'options->size': new Raw('45') })
    expect(connection.update).toHaveBeenCalledWith(
      'update `users` set `options` = json_set(`options`, \'$."size"\', 45)',
      []
    )
  })

  test('testPostgresUpdateWrappingJson', async () => {
    let builder = getPostgresBuilder()
    let connection = builder.getConnection()
    jest.spyOn(connection, 'update').mockResolvedValue(1)

    await builder.from('users').update({ 'users.options->name->first_name': 'John' })
    expect(connection.update).toHaveBeenCalledWith(
      'update "users" set "options" = jsonb_set("options"::jsonb, \'{"name","first_name"}\', ?)',
      ['"John"']
    )

    builder = getPostgresBuilder()
    connection = builder.getConnection()
    jest.spyOn(connection, 'update').mockResolvedValue(1)

    await builder.from('users').update({ 'options->language': new Raw("'null'") })
    expect(connection.update).toHaveBeenCalledWith(
      'update "users" set "options" = jsonb_set("options"::jsonb, \'{"language"}\', \'null\')',
      []
    )
  })

  test('testPostgresUpdateWrappingJsonArray', async () => {
    const builder = getPostgresBuilder()
    const connection = builder.getConnection()
    jest.spyOn(connection, 'update').mockResolvedValue(1)

    const createdAt = new Date('2019-08-06')

    const result = await builder.from('users').update({
      options: { '2fa': false, presets: ['lihtne', 'vue'] },
      'meta->tags': ['white', 'large'],
      group_id: new Raw('45'),
      created_at: createdAt
    })
    expect(connection.update).toHaveBeenCalledWith(
      'update "users" set "options" = ?, "meta" = jsonb_set("meta"::jsonb, \'{"tags"}\', ?), "group_id" = 45, "created_at" = ?',
      [
        JSON.stringify({ '2fa': false, presets: ['lihtne', 'vue'] }),
        JSON.stringify(['white', 'large']),
        createdAt
      ]
    )
    expect(result).toBe(1)
  })

  test('testPostgresUpdateWrappingJsonPathArrayIndex', async () => {
    const builder = getPostgresBuilder()
    const connection = builder.getConnection()
    jest.spyOn(connection, 'update').mockResolvedValue(1)

    const result = await builder.from('users').where('options->[1]->2fa', true).update({
      'options->[1]->2fa': false,
      'meta->tags[0][2]': 'large'
    })
    expect(connection.update).toHaveBeenCalledWith(
      'update "users" set "options" = jsonb_set("options"::jsonb, \'{1,"2fa"}\', ?), "meta" = jsonb_set("meta"::jsonb, \'{"tags",0,2}\', ?) where ("options"->1->\'2fa\')::jsonb = \'true\'::jsonb',
      ['false', '"large"']
    )
    expect(result).toBe(1)
  })

  test('testSQLiteUpdateWrappingJsonArray', async () => {
    const builder = getSQLiteBuilder()
    const connection = builder.getConnection()
    jest.spyOn(connection, 'update').mockResolvedValue(1)

    const createdAt = new Date('2019-08-06')

    const result = await builder.from('users').update({
      options: { '2fa': false, presets: ['lihtne', 'vue'] },
      group_id: new Raw('45'),
      created_at: createdAt
    })
    expect(connection.update).toHaveBeenCalledWith(
      'update "users" set "options" = ?, "group_id" = 45, "created_at" = ?',
      [
        JSON.stringify({ '2fa': false, presets: ['lihtne', 'vue'] }),
        createdAt
      ]
    )
    expect(result).toBe(1)
  })

  test('testSQLiteUpdateWrappingNestedJsonArray', async () => {
    const builder = getSQLiteBuilder()
    const connection = builder.getConnection()
    jest.spyOn(connection, 'update').mockResolvedValue(1)

    const createdAt = new Date('2019-08-06')

    const result = await builder.from('users').update({
      'options->name': 'Alvaro',
      group_id: new Raw('45'),
      'options->security': { '2fa': false, presets: ['lihtne', 'vue'] },
      'options->sharing->twitter': 'username',
      created_at: createdAt
    })
    expect(connection.update).toHaveBeenCalledWith(
      'update "users" set "group_id" = 45, "created_at" = ?, "options" = json_patch(ifnull("options", json(\'{}\')), json(?))',
      [
        createdAt,
        JSON.stringify({
          name: 'Alvaro',
          security: { '2fa': false, presets: ['lihtne', 'vue'] },
          sharing: { twitter: 'username' }
        })
      ]
    )
    expect(result).toBe(1)
  })

  test('testSQLiteUpdateWrappingJsonPathArrayIndex', async () => {
    const builder = getSQLiteBuilder()
    const connection = builder.getConnection()
    jest.spyOn(connection, 'update').mockResolvedValue(1)

    const result = await builder.from('users').where('options->[1]->2fa', true).update({
      'options->[1]->2fa': false,
      'meta->tags[0][2]': 'large'
    })
    expect(connection.update).toHaveBeenCalledWith(
      'update "users" set "options" = json_patch(ifnull("options", json(\'{}\')), json(?)), "meta" = json_patch(ifnull("meta", json(\'{}\')), json(?)) where json_extract("options", \'$[1]."2fa"\') = true',
      ['{"[1]":{"2fa":false}}', '{"tags[0][2]":"large"}']
    )
    expect(result).toBe(1)
  })

  test('testMySqlWrappingJsonWithString', () => {
    const builder = getMySqlBuilder()
    builder.select('*').from('users').where('items->sku', '=', 'foo-bar')
    expect(builder.toSql()).toBe(
      'select * from `users` where json_unquote(json_extract(`items`, \'$."sku"\')) = ?'
    )
    expect(builder.getRawBindings().where).toHaveLength(1)
    expect(builder.getRawBindings().where[0]).toBe('foo-bar')
  })

  test('testMySqlWrappingJsonWithInteger', () => {
    const builder = getMySqlBuilder()
    builder.select('*').from('users').where('items->price', '=', 1)
    expect(builder.toSql()).toBe(
      'select * from `users` where json_unquote(json_extract(`items`, \'$."price"\')) = ?'
    )
  })

  test('testMySqlWrappingJsonWithDouble', () => {
    const builder = getMySqlBuilder()
    builder.select('*').from('users').where('items->price', '=', 1.5)
    expect(builder.toSql()).toBe(
      'select * from `users` where json_unquote(json_extract(`items`, \'$."price"\')) = ?'
    )
  })

  test('testMySqlWrappingJsonWithBoolean', () => {
    let builder = getMySqlBuilder()
    builder.select('*').from('users').where('items->available', '=', true)
    expect(builder.toSql()).toBe(
      'select * from `users` where json_extract(`items`, \'$."available"\') = true'
    )

    builder = getMySqlBuilder()
    builder.select('*').from('users').where(new Raw("items->'$.available'"), '=', true)
    expect(builder.toSql()).toBe("select * from `users` where items->'$.available' = true")
  })

  test('testMySqlWrappingJsonWithBooleanAndIntegerThatLooksLikeOne', () => {
    const builder = getMySqlBuilder()
    builder
      .select('*')
      .from('users')
      .where('items->available', '=', true)
      .where('items->active', '=', false)
      .where('items->number_available', '=', 0)
    expect(builder.toSql()).toBe(
      'select * from `users` where json_extract(`items`, \'$."available"\') = true and json_extract(`items`, \'$."active"\') = false and json_unquote(json_extract(`items`, \'$."number_available"\')) = ?'
    )
  })

  test('testJsonPathEscaping', () => {
    const expectedWithJsonEscaped =
      'select json_unquote(json_extract(`json`, \'$."\'\'))#"\'))'

    let builder = getMySqlBuilder()
    builder.select("json->'))#")
    expect(builder.toSql()).toBe(expectedWithJsonEscaped)

    builder = getMySqlBuilder()
    builder.select("json->\\'))#")
    expect(builder.toSql()).toBe(expectedWithJsonEscaped)

    builder = getMySqlBuilder()
    builder.select("json->\\\\'))#")
    expect(builder.toSql()).toBe(expectedWithJsonEscaped)

    builder = getMySqlBuilder()
    builder.select("json->\\\\\\'))#")
    expect(builder.toSql()).toBe(expectedWithJsonEscaped)
  })

  test('testPostgresJsonPathEscaping', () => {
    let builder = getPostgresBuilder()
    builder.select("json->'))#")
    expect(builder.toSql()).toBe('select "json"->>\'\'\'))#\'')

    builder = getPostgresBuilder()
    builder.select('*').from('users').where("json->'))#", '=', 1)
    expect(builder.toSql()).toBe('select * from "users" where "json"->>\'\'\'))#\' = ?')

    builder = getPostgresBuilder()
    builder.select('*').from('users').orderBy("json->'))#")
    expect(builder.toSql()).toBe('select * from "users" order by "json"->>\'\'\'))#\' asc')

    builder = getPostgresBuilder()
    builder.select('*').from('users').whereJsonLength("json->'))#", 1)
    expect(builder.toSql()).toBe(
      'select * from "users" where jsonb_array_length(("json"->\'\'\'))#\')::jsonb) = ?'
    )
  })

  test('testPostgresUpdateJsonPathEscaping', async () => {
    const builder = getPostgresBuilder()
    const connection = builder.getConnection()
    jest.spyOn(connection, 'update').mockResolvedValue(1)

    await builder.from('users').update({ "options->'))#": 'John' })
    expect(connection.update).toHaveBeenCalledWith(
      'update "users" set "options" = jsonb_set("options"::jsonb, \'{"\'\'))#"}\', ?)',
      ['"John"']
    )
  })

  test('testMySqlWrappingJson', () => {
    let builder = getMySqlBuilder()
    builder.select('*').from('users').whereRaw('items->\'$."price"\' = 1')
    expect(builder.toSql()).toBe('select * from `users` where items->\'$."price"\' = 1')

    builder = getMySqlBuilder()
    builder
      .select('items->price')
      .from('users')
      .where('users.items->price', '=', 1)
      .orderBy('items->price')
    expect(builder.toSql()).toBe(
      'select json_unquote(json_extract(`items`, \'$."price"\')) from `users` where json_unquote(json_extract(`users`.`items`, \'$."price"\')) = ? order by json_unquote(json_extract(`items`, \'$."price"\')) asc'
    )

    builder = getMySqlBuilder()
    builder.select('*').from('users').where('items->price->in_usd', '=', 1)
    expect(builder.toSql()).toBe(
      'select * from `users` where json_unquote(json_extract(`items`, \'$."price"."in_usd"\')) = ?'
    )

    builder = getMySqlBuilder()
    builder
      .select('*')
      .from('users')
      .where('items->price->in_usd', '=', 1)
      .where('items->age', '=', 2)
    expect(builder.toSql()).toBe(
      'select * from `users` where json_unquote(json_extract(`items`, \'$."price"."in_usd"\')) = ? and json_unquote(json_extract(`items`, \'$."age"\')) = ?'
    )
  })

  test('testPostgresWrappingJson', () => {
    let builder = getPostgresBuilder()
    builder
      .select('items->price')
      .from('users')
      .where('users.items->price', '=', 1)
      .orderBy('items->price')
    expect(builder.toSql()).toBe(
      'select "items"->>\'price\' from "users" where "users"."items"->>\'price\' = ? order by "items"->>\'price\' asc'
    )

    builder = getPostgresBuilder()
    builder.select('*').from('users').where('items->price->in_usd', '=', 1)
    expect(builder.toSql()).toBe(
      'select * from "users" where "items"->\'price\'->>\'in_usd\' = ?'
    )

    builder = getPostgresBuilder()
    builder
      .select('*')
      .from('users')
      .where('items->price->in_usd', '=', 1)
      .where('items->age', '=', 2)
    expect(builder.toSql()).toBe(
      'select * from "users" where "items"->\'price\'->>\'in_usd\' = ? and "items"->>\'age\' = ?'
    )

    builder = getPostgresBuilder()
    builder
      .select('*')
      .from('users')
      .where('items->prices->0', '=', 1)
      .where('items->age', '=', 2)
    expect(builder.toSql()).toBe(
      'select * from "users" where "items"->\'prices\'->>0 = ? and "items"->>\'age\' = ?'
    )

    builder = getPostgresBuilder()
    builder.select('*').from('users').where('items->available', '=', true)
    expect(builder.toSql()).toBe(
      'select * from "users" where ("items"->\'available\')::jsonb = \'true\'::jsonb'
    )
  })

  test('testSqlServerWrappingJson', () => {
    let builder = getSqlServerBuilder()
    builder
      .select('items->price')
      .from('users')
      .where('users.items->price', '=', 1)
      .orderBy('items->price')
    expect(builder.toSql()).toBe(
      'select json_value([items], \'$."price"\') from [users] where json_value([users].[items], \'$."price"\') = ? order by json_value([items], \'$."price"\') asc'
    )

    builder = getSqlServerBuilder()
    builder.select('*').from('users').where('items->price->in_usd', '=', 1)
    expect(builder.toSql()).toBe(
      'select * from [users] where json_value([items], \'$."price"."in_usd"\') = ?'
    )

    builder = getSqlServerBuilder()
    builder
      .select('*')
      .from('users')
      .where('items->price->in_usd', '=', 1)
      .where('items->age', '=', 2)
    expect(builder.toSql()).toBe(
      'select * from [users] where json_value([items], \'$."price"."in_usd"\') = ? and json_value([items], \'$."age"\') = ?'
    )

    builder = getSqlServerBuilder()
    builder.select('*').from('users').where('items->available', '=', true)
    expect(builder.toSql()).toBe(
      "select * from [users] where json_value([items], '$.\"available\"') = 'true'"
    )
  })

  test('testSqliteWrappingJson', () => {
    let builder = getSQLiteBuilder()
    builder
      .select('items->price')
      .from('users')
      .where('users.items->price', '=', 1)
      .orderBy('items->price')
    expect(builder.toSql()).toBe(
      'select json_extract("items", \'$."price"\') from "users" where json_extract("users"."items", \'$."price"\') = ? order by json_extract("items", \'$."price"\') asc'
    )

    builder = getSQLiteBuilder()
    builder.select('*').from('users').where('items->price->in_usd', '=', 1)
    expect(builder.toSql()).toBe(
      'select * from "users" where json_extract("items", \'$."price"."in_usd"\') = ?'
    )

    builder = getSQLiteBuilder()
    builder
      .select('*')
      .from('users')
      .where('items->price->in_usd', '=', 1)
      .where('items->age', '=', 2)
    expect(builder.toSql()).toBe(
      'select * from "users" where json_extract("items", \'$."price"."in_usd"\') = ? and json_extract("items", \'$."age"\') = ?'
    )

    builder = getSQLiteBuilder()
    builder.select('*').from('users').where('items->available', '=', true)
    expect(builder.toSql()).toBe(
      'select * from "users" where json_extract("items", \'$."available"\') = true'
    )
  })

  test('testSQLiteOrderBy', () => {
    const builder = getSQLiteBuilder()
    builder.select('*').from('users').orderBy('email', 'desc')
    expect(builder.toSql()).toBe('select * from "users" order by "email" desc')
  })

  test('testSqlServerLimitsAndOffsets', () => {
    let builder = getSqlServerBuilder()
    builder.select('*').from('users').limit(10)
    expect(builder.toSql()).toBe('select top 10 * from [users]')

    builder = getSqlServerBuilder()
    builder.select('*').from('users').offset(10).orderBy('email', 'desc')
    expect(builder.toSql()).toBe('select * from [users] order by [email] desc offset 10 rows')

    builder = getSqlServerBuilder()
    builder.select('*').from('users').offset(10).limit(10)
    expect(builder.toSql()).toBe(
      'select * from [users] order by (SELECT 0) offset 10 rows fetch next 10 rows only'
    )

    builder = getSqlServerBuilder()
    builder.select('*').from('users').offset(11).limit(10).orderBy('email', 'desc')
    expect(builder.toSql()).toBe(
      'select * from [users] order by [email] desc offset 11 rows fetch next 10 rows only'
    )

    builder = getSqlServerBuilder()
    const subQuery = (query: Builder) => {
      return query
        .select('created_at')
        .from('logins')
        .where('users.name', 'nameBinding')
        .whereColumn('user_id', 'users.id')
        .limit(1)
    }
    builder
      .select('*')
      .from('users')
      .where('email', 'emailBinding')
      .orderBy(subQuery)
      .offset(10)
      .limit(10)
    expect(builder.toSql()).toBe(
      'select * from [users] where [email] = ? order by (select top 1 [created_at] from [logins] where [users].[name] = ? and [user_id] = [users].[id]) asc offset 10 rows fetch next 10 rows only'
    )
    expect(builder.getBindings()).toEqual(['emailBinding', 'nameBinding'])

    builder = getSqlServerBuilder()
    builder.select('*').from('users').limit('foo' as unknown as number)
    expect(builder.toSql()).toBe('select * from [users]')

    builder = getSqlServerBuilder()
    builder
      .select('*')
      .from('users')
      .limit('foo' as unknown as number)
      .offset('bar' as unknown as number)
    expect(builder.toSql()).toBe('select * from [users]')

    builder = getSqlServerBuilder()
    builder.select('*').from('users').offset('bar' as unknown as number)
    expect(builder.toSql()).toBe('select * from [users]')
  })

  test('testMySqlSoundsLikeOperator', () => {
    const builder = getMySqlBuilder()
    builder.select('*').from('users').where('name', 'sounds like', 'John Doe')
    expect(builder.toSql()).toBe('select * from `users` where `name` sounds like ?')
    expect(builder.getBindings()).toEqual(['John Doe'])
  })

  test('testBitwiseOperators', () => {
    let builder = getBuilder()
    builder.select('*').from('users').where('bar', '&', 1)
    expect(builder.toSql()).toBe('select * from "users" where "bar" & ?')

    builder = getPostgresBuilder()
    builder.select('*').from('users').where('bar', '#', 1)
    expect(builder.toSql()).toBe('select * from "users" where ("bar" # ?)::bool')

    builder = getPostgresBuilder()
    builder
      .select('*')
      .from('users')
      .where('range', '>>', '[2022-01-08 00:00:00,2022-01-09 00:00:00)')
    expect(builder.toSql()).toBe('select * from "users" where ("range" >> ?)::bool')

    builder = getSqlServerBuilder()
    builder.select('*').from('users').where('bar', '&', 1)
    expect(builder.toSql()).toBe('select * from [users] where ([bar] & ?) != 0')

    builder = getBuilder()
    builder.select('*').from('users').having('bar', '&', 1)
    expect(builder.toSql()).toBe('select * from "users" having "bar" & ?')

    builder = getPostgresBuilder()
    builder.select('*').from('users').having('bar', '#', 1)
    expect(builder.toSql()).toBe('select * from "users" having ("bar" # ?)::bool')

    builder = getPostgresBuilder()
    builder
      .select('*')
      .from('users')
      .having('range', '>>', '[2022-01-08 00:00:00,2022-01-09 00:00:00)')
    expect(builder.toSql()).toBe('select * from "users" having ("range" >> ?)::bool')

    builder = getSqlServerBuilder()
    builder.select('*').from('users').having('bar', '&', 1)
    expect(builder.toSql()).toBe('select * from [users] having ([bar] & ?) != 0')
  })

  test('testMergeWheresCanMergeWheresAndBindings', () => {
    const builder = getBuilder()
    builder.wheres = [{ type: 'Basic', column: 'foo', operator: '=', value: 1, boolean: 'and' } as const]
    builder.mergeWheres(
      [{ type: 'Basic', column: 'wheres', operator: '=', value: 2, boolean: 'and' } as const],
      { 12: 'foo', 13: 'bar' }
    )
    expect(builder.wheres).toEqual([
      { type: 'Basic', column: 'foo', operator: '=', value: 1, boolean: 'and' },
      { type: 'Basic', column: 'wheres', operator: '=', value: 2, boolean: 'and' }
    ])
    expect(builder.getBindings()).toEqual(['foo', 'bar'])
  })

  test('testPrepareValueAndOperator', () => {
    let builder = getBuilder()
    let result = builder.prepareValueAndOperator('>', '20')
    expect(result[0]).toBe('>')
    expect(result[1]).toBe('20')

    builder = getBuilder()
    result = builder.prepareValueAndOperator('>', '20', true)
    expect(result[0]).toBe('20')
    expect(result[1]).toBe('=')
  })

  test('testPrepareValueAndOperatorExpectException', () => {
    const builder = getBuilder()
    expect(() => builder.prepareValueAndOperator(undefined, 'like')).toThrow(
      'Illegal operator and value combination.'
    )
  })

  test('testProvidingNullWithOperatorsBuildsCorrectly', () => {
    let builder = getBuilder()
    builder.select('*').from('users').where('foo', null as unknown as string)
    expect(builder.toSql()).toBe('select * from "users" where "foo" is null')

    builder = getBuilder()
    builder.select('*').from('users').where('foo', '=', null as unknown as string)
    expect(builder.toSql()).toBe('select * from "users" where "foo" is null')

    builder = getBuilder()
    builder.select('*').from('users').where('foo', '!=', null as unknown as string)
    expect(builder.toSql()).toBe('select * from "users" where "foo" is not null')

    builder = getBuilder()
    builder.select('*').from('users').where('foo', '<>', null as unknown as string)
    expect(builder.toSql()).toBe('select * from "users" where "foo" is not null')

    builder = getBuilder()
    builder.select('*').from('users').where('foo', '<=>', null as unknown as string)
    expect(builder.toSql()).toBe('select * from "users" where "foo" is null')
  })

  test('testDynamicWhere', () => {
    const builder = getBuilder()
    const whereSpy = jest.spyOn(builder, 'where').mockReturnValue(builder)

    expect(builder.dynamicWhere('whereFooBarAndBazOrQux', ['corge', 'waldo', 'fred'])).toBe(builder)
    expect(whereSpy).toHaveBeenNthCalledWith(1, 'foo_bar', '=', 'corge', 'and')
    expect(whereSpy).toHaveBeenNthCalledWith(2, 'baz', '=', 'waldo', 'and')
    expect(whereSpy).toHaveBeenNthCalledWith(3, 'qux', '=', 'fred', 'or')
  })

  test('testDynamicWhereIsNotGreedy', () => {
    const builder = getBuilder()
    const whereSpy = jest.spyOn(builder, 'where').mockReturnValue(builder)

    builder.dynamicWhere('whereIosVersionAndAndroidVersionOrOrientation', [
      '6.1',
      '4.2',
      'Vertical'
    ])
    expect(whereSpy).toHaveBeenNthCalledWith(1, 'ios_version', '=', '6.1', 'and')
    expect(whereSpy).toHaveBeenNthCalledWith(2, 'android_version', '=', '4.2', 'and')
    expect(whereSpy).toHaveBeenNthCalledWith(3, 'orientation', '=', 'Vertical', 'or')
  })

  test('testCallTriggersDynamicWhere', () => {
    const builder = getBuilder()

    expect(builder.__call('whereFooAndBar', ['baz', 'qux'])).toBe(builder)
    expect(builder.wheres).toHaveLength(2)
  })

  test('testBuilderThrowsExpectedExceptionWithUndefinedMethod', () => {
    const builder = getBuilder()

    expect(() => builder.__call('noValidMethodHere', [])).toThrow(
      'BadMethodCallException: Call to undefined method Builder::noValidMethodHere()'
    )
  })

  test('testMySqlLock', () => {
    let builder = getMySqlBuilder()
    builder.select('*').from('foo').where('bar', '=', 'baz').lock()
    expect(builder.toSql()).toBe('select * from `foo` where `bar` = ? for update')
    expect(builder.getBindings()).toEqual(['baz'])

    builder = getMySqlBuilder()
    builder.select('*').from('foo').where('bar', '=', 'baz').lock(false)
    expect(builder.toSql()).toBe('select * from `foo` where `bar` = ? lock in share mode')
    expect(builder.getBindings()).toEqual(['baz'])

    builder = getMySqlBuilder()
    builder.select('*').from('foo').where('bar', '=', 'baz').lock('lock in share mode')
    expect(builder.toSql()).toBe('select * from `foo` where `bar` = ? lock in share mode')
    expect(builder.getBindings()).toEqual(['baz'])
  })

  test('testPostgresLock', () => {
    let builder = getPostgresBuilder()
    builder.select('*').from('foo').where('bar', '=', 'baz').lock()
    expect(builder.toSql()).toBe('select * from "foo" where "bar" = ? for update')
    expect(builder.getBindings()).toEqual(['baz'])

    builder = getPostgresBuilder()
    builder.select('*').from('foo').where('bar', '=', 'baz').lock(false)
    expect(builder.toSql()).toBe('select * from "foo" where "bar" = ? for share')
    expect(builder.getBindings()).toEqual(['baz'])

    builder = getPostgresBuilder()
    builder.select('*').from('foo').where('bar', '=', 'baz').lock('for key share')
    expect(builder.toSql()).toBe('select * from "foo" where "bar" = ? for key share')
    expect(builder.getBindings()).toEqual(['baz'])
  })

  test('testSqlServerLock', () => {
    let builder = getSqlServerBuilder()
    builder.select('*').from('foo').where('bar', '=', 'baz').lock()
    expect(builder.toSql()).toBe('select * from [foo] with(rowlock,updlock,holdlock) where [bar] = ?')
    expect(builder.getBindings()).toEqual(['baz'])

    builder = getSqlServerBuilder()
    builder.select('*').from('foo').where('bar', '=', 'baz').lock(false)
    expect(builder.toSql()).toBe('select * from [foo] with(rowlock,holdlock) where [bar] = ?')
    expect(builder.getBindings()).toEqual(['baz'])

    builder = getSqlServerBuilder()
    builder.select('*').from('foo').where('bar', '=', 'baz').lock('with(holdlock)')
    expect(builder.toSql()).toBe('select * from [foo] with(holdlock) where [bar] = ?')
    expect(builder.getBindings()).toEqual(['baz'])
  })

  test('testSelectWithLockUsesWritePdo', async () => {
    let builder = getMySqlBuilderWithProcessor()
    const selectSpy = jest.spyOn(builder.getConnection(), 'select').mockResolvedValue([])

    await builder.select('*').from('foo').where('bar', '=', 'baz').lock().get()
    expect(selectSpy).toHaveBeenCalledWith('select * from `foo` where `bar` = ? for update', ['baz'])

    builder = getMySqlBuilderWithProcessor()
    jest.spyOn(builder.getConnection(), 'select').mockResolvedValue([])

    await builder.select('*').from('foo').where('bar', '=', 'baz').lock(false).get()
    expect(builder.getConnection().select).toHaveBeenCalledWith('select * from `foo` where `bar` = ? lock in share mode', ['baz'])
  })

  test('testBindingOrder', () => {
    const expectedSql =
      'select * from "users" inner join "othertable" on "bar" = ? where "registered" = ? group by "city" having "population" > ? order by match ("foo") against(?)'
    const expectedBindings = ['foo', 1, 3, 'bar']

    let builder = getBuilder()
    builder
      .select('*')
      .from('users')
      .join('othertable', (join: JoinClause) => {
        join.where('bar', '=', 'foo')
      })
      .where('registered', 1)
      .groupBy('city')
      .having('population', '>', 3)
      .orderByRaw('match ("foo") against(?)', ['bar'])
    expect(builder.toSql()).toBe(expectedSql)
    expect(builder.getBindings()).toEqual(expectedBindings)

    builder = getBuilder()
    builder
      .select('*')
      .from('users')
      .orderByRaw('match ("foo") against(?)', ['bar'])
      .having('population', '>', 3)
      .groupBy('city')
      .where('registered', 1)
      .join('othertable', (join: JoinClause) => {
        join.where('bar', '=', 'foo')
      })
    expect(builder.toSql()).toBe(expectedSql)
    expect(builder.getBindings()).toEqual(expectedBindings)
  })

  test('testAddBindingWithArrayMergesBindings', () => {
    const builder = getBuilder()
    builder.addBinding(['foo', 'bar'])
    builder.addBinding(['baz'])
    expect(builder.getBindings()).toEqual(['foo', 'bar', 'baz'])
  })

  test('testAddBindingWithArrayMergesBindingsInCorrectOrder', () => {
    const builder = getBuilder()
    builder.addBinding(['bar', 'baz'], 'having')
    builder.addBinding(['foo'], 'where')
    expect(builder.getBindings()).toEqual(['foo', 'bar', 'baz'])
  })

  test('testAddBindingWithEnum', () => {
    const builder = getBuilder()
    builder.addBinding(IntegerStatus.done)
    builder.addBinding([NonBackedStatus.done])
    expect(builder.getBindings()).toEqual([2, 'done'])
  })

  test('testMergeBuilders', () => {
    const builder = getBuilder()
    builder.addBinding(['foo', 'bar'])
    const otherBuilder = getBuilder()
    otherBuilder.addBinding(['baz'])
    builder.mergeBindings(otherBuilder)
    expect(builder.getBindings()).toEqual(['foo', 'bar', 'baz'])
  })

  test('testMergeBuildersBindingOrder', () => {
    const builder = getBuilder()
    builder.addBinding('foo', 'where')
    builder.addBinding('baz', 'having')
    const otherBuilder = getBuilder()
    otherBuilder.addBinding('bar', 'where')
    builder.mergeBindings(otherBuilder)
    expect(builder.getBindings()).toEqual(['foo', 'bar', 'baz'])
  })

  test('testSubSelect', () => {
    const expectedSql =
      'select "foo", "bar", (select "baz" from "two" where "subkey" = ?) as "sub" from "one" where "key" = ?'
    const expectedBindings = ['subval', 'val']

    let builder = getPostgresBuilder()
    builder.from('one').select(['foo', 'bar']).where('key', '=', 'val')
    builder.selectSub((query: Builder) => {
      query.from('two').select('baz').where('subkey', '=', 'subval')
    }, 'sub')
    expect(builder.toSql()).toBe(expectedSql)
    expect(builder.getBindings()).toEqual(expectedBindings)

    builder = getPostgresBuilder()
    builder.from('one').select(['foo', 'bar']).where('key', '=', 'val')
    const subBuilder = getPostgresBuilder()
    subBuilder.from('two').select('baz').where('subkey', '=', 'subval')
    builder.selectSub(subBuilder, 'sub')
    expect(builder.toSql()).toBe(expectedSql)
    expect(builder.getBindings()).toEqual(expectedBindings)

    builder = getPostgresBuilder()
    expect(() => builder.selectSub(['foo'] as unknown as string, 'sub')).toThrow(
      'InvalidArgumentException: A subquery must be a query builder instance, a Closure, or a string.'
    )
  })

  test('testSubSelectResetBindings', () => {
    const builder = getPostgresBuilder()
    builder.from('one').selectSub((query: Builder) => {
      query.from('two').select('baz').where('subkey', '=', 'subval')
    }, 'sub')

    expect(builder.toSql()).toBe(
      'select (select "baz" from "two" where "subkey" = ?) as "sub" from "one"'
    )
    expect(builder.getBindings()).toEqual(['subval'])

    builder.select('*')

    expect(builder.toSql()).toBe('select * from "one"')
    expect(builder.getBindings()).toEqual([])
  })

  test('testSelectExpression', () => {
    const builder = getBuilder()
    builder
      .from('one')
      .selectExpression(new Raw('1 + 1'), 'expr')
      .selectExpression('2 + 2', 'expr2')

    expect(builder.toSql()).toBe(
      'select (1 + 1) as "expr", (2 + 2) as "expr2" from "one"'
    )
  })

  test('testSelect', () => {
    const builder = getBuilder()
    builder.from('one').select({
      0: 'two',
      three: 'threee as threeee',
      four: getBuilder().from('tbl').select('col'),
      five: new Raw('1 + 1')
    })

    expect(builder.toSql()).toBe(
      'select "two", "threee" as "threeee", (select "col" from "tbl") as "four", 1 + 1 from "one"'
    )
  })

  test('testSqlServerWhereDate', () => {
    const builder = getSqlServerBuilder()
    builder.select('*').from('users').whereDate('created_at', '=', '2015-09-23')
    expect(builder.toSql()).toBe(
      'select * from [users] where cast([created_at] as date) = ?'
    )
    expect(builder.getBindings()).toEqual(['2015-09-23'])
  })

  test('testUppercaseLeadingBooleansAreRemoved', () => {
    const builder = getBuilder()
    builder.select('*').from('users').where('name', '=', 'Alvaro', 'AND' as 'and')
    expect(builder.toSql()).toBe('select * from "users" where "name" = ?')
  })

  test('testLowercaseLeadingBooleansAreRemoved', () => {
    const builder = getBuilder()
    builder.select('*').from('users').where('name', '=', 'Alvaro', 'and')
    expect(builder.toSql()).toBe('select * from "users" where "name" = ?')
  })

  test('testCaseInsensitiveLeadingBooleansAreRemoved', () => {
    const builder = getBuilder()
    builder.select('*').from('users').where('name', '=', 'Alvaro', 'And' as 'and')
    expect(builder.toSql()).toBe('select * from "users" where "name" = ?')
  })

  test('testTableValuedFunctionAsTableInSqlServer', () => {
    let builder = getSqlServerBuilder()
    builder.select('*').from('users()')
    expect(builder.toSql()).toBe('select * from [users]()')

    builder = getSqlServerBuilder()
    builder.select('*').from('users(1,2)')
    expect(builder.toSql()).toBe('select * from [users](1,2)')
  })

  test('testChunkWithLastChunkComplete', async () => {
    const builder = getMockQueryBuilder()
    builder.orders.push({ column: 'foobar', direction: 'asc' })
    jest.spyOn(builder, 'clone').mockReturnValue(builder)

    const chunk1 = collect(['foo1', 'foo2'])
    const chunk2 = collect(['foo3', 'foo4'])
    const chunk3 = collect([])

    jest.spyOn(builder, 'getOffset').mockReturnValue(undefined)
    jest.spyOn(builder, 'getLimit').mockReturnValue(undefined)
    const offsetSpy = jest.spyOn(builder, 'offset').mockReturnValue(builder)
    const limitSpy = jest.spyOn(builder, 'limit').mockReturnValue(builder)
    const getSpy = jest
      .spyOn(builder, 'get')
      .mockResolvedValueOnce(chunk1)
      .mockResolvedValueOnce(chunk2)
      .mockResolvedValueOnce(chunk3)

    const callbackAssertor = { doSomething: jest.fn() }

    await builder.chunk(2, (results) => {
      callbackAssertor.doSomething(results)
    })

    expect(offsetSpy).toHaveBeenNthCalledWith(1, 0)
    expect(offsetSpy).toHaveBeenNthCalledWith(2, 2)
    expect(offsetSpy).toHaveBeenNthCalledWith(3, 4)
    expect(limitSpy).toHaveBeenCalledTimes(3)
    expect(limitSpy).toHaveBeenCalledWith(2)
    expect(getSpy).toHaveBeenCalledTimes(3)
    expect(callbackAssertor.doSomething).toHaveBeenCalledWith(chunk1)
    expect(callbackAssertor.doSomething).toHaveBeenCalledWith(chunk2)
    expect(callbackAssertor.doSomething).not.toHaveBeenCalledWith(chunk3)
  })

  test('testChunkWithLastChunkPartial', async () => {
    const builder = getMockQueryBuilder()
    builder.orders.push({ column: 'foobar', direction: 'asc' })
    jest.spyOn(builder, 'clone').mockReturnValue(builder)

    const chunk1 = collect(['foo1', 'foo2'])
    const chunk2 = collect(['foo3'])

    jest.spyOn(builder, 'getOffset').mockReturnValue(undefined)
    jest.spyOn(builder, 'getLimit').mockReturnValue(undefined)
    jest.spyOn(builder, 'offset').mockReturnValue(builder)
    jest.spyOn(builder, 'limit').mockReturnValue(builder)
    jest
      .spyOn(builder, 'get')
      .mockResolvedValueOnce(chunk1)
      .mockResolvedValueOnce(chunk2)

    const callbackAssertor = { doSomething: jest.fn() }

    await builder.chunk(2, (results) => {
      callbackAssertor.doSomething(results)
    })

    expect(callbackAssertor.doSomething).toHaveBeenCalledWith(chunk1)
    expect(callbackAssertor.doSomething).toHaveBeenCalledWith(chunk2)
  })

  test('testChunkCanBeStoppedByReturningFalse', async () => {
    const builder = getMockQueryBuilder()
    builder.orders.push({ column: 'foobar', direction: 'asc' })
    jest.spyOn(builder, 'clone').mockReturnValue(builder)

    const chunk1 = collect(['foo1', 'foo2'])
    const chunk2 = collect(['foo3'])

    jest.spyOn(builder, 'getOffset').mockReturnValue(undefined)
    jest.spyOn(builder, 'getLimit').mockReturnValue(undefined)
    jest.spyOn(builder, 'offset').mockReturnValue(builder)
    jest.spyOn(builder, 'limit').mockReturnValue(builder)
    jest.spyOn(builder, 'get').mockResolvedValueOnce(chunk1)

    const callbackAssertor = { doSomething: jest.fn() }

    await builder.chunk(2, (results) => {
      callbackAssertor.doSomething(results)

      return false
    })

    expect(callbackAssertor.doSomething).toHaveBeenCalledWith(chunk1)
    expect(callbackAssertor.doSomething).not.toHaveBeenCalledWith(chunk2)
  })

  test('testChunkWithCountZero', async () => {
    const builder = getMockQueryBuilder()
    builder.orders.push({ column: 'foobar', direction: 'asc' })
    jest.spyOn(builder, 'clone').mockReturnValue(builder)

    jest.spyOn(builder, 'getOffset').mockReturnValue(undefined)
    jest.spyOn(builder, 'getLimit').mockReturnValue(undefined)
    const offsetSpy = jest.spyOn(builder, 'offset')
    const limitSpy = jest.spyOn(builder, 'limit')
    const getSpy = jest.spyOn(builder, 'get')

    await builder.chunk(0, () => {
      throw new Error('Should never be called.')
    })

    expect(offsetSpy).not.toHaveBeenCalled()
    expect(limitSpy).not.toHaveBeenCalled()
    expect(getSpy).not.toHaveBeenCalled()
  })

  test('testChunkByIdOnArrays', async () => {
    const builder = getMockQueryBuilder()
    builder.orders.push({ column: 'foobar', direction: 'asc' })
    jest.spyOn(builder, 'clone').mockReturnValue(builder)

    const chunk1 = collect([
      { someIdField: 1 },
      { someIdField: 2 }
    ])
    const chunk2 = collect([
      { someIdField: 10 },
      { someIdField: 11 }
    ])
    const chunk3 = collect([])

    const forPageAfterIdSpy = jest.spyOn(builder, 'forPageAfterId').mockReturnValue(builder)
    jest
      .spyOn(builder, 'get')
      .mockResolvedValueOnce(chunk1)
      .mockResolvedValueOnce(chunk2)
      .mockResolvedValueOnce(chunk3)

    const callbackAssertor = { doSomething: jest.fn() }

    await builder.chunkById(2, (results) => {
      callbackAssertor.doSomething(results)
    }, 'someIdField')

    expect(forPageAfterIdSpy).toHaveBeenNthCalledWith(1, 2, undefined, 'someIdField')
    expect(forPageAfterIdSpy).toHaveBeenNthCalledWith(2, 2, 2, 'someIdField')
    expect(forPageAfterIdSpy).toHaveBeenNthCalledWith(3, 2, 11, 'someIdField')
    expect(callbackAssertor.doSomething).toHaveBeenCalledWith(chunk1)
    expect(callbackAssertor.doSomething).toHaveBeenCalledWith(chunk2)
    expect(callbackAssertor.doSomething).not.toHaveBeenCalledWith(chunk3)
  })

  test('testChunkPaginatesUsingIdWithLastChunkComplete', async () => {
    const builder = getMockQueryBuilder()
    builder.orders.push({ column: 'foobar', direction: 'asc' })
    jest.spyOn(builder, 'clone').mockReturnValue(builder)

    const chunk1 = collect([
      { someIdField: 1 },
      { someIdField: 2 }
    ])
    const chunk2 = collect([
      { someIdField: 10 },
      { someIdField: 11 }
    ])
    const chunk3 = collect([])

    const forPageAfterIdSpy = jest.spyOn(builder, 'forPageAfterId').mockReturnValue(builder)
    jest
      .spyOn(builder, 'get')
      .mockResolvedValueOnce(chunk1)
      .mockResolvedValueOnce(chunk2)
      .mockResolvedValueOnce(chunk3)

    const callbackAssertor = { doSomething: jest.fn() }

    await builder.chunkById(2, (results) => {
      callbackAssertor.doSomething(results)
    }, 'someIdField')

    expect(forPageAfterIdSpy).toHaveBeenNthCalledWith(1, 2, undefined, 'someIdField')
    expect(forPageAfterIdSpy).toHaveBeenNthCalledWith(2, 2, 2, 'someIdField')
    expect(forPageAfterIdSpy).toHaveBeenNthCalledWith(3, 2, 11, 'someIdField')
    expect(callbackAssertor.doSomething).toHaveBeenCalledWith(chunk1)
    expect(callbackAssertor.doSomething).toHaveBeenCalledWith(chunk2)
    expect(callbackAssertor.doSomething).not.toHaveBeenCalledWith(chunk3)
  })

  test('testChunkPaginatesUsingIdWithLastChunkPartial', async () => {
    const builder = getMockQueryBuilder()
    builder.orders.push({ column: 'foobar', direction: 'asc' })
    jest.spyOn(builder, 'clone').mockReturnValue(builder)

    const chunk1 = collect([
      { someIdField: 1 },
      { someIdField: 2 }
    ])
    const chunk2 = collect([{ someIdField: 10 }])

    jest.spyOn(builder, 'forPageAfterId').mockReturnValue(builder)
    jest
      .spyOn(builder, 'get')
      .mockResolvedValueOnce(chunk1)
      .mockResolvedValueOnce(chunk2)

    const callbackAssertor = { doSomething: jest.fn() }

    await builder.chunkById(2, (results) => {
      callbackAssertor.doSomething(results)
    }, 'someIdField')

    expect(callbackAssertor.doSomething).toHaveBeenCalledWith(chunk1)
    expect(callbackAssertor.doSomething).toHaveBeenCalledWith(chunk2)
  })

  test('testChunkPaginatesUsingIdWithCountZero', async () => {
    const builder = getMockQueryBuilder()
    builder.orders.push({ column: 'foobar', direction: 'asc' })

    const forPageAfterIdSpy = jest.spyOn(builder, 'forPageAfterId')
    const getSpy = jest.spyOn(builder, 'get')

    await builder.chunkById(0, () => {
      throw new Error('Should never be called.')
    }, 'someIdField')

    expect(forPageAfterIdSpy).not.toHaveBeenCalled()
    expect(getSpy).not.toHaveBeenCalled()
  })

  test('testChunkPaginatesUsingIdWithAlias', async () => {
    const builder = getMockQueryBuilder()
    builder.orders.push({ column: 'foobar', direction: 'asc' })
    jest.spyOn(builder, 'clone').mockReturnValue(builder)

    const chunk1 = collect([
      { table_id: 1 },
      { table_id: 10 }
    ])
    const chunk2 = collect([])

    const forPageAfterIdSpy = jest.spyOn(builder, 'forPageAfterId').mockReturnValue(builder)
    jest.spyOn(builder, 'get').mockResolvedValueOnce(chunk1).mockResolvedValueOnce(chunk2)

    const callbackAssertor = { doSomething: jest.fn() }

    await builder.chunkById(2, (results) => {
      callbackAssertor.doSomething(results)
    }, 'table.id', 'table_id')

    expect(forPageAfterIdSpy).toHaveBeenNthCalledWith(1, 2, undefined, 'table.id')
    expect(forPageAfterIdSpy).toHaveBeenNthCalledWith(2, 2, 10, 'table.id')
    expect(callbackAssertor.doSomething).toHaveBeenCalledWith(chunk1)
    expect(callbackAssertor.doSomething).not.toHaveBeenCalledWith(chunk2)
  })

  test('testChunkPaginatesUsingIdDesc', async () => {
    const builder = getMockQueryBuilder()
    builder.orders.push({ column: 'foobar', direction: 'desc' })
    jest.spyOn(builder, 'clone').mockReturnValue(builder)

    const chunk1 = collect([
      { someIdField: 10 },
      { someIdField: 1 }
    ])
    const chunk2 = collect([])

    const forPageBeforeIdSpy = jest.spyOn(builder, 'forPageBeforeId').mockReturnValue(builder)
    jest.spyOn(builder, 'get').mockResolvedValueOnce(chunk1).mockResolvedValueOnce(chunk2)

    const callbackAssertor = { doSomething: jest.fn() }

    await builder.chunkByIdDesc(2, (results) => {
      callbackAssertor.doSomething(results)
    }, 'someIdField')

    expect(forPageBeforeIdSpy).toHaveBeenNthCalledWith(1, 2, undefined, 'someIdField')
    expect(forPageBeforeIdSpy).toHaveBeenNthCalledWith(2, 2, 1, 'someIdField')
    expect(callbackAssertor.doSomething).toHaveBeenCalledWith(chunk1)
    expect(callbackAssertor.doSomething).not.toHaveBeenCalledWith(chunk2)
  })

  test('testPaginate', async () => {
    const perPage = 16
    const columns = ['test']
    const pageName = 'page-name'
    const page = 1
    const builder = getMockQueryBuilder()
    const path = 'http://foo.bar?page=3'

    const results = collect([{ test: 'foo' }, { test: 'bar' }])

    jest.spyOn(builder, 'getCountForPagination').mockResolvedValue(2)
    jest.spyOn(builder, 'forPage').mockReturnValue(builder)
    jest.spyOn(builder, 'get').mockResolvedValue(results)

    Paginator.currentPathResolver(() => path)

    const result = await builder.paginate(perPage, columns, pageName, page)

    expect(result).toBeInstanceOf(LengthAwarePaginator)
    expect(result.total()).toBe(2)
    expect(result.itemsCollection().all()).toEqual(results.all())
    // Paginator.clearResolvers()
  })

  test('testPaginateWithDefaultArguments', async () => {
    const perPage = 15
    const page = 1
    const builder = getMockQueryBuilder()
    const path = 'http://foo.bar?page=3'
    const results = collect([{ test: 'foo' }, { test: 'bar' }])

    jest.spyOn(builder, 'getCountForPagination').mockResolvedValue(2)
    jest.spyOn(builder, 'forPage').mockReturnValue(builder)
    jest.spyOn(builder, 'get').mockResolvedValue(results)

    Paginator.currentPageResolver(() => 1)
    Paginator.currentPathResolver(() => path)

    const result = await builder.paginate()

    expect(result.total()).toBe(2)
    expect(result.itemsCollection().all()).toEqual(results.all())
    expect(builder.forPage).toHaveBeenCalledWith(page, perPage)
  })

  test('testPaginateWhenNoResults', async () => {
    const builder = getMockQueryBuilder()
    const path = 'http://foo.bar?page=3'

    jest.spyOn(builder, 'getCountForPagination').mockResolvedValue(0)
    const forPageSpy = jest.spyOn(builder, 'forPage')
    const getSpy = jest.spyOn(builder, 'get')

    Paginator.currentPageResolver(() => 1)
    Paginator.currentPathResolver(() => path)

    const result = await builder.paginate()

    expect(result.total()).toBe(0)
    expect(forPageSpy).not.toHaveBeenCalled()
    expect(getSpy).not.toHaveBeenCalled()
  })

  test('testPaginateWithSpecificColumns', async () => {
    const perPage = 16
    const columns = ['id', 'name']
    const pageName = 'page-name'
    const page = 1
    const builder = getMockQueryBuilder()
    const path = 'http://foo.bar?page=3'
    const results = collect([
      { id: 3, name: 'Alvaro' },
      { id: 5, name: 'Mohamed' }
    ])

    jest.spyOn(builder, 'getCountForPagination').mockResolvedValue(2)
    jest.spyOn(builder, 'forPage').mockReturnValue(builder)
    jest.spyOn(builder, 'get').mockResolvedValue(results)

    Paginator.currentPathResolver(() => path)

    const result = await builder.paginate(perPage, columns, pageName, page)

    expect(result.total()).toBe(2)
    expect(result.itemsCollection().all()).toEqual(results.all())
  })

  test('testPaginateWithTotalOverride', async () => {
    const perPage = 16
    const columns = ['id', 'name']
    const pageName = 'page-name'
    const page = 1
    const builder = getMockQueryBuilder()
    const path = 'http://foo.bar?page=3'
    const results = collect([
      { id: 3, name: 'Alvaro' },
      { id: 5, name: 'Alice' }
    ])

    const countSpy = jest.spyOn(builder, 'getCountForPagination')
    jest.spyOn(builder, 'forPage').mockReturnValue(builder)
    jest.spyOn(builder, 'get').mockResolvedValue(results)

    Paginator.currentPathResolver(() => path)

    const result = await builder.paginate(perPage, columns, pageName, page, 10)

    expect(countSpy).not.toHaveBeenCalled()
    expect(result.total()).toBe(10)
  })

  test('testCursorPaginate', async () => {
    const perPage = 16
    const columns = ['test']
    const cursorName = 'cursor-name'
    const cursor = new Cursor({ test: 'bar' })
    const builder = getMockQueryBuilder()
    builder.from('foobar').orderBy('test')
    jest.spyOn(builder, 'newQuery').mockImplementation(() => {
      return getBuilder()
    })

    const path = `http://foo.bar?cursor=${cursor.encode()}`
    const results = collect([{ test: 'foo' }, { test: 'bar' }])

    jest.spyOn(builder, 'get').mockImplementation(async () => {
      expect(builder.toSql()).toBe(
        'select * from "foobar" where ("test" > ?) order by "test" asc limit 17'
      )
      expect(builder.getRawBindings().where).toEqual(['bar'])

      return results
    })

    Paginator.currentPathResolver(() => path)

    const result = await builder.cursorPaginate(
      perPage,
      columns,
      cursorName,
      cursor
    )

    expect(result).toEqual(
      new CursorPaginator(results, perPage, cursor, {
        path,
        cursorName,
        parameters: ['test']
      })
    )
  })

  test('testCursorPaginateMultipleOrderColumns', async () => {
    const perPage = 16
    const columns = ['test', 'another']
    const cursorName = 'cursor-name'
    const cursor = new Cursor({ test: 'bar', another: 'foo' })
    const builder = getMockQueryBuilder()
    builder.from('foobar').orderBy('test').orderBy('another')
    jest.spyOn(builder, 'newQuery').mockImplementation(() => getBuilder())

    const path = `http://foo.bar?cursor=${cursor.encode()}`
    const results = collect([
      { test: 'foo', another: 1 },
      { test: 'bar', another: 2 }
    ])

    jest.spyOn(builder, 'get').mockImplementation(async () => {
      expect(builder.toSql()).toBe(
        'select * from "foobar" where ("test" > ? or ("test" = ? and ("another" > ?))) order by "test" asc, "another" asc limit 17'
      )
      expect(builder.getRawBindings().where).toEqual(['bar', 'bar', 'foo'])

      return results
    })

    Paginator.currentPathResolver(() => path)

    const result = await builder.cursorPaginate(
      perPage,
      columns,
      cursorName,
      cursor
    )

    expect(result).toEqual(
      new CursorPaginator(results, perPage, cursor, {
        path,
        cursorName,
        parameters: ['test', 'another']
      })
    )
  })

  test('testCursorPaginateWithDefaultArguments', async () => {
    const perPage = 15
    const cursorName = 'cursor'
    const cursor = new Cursor({ test: 'bar' })
    const builder = getMockQueryBuilder()
    builder.from('foobar').orderBy('test')
    jest.spyOn(builder, 'newQuery').mockImplementation(() => getBuilder())

    const path = `http://foo.bar?cursor=${cursor.encode()}`
    const results = collect([{ test: 'foo' }, { test: 'bar' }])

    jest.spyOn(builder, 'get').mockImplementation(async () => {
      expect(builder.toSql()).toBe(
        'select * from "foobar" where ("test" > ?) order by "test" asc limit 16'
      )
      expect(builder.getRawBindings().where).toEqual(['bar'])

      return results
    })

    CursorPaginator.currentCursorResolver(() => cursor)
    Paginator.currentPathResolver(() => path)

    const result = await builder.cursorPaginate()

    expect(result).toEqual(
      new CursorPaginator(results, perPage, cursor, {
        path,
        cursorName,
        parameters: ['test']
      })
    )
  })

  test('testCursorPaginateWhenNoResults', async () => {
    const perPage = 15
    const cursorName = 'cursor'
    const builder = getMockQueryBuilder().orderBy('test')
    const path = 'http://foo.bar?cursor=3'
    const results: Array<Record<string, unknown>> = []

    jest.spyOn(builder, 'get').mockResolvedValue(results)

    CursorPaginator.currentCursorResolver(() => undefined)
    Paginator.currentPathResolver(() => path)

    const result = await builder.cursorPaginate()

    expect(result).toEqual(
      new CursorPaginator(results, perPage, undefined, {
        path,
        cursorName,
        parameters: ['test']
      })
    )
  })

  test('testCursorPaginateWithSpecificColumns', async () => {
    const perPage = 16
    const columns = ['id', 'name']
    const cursorName = 'cursor-name'
    const cursor = new Cursor({ id: 2 })
    const builder = getMockQueryBuilder()
    builder.from('foobar').orderBy('id')
    jest.spyOn(builder, 'newQuery').mockImplementation(() => getBuilder())

    const path = 'http://foo.bar?cursor=3'
    const results = collect([
      { id: 3, name: 'Taylor' },
      { id: 5, name: 'Mohamed' }
    ])

    jest.spyOn(builder, 'get').mockImplementation(async () => {
      expect(builder.toSql()).toBe(
        'select * from "foobar" where ("id" > ?) order by "id" asc limit 17'
      )
      expect(builder.getRawBindings().where).toEqual([2])

      return results
    })

    Paginator.currentPathResolver(() => path)

    const result = await builder.cursorPaginate(
      perPage,
      columns,
      cursorName,
      cursor
    )

    expect(result).toEqual(
      new CursorPaginator(results, perPage, cursor, {
        path,
        cursorName,
        parameters: ['id']
      })
    )
  })

  test('testCursorPaginateWithMixedOrders', async () => {
    const perPage = 16
    const columns = ['foo', 'bar', 'baz']
    const cursorName = 'cursor-name'
    const cursor = new Cursor({ foo: 1, bar: 2, baz: 3 })
    const builder = getMockQueryBuilder()
    builder
      .from('foobar')
      .orderBy('foo')
      .orderByDesc('bar')
      .orderBy('baz')
    jest.spyOn(builder, 'newQuery').mockImplementation(() => getBuilder())

    const path = `http://foo.bar?cursor=${cursor.encode()}`
    const results = collect([
      { foo: 1, bar: 2, baz: 4 },
      { foo: 1, bar: 1, baz: 1 }
    ])

    jest.spyOn(builder, 'get').mockImplementation(async () => {
      expect(builder.toSql()).toBe(
        'select * from "foobar" where ("foo" > ? or ("foo" = ? and ("bar" < ? or ("bar" = ? and ("baz" > ?))))) order by "foo" asc, "bar" desc, "baz" asc limit 17'
      )
      expect(builder.getRawBindings().where).toEqual([1, 1, 2, 2, 3])

      return results
    })

    Paginator.currentPathResolver(() => path)

    const result = await builder.cursorPaginate(
      perPage,
      columns,
      cursorName,
      cursor
    )

    expect(result).toEqual(
      new CursorPaginator(results, perPage, cursor, {
        path,
        cursorName,
        parameters: ['foo', 'bar', 'baz']
      })
    )
  })

  test('testCursorPaginateWithDynamicColumnInSelectRaw', async () => {
    const perPage = 15
    const cursorName = 'cursor'
    const cursor = new Cursor({ test: 'bar' })
    const builder = getMockQueryBuilder()
    builder
      .from('foobar')
      .select('*')
      .selectRaw("(CONCAT(firstname, ' ', lastname)) as test")
      .orderBy('test')
    jest.spyOn(builder, 'newQuery').mockImplementation(() => getBuilder())

    const path = `http://foo.bar?cursor=${cursor.encode()}`
    const results = collect([{ test: 'foo' }, { test: 'bar' }])

    jest.spyOn(builder, 'get').mockImplementation(async () => {
      expect(builder.toSql()).toBe(
        "select *, (CONCAT(firstname, ' ', lastname)) as test from \"foobar\" where ((CONCAT(firstname, ' ', lastname)) > ?) order by \"test\" asc limit 16"
      )
      expect(builder.getRawBindings().where).toEqual(['bar'])

      return results
    })

    CursorPaginator.currentCursorResolver(() => cursor)
    Paginator.currentPathResolver(() => path)

    const result = await builder.cursorPaginate()

    expect(result).toEqual(
      new CursorPaginator(results, perPage, cursor, {
        path,
        cursorName,
        parameters: ['test']
      })
    )
  })

  test('testCursorPaginateWithDynamicColumnWithCastInSelectRaw', async () => {
    const perPage = 15
    const cursorName = 'cursor'
    const cursor = new Cursor({ test: 'bar' })
    const builder = getMockQueryBuilder()
    builder
      .from('foobar')
      .select('*')
      .selectRaw(
        "(CAST(CONCAT(firstname, ' ', lastname) as VARCHAR)) as test"
      )
      .orderBy('test')
    jest.spyOn(builder, 'newQuery').mockImplementation(() => getBuilder())

    const path = `http://foo.bar?cursor=${cursor.encode()}`
    const results = collect([{ test: 'foo' }, { test: 'bar' }])

    jest.spyOn(builder, 'get').mockImplementation(async () => {
      expect(builder.toSql()).toBe(
        "select *, (CAST(CONCAT(firstname, ' ', lastname) as VARCHAR)) as test from \"foobar\" where ((CAST(CONCAT(firstname, ' ', lastname) as VARCHAR)) > ?) order by \"test\" asc limit 16"
      )
      expect(builder.getRawBindings().where).toEqual(['bar'])

      return results
    })

    CursorPaginator.currentCursorResolver(() => cursor)
    Paginator.currentPathResolver(() => path)

    const result = await builder.cursorPaginate()

    expect(result).toEqual(
      new CursorPaginator(results, perPage, cursor, {
        path,
        cursorName,
        parameters: ['test']
      })
    )
  })

  test('testCursorPaginateWithDynamicColumnInSelectSub', async () => {
    const perPage = 15
    const cursorName = 'cursor'
    const cursor = new Cursor({ test: 'bar' })
    const builder = getMockQueryBuilder()
    builder
      .from('foobar')
      .select('*')
      .selectSub("CONCAT(firstname, ' ', lastname)", 'test')
      .orderBy('test')
    jest.spyOn(builder, 'newQuery').mockImplementation(() => getBuilder())

    const path = `http://foo.bar?cursor=${cursor.encode()}`
    const results = collect([{ test: 'foo' }, { test: 'bar' }])

    jest.spyOn(builder, 'get').mockImplementation(async () => {
      expect(builder.toSql()).toBe(
        "select *, (CONCAT(firstname, ' ', lastname)) as \"test\" from \"foobar\" where ((CONCAT(firstname, ' ', lastname)) > ?) order by \"test\" asc limit 16"
      )
      expect(builder.getRawBindings().where).toEqual(['bar'])

      return results
    })

    CursorPaginator.currentCursorResolver(() => cursor)
    Paginator.currentPathResolver(() => path)

    const result = await builder.cursorPaginate()

    expect(result).toEqual(
      new CursorPaginator(results, perPage, cursor, {
        path,
        cursorName,
        parameters: ['test']
      })
    )
  })

  test('testCursorPaginateWithUnionWheres', async () => {
    const ts = '2024-01-15 12:00:00'
    const perPage = 16
    const columns = ['test']
    const cursorName = 'cursor-name'
    const cursor = new Cursor({ created_at: ts })
    const builder = getMockQueryBuilder()
    builder
      .select('id', 'start_time as created_at')
      .selectRaw("'video' as type")
      .from('videos')
    builder.union(
      getBuilder()
        .select('id', 'created_at')
        .selectRaw("'news' as type")
        .from('news')
    )
    builder.orderBy('created_at')
    jest.spyOn(builder, 'newQuery').mockImplementation(() => getBuilder())

    const path = `http://foo.bar?cursor=${cursor.encode()}`
    const results = collect([
      { id: 1, created_at: Carbon.now(), type: 'video' },
      { id: 2, created_at: Carbon.now(), type: 'news' }
    ])

    jest.spyOn(builder, 'get').mockImplementation(async () => {
      expect(builder.toSql()).toBe(
        '(select "id", "start_time" as "created_at", \'video\' as type from "videos" where ("start_time" > ?)) union (select "id", "created_at", \'news\' as type from "news" where ("created_at" > ?)) order by "created_at" asc limit 17'
      )
      expect(builder.getRawBindings().where).toEqual([ts])
      expect(builder.getRawBindings().union).toEqual([ts])

      return results
    })

    Paginator.currentPathResolver(() => path)

    const result = await builder.cursorPaginate(
      perPage,
      columns,
      cursorName,
      cursor
    )

    expect(result).toEqual(
      new CursorPaginator(results, perPage, cursor, {
        path,
        cursorName,
        parameters: ['created_at']
      })
    )
  })

  test('testCursorPaginateWithMultipleUnionsAndMultipleWheres', async () => {
    const ts = '2024-01-15 12:00:00'
    const perPage = 16
    const columns = ['test']
    const cursorName = 'cursor-name'
    const cursor = new Cursor({ created_at: ts })
    const builder = getMockQueryBuilder()
    builder
      .select('id', 'start_time as created_at')
      .selectRaw("'video' as type")
      .from('videos')
    builder.union(
      getBuilder()
        .select('id', 'created_at')
        .selectRaw("'news' as type")
        .from('news')
        .where('extra', 'first')
    )
    builder.union(
      getBuilder()
        .select('id', 'created_at')
        .selectRaw("'podcast' as type")
        .from('podcasts')
        .where('extra', 'second')
    )
    builder.orderBy('created_at')
    jest.spyOn(builder, 'newQuery').mockImplementation(() => getBuilder())

    const path = `http://foo.bar?cursor=${cursor.encode()}`
    const results = collect([
      { id: 1, created_at: Carbon.now(), type: 'video' },
      { id: 2, created_at: Carbon.now(), type: 'news' },
      { id: 3, created_at: Carbon.now(), type: 'podcasts' }
    ])

    jest.spyOn(builder, 'get').mockImplementation(async () => {
      expect(builder.toSql()).toBe(
        '(select "id", "start_time" as "created_at", \'video\' as type from "videos" where ("start_time" > ?)) union (select "id", "created_at", \'news\' as type from "news" where "extra" = ? and ("created_at" > ?)) union (select "id", "created_at", \'podcast\' as type from "podcasts" where "extra" = ? and ("created_at" > ?)) order by "created_at" asc limit 17'
      )
      expect(builder.getRawBindings().where).toEqual([ts])
      expect(builder.getRawBindings().union).toEqual(['first', ts, 'second', ts])

      return results
    })

    Paginator.currentPathResolver(() => path)

    const result = await builder.cursorPaginate(
      perPage,
      columns,
      cursorName,
      cursor
    )

    expect(result).toEqual(
      new CursorPaginator(results, perPage, cursor, {
        path,
        cursorName,
        parameters: ['created_at']
      })
    )
  })

  test('testCursorPaginateWithUnionMultipleWheresMultipleOrders', async () => {
    const ts = '2024-01-15 12:00:00'
    const perPage = 16
    const columns = ['id', 'created_at', 'type']
    const cursorName = 'cursor-name'
    const cursor = new Cursor({ id: 1, created_at: ts, type: 'news' })
    const builder = getMockQueryBuilder()
    builder
      .select('id', 'start_time as created_at', 'type')
      .from('videos')
      .where('extra', 'first')
    builder.union(
      getBuilder()
        .select('id', 'created_at', 'type')
        .from('news')
        .where('extra', 'second')
    )
    builder.union(
      getBuilder()
        .select('id', 'created_at', 'type')
        .from('podcasts')
        .where('extra', 'third')
    )
    builder.orderBy('id').orderByDesc('created_at').orderBy('type')
    jest.spyOn(builder, 'newQuery').mockImplementation(() => getBuilder())

    const path = `http://foo.bar?cursor=${cursor.encode()}`
    const results = collect([
      { id: 1, created_at: Carbon.now().addDay(), type: 'video' },
      { id: 1, created_at: Carbon.now(), type: 'news' },
      { id: 1, created_at: Carbon.now(), type: 'podcast' },
      { id: 2, created_at: Carbon.now(), type: 'podcast' }
    ])

    jest.spyOn(builder, 'get').mockImplementation(async () => {
      expect(builder.toSql()).toBe(
        '(select "id", "start_time" as "created_at", "type" from "videos" where "extra" = ? and ("id" > ? or ("id" = ? and ("start_time" < ? or ("start_time" = ? and ("type" > ?)))))) union (select "id", "created_at", "type" from "news" where "extra" = ? and ("id" > ? or ("id" = ? and ("start_time" < ? or ("start_time" = ? and ("type" > ?)))))) union (select "id", "created_at", "type" from "podcasts" where "extra" = ? and ("id" > ? or ("id" = ? and ("start_time" < ? or ("start_time" = ? and ("type" > ?)))))) order by "id" asc, "created_at" desc, "type" asc limit 17'
      )
      expect(builder.getRawBindings().where).toEqual([
        'first',
        1,
        1,
        ts,
        ts,
        'news'
      ])
      expect(builder.getRawBindings().union).toEqual([
        'second',
        1,
        1,
        ts,
        ts,
        'news',
        'third',
        1,
        1,
        ts,
        ts,
        'news'
      ])

      return results
    })

    Paginator.currentPathResolver(() => path)

    const result = await builder.cursorPaginate(
      perPage,
      columns,
      cursorName,
      cursor
    )

    expect(result).toEqual(
      new CursorPaginator(results, perPage, cursor, {
        path,
        cursorName,
        parameters: ['id', 'created_at', 'type']
      })
    )
  })

  test('testCursorPaginateWithUnionWheresWithRawOrderExpression', async () => {
    const ts = '2024-01-15 12:00:00'
    const perPage = 16
    const columns = ['test']
    const cursorName = 'cursor-name'
    const cursor = new Cursor({ created_at: ts })
    const builder = getMockQueryBuilder()
    builder
      .select('id', 'is_published', 'start_time as created_at')
      .selectRaw("'video' as type")
      .where('is_published', true)
      .from('videos')
    builder.union(
      getBuilder()
        .select('id', 'is_published', 'created_at')
        .selectRaw("'news' as type")
        .where('is_published', true)
        .from('news')
    )
    builder
      .orderByRaw('case when (id = 3 and type="news" then 0 else 1 end)')
      .orderBy('created_at')
    jest.spyOn(builder, 'newQuery').mockImplementation(() => getBuilder())

    const path = `http://foo.bar?cursor=${cursor.encode()}`
    const results = collect([
      {
        id: 1,
        created_at: Carbon.now(),
        type: 'video',
        is_published: true
      },
      {
        id: 2,
        created_at: Carbon.now(),
        type: 'news',
        is_published: true
      }
    ])

    jest.spyOn(builder, 'get').mockImplementation(async () => {
      expect(builder.toSql()).toBe(
        '(select "id", "is_published", "start_time" as "created_at", \'video\' as type from "videos" where "is_published" = ? and ("start_time" > ?)) union (select "id", "is_published", "created_at", \'news\' as type from "news" where "is_published" = ? and ("created_at" > ?)) order by case when (id = 3 and type="news" then 0 else 1 end), "created_at" asc limit 17'
      )
      expect(builder.getRawBindings().where).toEqual([true, ts])
      expect(builder.getRawBindings().union).toEqual([true, ts])

      return results
    })

    Paginator.currentPathResolver(() => path)

    const result = await builder.cursorPaginate(
      perPage,
      columns,
      cursorName,
      cursor
    )

    expect(result).toEqual(
      new CursorPaginator(results, perPage, cursor, {
        path,
        cursorName,
        parameters: ['created_at']
      })
    )
  })

  test('testCursorPaginateWithUnionWheresReverseOrder', async () => {
    const ts = '2024-01-15 12:00:00'
    const perPage = 16
    const columns = ['test']
    const cursorName = 'cursor-name'
    const cursor = new Cursor({ created_at: ts }, false)
    const builder = getMockQueryBuilder()
    builder
      .select('id', 'start_time as created_at')
      .selectRaw("'video' as type")
      .from('videos')
    builder.union(
      getBuilder()
        .select('id', 'created_at')
        .selectRaw("'news' as type")
        .from('news')
    )
    builder.orderBy('created_at')
    jest.spyOn(builder, 'newQuery').mockImplementation(() => getBuilder())

    const path = `http://foo.bar?cursor=${cursor.encode()}`
    const results = collect([
      { id: 1, created_at: Carbon.now(), type: 'video' },
      { id: 2, created_at: Carbon.now(), type: 'news' }
    ])

    jest.spyOn(builder, 'get').mockImplementation(async () => {
      expect(builder.toSql()).toBe(
        '(select "id", "start_time" as "created_at", \'video\' as type from "videos" where ("start_time" < ?)) union (select "id", "created_at", \'news\' as type from "news" where ("created_at" < ?)) order by "created_at" desc limit 17'
      )
      expect(builder.getRawBindings().where).toEqual([ts])
      expect(builder.getRawBindings().union).toEqual([ts])

      return results
    })

    Paginator.currentPathResolver(() => path)

    const result = await builder.cursorPaginate(
      perPage,
      columns,
      cursorName,
      cursor
    )

    expect(result).toEqual(
      new CursorPaginator(results, perPage, cursor, {
        path,
        cursorName,
        parameters: ['created_at']
      })
    )
  })

  test('testCursorPaginateWithUnionWheresMultipleOrders', async () => {
    const ts = '2024-01-15 12:00:00'
    const perPage = 16
    const columns = ['test']
    const cursorName = 'cursor-name'
    const cursor = new Cursor({ created_at: ts, id: 1 })
    const builder = getMockQueryBuilder()
    builder
      .select('id', 'start_time as created_at')
      .selectRaw("'video' as type")
      .from('videos')
    builder.union(
      getBuilder()
        .select('id', 'created_at')
        .selectRaw("'news' as type")
        .from('news')
    )
    builder.orderByDesc('created_at').orderBy('id')
    jest.spyOn(builder, 'newQuery').mockImplementation(() => getBuilder())

    const path = `http://foo.bar?cursor=${cursor.encode()}`
    const results = collect([
      { id: 1, created_at: Carbon.now(), type: 'video' },
      { id: 2, created_at: Carbon.now(), type: 'news' }
    ])

    jest.spyOn(builder, 'get').mockImplementation(async () => {
      expect(builder.toSql()).toBe(
        '(select "id", "start_time" as "created_at", \'video\' as type from "videos" where ("start_time" < ? or ("start_time" = ? and ("id" > ?)))) union (select "id", "created_at", \'news\' as type from "news" where ("created_at" < ? or ("created_at" = ? and ("id" > ?)))) order by "created_at" desc, "id" asc limit 17'
      )
      expect(builder.getRawBindings().where).toEqual([ts, ts, 1])
      expect(builder.getRawBindings().union).toEqual([ts, ts, 1])

      return results
    })

    Paginator.currentPathResolver(() => path)

    const result = await builder.cursorPaginate(
      perPage,
      columns,
      cursorName,
      cursor
    )

    expect(result).toEqual(
      new CursorPaginator(results, perPage, cursor, {
        path,
        cursorName,
        parameters: ['created_at', 'id']
      })
    )
  })

  test('testCursorPaginateWithUnionWheresAndAliassedOrderColumns', async () => {
    const ts = '2024-01-15 12:00:00'
    const perPage = 16
    const columns = ['test']
    const cursorName = 'cursor-name'
    const cursor = new Cursor({ created_at: ts })
    const builder = getMockQueryBuilder()
    builder
      .select('id', 'start_time as created_at')
      .selectRaw("'video' as type")
      .from('videos')
    builder.union(
      getBuilder()
        .select('id', 'created_at')
        .selectRaw("'news' as type")
        .from('news')
    )
    builder.union(
      getBuilder()
        .select('id', 'init_at as created_at')
        .selectRaw("'podcast' as type")
        .from('podcasts')
    )
    builder.orderBy('created_at')
    jest.spyOn(builder, 'newQuery').mockImplementation(() => getBuilder())

    const path = `http://foo.bar?cursor=${cursor.encode()}`
    const results = collect([
      { id: 1, created_at: Carbon.now(), type: 'video' },
      { id: 2, created_at: Carbon.now(), type: 'news' },
      { id: 3, created_at: Carbon.now(), type: 'podcast' }
    ])

    jest.spyOn(builder, 'get').mockImplementation(async () => {
      expect(builder.toSql()).toBe(
        '(select "id", "start_time" as "created_at", \'video\' as type from "videos" where ("start_time" > ?)) union (select "id", "created_at", \'news\' as type from "news" where ("created_at" > ?)) union (select "id", "init_at" as "created_at", \'podcast\' as type from "podcasts" where ("init_at" > ?)) order by "created_at" asc limit 17'
      )
      expect(builder.getRawBindings().where).toEqual([ts])
      expect(builder.getRawBindings().union).toEqual([ts, ts])

      return results
    })

    Paginator.currentPathResolver(() => path)

    const result = await builder.cursorPaginate(
      perPage,
      columns,
      cursorName,
      cursor
    )

    expect(result).toEqual(
      new CursorPaginator(results, perPage, cursor, {
        path,
        cursorName,
        parameters: ['created_at']
      })
    )
  })

  test('testWhereExpression', () => {
    const builder = getBuilder()
    builder.select('*').from('orders').where(
      new (class extends ConditionExpression {
        public override getValue (): string {
          return '1 = 1'
        }
      })('')
    )

    expect(builder.toSql()).toBe('select * from "orders" where 1 = 1')
    expect(builder.getBindings()).toEqual([])
  })

  test('testWhereRowValues', () => {
    let builder = getBuilder()
    builder
      .select('*')
      .from('orders')
      .whereRowValues(['last_update', 'order_number'], '<', [1, 2])
    expect(builder.toSql()).toBe(
      'select * from "orders" where ("last_update", "order_number") < (?, ?)'
    )

    builder = getBuilder()
    builder
      .select('*')
      .from('orders')
      .where('company_id', 1)
      .orWhereRowValues(['last_update', 'order_number'], '<', [1, 2])
    expect(builder.toSql()).toBe(
      'select * from "orders" where "company_id" = ? or ("last_update", "order_number") < (?, ?)'
    )

    builder = getBuilder()
    builder
      .select('*')
      .from('orders')
      .whereRowValues(['last_update', 'order_number'], '<', [1, new Raw('2')])
    expect(builder.toSql()).toBe(
      'select * from "orders" where ("last_update", "order_number") < (?, 2)'
    )
    expect(builder.getBindings()).toEqual([1])
  })

  test('testWhereRowValuesArityMismatch', () => {
    const builder = getBuilder()

    expect(() => {
      builder
        .select('*')
        .from('orders')
        .whereRowValues(['last_update'], '<', [1, 2])
    }).toThrow(
      'InvalidArgumentException: The number of columns must match the number of values'
    )
  })

  test('testWhereJsonContainsMySql', () => {
    let builder = getMySqlBuilder()
    builder.select('*').from('users').whereJsonContains('options', ['en'])
    expect(builder.toSql()).toBe(
      'select * from `users` where json_contains(`options`, ?)'
    )
    expect(builder.getBindings()).toEqual(['["en"]'])

    builder = getMySqlBuilder()
    builder
      .select('*')
      .from('users')
      .whereJsonContains('users.options->languages', ['en'])
    expect(builder.toSql()).toBe(
      'select * from `users` where json_contains(`users`.`options`, ?, \'$."languages"\')'
    )
    expect(builder.getBindings()).toEqual(['["en"]'])

    builder = getMySqlBuilder()
    builder
      .select('*')
      .from('users')
      .where('id', '=', 1)
      .orWhereJsonContains('options->languages', new Raw('\'["en"]\''))
    expect(builder.toSql()).toBe(
      'select * from `users` where `id` = ? or json_contains(`options`, \'["en"]\', \'$."languages"\')'
    )
    expect(builder.getBindings()).toEqual([1])
  })

  test('testWhereJsonOverlapsMySql', () => {
    let builder = getMySqlBuilder()
    builder
      .select('*')
      .from('users')
      .whereJsonOverlaps('options', ['en', 'fr'])
    expect(builder.toSql()).toBe(
      'select * from `users` where json_overlaps(`options`, ?)'
    )
    expect(builder.getBindings()).toEqual(['["en","fr"]'])

    builder = getMySqlBuilder()
    builder
      .select('*')
      .from('users')
      .whereJsonOverlaps('users.options->languages', ['en', 'fr'])
    expect(builder.toSql()).toBe(
      'select * from `users` where json_overlaps(`users`.`options`, ?, \'$."languages"\')'
    )
    expect(builder.getBindings()).toEqual(['["en","fr"]'])

    builder = getMySqlBuilder()
    builder
      .select('*')
      .from('users')
      .where('id', '=', 1)
      .orWhereJsonOverlaps('options->languages', new Raw('\'["en", "fr"]\''))
    expect(builder.toSql()).toBe(
      'select * from `users` where `id` = ? or json_overlaps(`options`, \'["en", "fr"]\', \'$."languages"\')'
    )
    expect(builder.getBindings()).toEqual([1])
  })

  test('testWhereJsonContainsPostgres', () => {
    let builder = getPostgresBuilder()
    builder.select('*').from('users').whereJsonContains('options', ['en'])
    expect(builder.toSql()).toBe(
      'select * from "users" where ("options")::jsonb @> ?'
    )
    expect(builder.getBindings()).toEqual(['["en"]'])

    builder = getPostgresBuilder()
    builder
      .select('*')
      .from('users')
      .whereJsonContains('users.options->languages', ['en'])
    expect(builder.toSql()).toBe(
      'select * from "users" where ("users"."options"->\'languages\')::jsonb @> ?'
    )
    expect(builder.getBindings()).toEqual(['["en"]'])

    builder = getPostgresBuilder()
    builder
      .select('*')
      .from('users')
      .where('id', '=', 1)
      .orWhereJsonContains('options->languages', new Raw('\'["en"]\''))
    expect(builder.toSql()).toBe(
      'select * from "users" where "id" = ? or ("options"->\'languages\')::jsonb @> \'["en"]\''
    )
    expect(builder.getBindings()).toEqual([1])
  })

  test('testWhereJsonContainsSqlite', () => {
    let builder = getSQLiteBuilder()
    builder.select('*').from('users').whereJsonContains('options', 'en').toSql()
    expect(builder.toSql()).toBe(
      'select * from "users" where exists (select 1 from json_each("options") where "json_each"."value" is ?)'
    )
    expect(builder.getBindings()).toEqual(['en'])

    builder = getSQLiteBuilder()
    builder
      .select('*')
      .from('users')
      .whereJsonContains('users.options->language', 'en')
      .toSql()
    expect(builder.toSql()).toBe(
      'select * from "users" where exists (select 1 from json_each("users"."options", \'$."language"\') where "json_each"."value" is ?)'
    )
    expect(builder.getBindings()).toEqual(['en'])
  })

  test('testWhereJsonContainsSqlServer', () => {
    let builder = getSqlServerBuilder()
    builder.select('*').from('users').whereJsonContains('options', true)
    expect(builder.toSql()).toBe(
      'select * from [users] where ? in (select [value] from openjson([options]))'
    )
    expect(builder.getBindings()).toEqual(['true'])

    builder = getSqlServerBuilder()
    builder
      .select('*')
      .from('users')
      .whereJsonContains('users.options->languages', 'en')
    expect(builder.toSql()).toBe(
      'select * from [users] where ? in (select [value] from openjson([users].[options], \'$."languages"\'))'
    )
    expect(builder.getBindings()).toEqual(['en'])

    builder = getSqlServerBuilder()
    builder
      .select('*')
      .from('users')
      .where('id', '=', 1)
      .orWhereJsonContains('options->languages', new Raw("'en'"))
    expect(builder.toSql()).toBe(
      'select * from [users] where [id] = ? or \'en\' in (select [value] from openjson([options], \'$."languages"\'))'
    )
    expect(builder.getBindings()).toEqual([1])
  })

  test('testWhereJsonDoesntContainMySql', () => {
    let builder = getMySqlBuilder()
    builder
      .select('*')
      .from('users')
      .whereJsonDoesntContain('options->languages', ['en'])
    expect(builder.toSql()).toBe(
      'select * from `users` where not json_contains(`options`, ?, \'$."languages"\')'
    )
    expect(builder.getBindings()).toEqual(['["en"]'])

    builder = getMySqlBuilder()
    builder
      .select('*')
      .from('users')
      .where('id', '=', 1)
      .orWhereJsonDoesntContain('options->languages', new Raw('\'["en"]\''))
    expect(builder.toSql()).toBe(
      'select * from `users` where `id` = ? or not json_contains(`options`, \'["en"]\', \'$."languages"\')'
    )
    expect(builder.getBindings()).toEqual([1])
  })

  test('testWhereJsonDoesntOverlapMySql', () => {
    let builder = getMySqlBuilder()
    builder
      .select('*')
      .from('users')
      .whereJsonDoesntOverlap('options->languages', ['en', 'fr'])
    expect(builder.toSql()).toBe(
      'select * from `users` where not json_overlaps(`options`, ?, \'$."languages"\')'
    )
    expect(builder.getBindings()).toEqual(['["en","fr"]'])

    builder = getMySqlBuilder()
    builder
      .select('*')
      .from('users')
      .where('id', '=', 1)
      .orWhereJsonDoesntOverlap(
        'options->languages',
        new Raw('\'["en", "fr"]\'')
      )
    expect(builder.toSql()).toBe(
      'select * from `users` where `id` = ? or not json_overlaps(`options`, \'["en", "fr"]\', \'$."languages"\')'
    )
    expect(builder.getBindings()).toEqual([1])
  })

  test('testWhereJsonDoesntContainPostgres', () => {
    let builder = getPostgresBuilder()
    builder
      .select('*')
      .from('users')
      .whereJsonDoesntContain('options->languages', ['en'])
    expect(builder.toSql()).toBe(
      'select * from "users" where not ("options"->\'languages\')::jsonb @> ?'
    )
    expect(builder.getBindings()).toEqual(['["en"]'])

    builder = getPostgresBuilder()
    builder
      .select('*')
      .from('users')
      .where('id', '=', 1)
      .orWhereJsonDoesntContain('options->languages', new Raw('\'["en"]\''))
    expect(builder.toSql()).toBe(
      'select * from "users" where "id" = ? or not ("options"->\'languages\')::jsonb @> \'["en"]\''
    )
    expect(builder.getBindings()).toEqual([1])
  })

  test('testWhereJsonDoesntContainSqlite', () => {
    let builder = getSQLiteBuilder()
    builder.select('*').from('users').whereJsonDoesntContain('options', 'en').toSql()
    expect(builder.toSql()).toBe(
      'select * from "users" where not exists (select 1 from json_each("options") where "json_each"."value" is ?)'
    )
    expect(builder.getBindings()).toEqual(['en'])

    builder = getSQLiteBuilder()
    builder
      .select('*')
      .from('users')
      .whereJsonDoesntContain('users.options->language', 'en')
      .toSql()
    expect(builder.toSql()).toBe(
      'select * from "users" where not exists (select 1 from json_each("users"."options", \'$."language"\') where "json_each"."value" is ?)'
    )
    expect(builder.getBindings()).toEqual(['en'])
  })

  test('testWhereJsonDoesntContainSqlServer', () => {
    let builder = getSqlServerBuilder()
    builder.select('*').from('users').whereJsonDoesntContain('options->languages', 'en')
    expect(builder.toSql()).toBe(
      'select * from [users] where not ? in (select [value] from openjson([options], \'$."languages"\'))'
    )
    expect(builder.getBindings()).toEqual(['en'])

    builder = getSqlServerBuilder()
    builder
      .select('*')
      .from('users')
      .where('id', '=', 1)
      .orWhereJsonDoesntContain('options->languages', new Raw("'en'"))
    expect(builder.toSql()).toBe(
      'select * from [users] where [id] = ? or not \'en\' in (select [value] from openjson([options], \'$."languages"\'))'
    )
    expect(builder.getBindings()).toEqual([1])
  })

  test('testWhereJsonContainsKeyMySql', () => {
    let builder = getMySqlBuilder()
    builder.select('*').from('users').whereJsonContainsKey('users.options->languages')
    expect(builder.toSql()).toBe(
      'select * from `users` where ifnull(json_contains_path(`users`.`options`, \'one\', \'$."languages"\'), 0)'
    )

    builder = getMySqlBuilder()
    builder.select('*').from('users').whereJsonContainsKey('options->language->primary')
    expect(builder.toSql()).toBe(
      'select * from `users` where ifnull(json_contains_path(`options`, \'one\', \'$."language"."primary"\'), 0)'
    )

    builder = getMySqlBuilder()
    builder
      .select('*')
      .from('users')
      .where('id', '=', 1)
      .orWhereJsonContainsKey('options->languages')
    expect(builder.toSql()).toBe(
      'select * from `users` where `id` = ? or ifnull(json_contains_path(`options`, \'one\', \'$."languages"\'), 0)'
    )

    builder = getMySqlBuilder()
    builder.select('*').from('users').whereJsonContainsKey('options->languages[0][1]')
    expect(builder.toSql()).toBe(
      'select * from `users` where ifnull(json_contains_path(`options`, \'one\', \'$."languages"[0][1]\'), 0)'
    )
  })

  test('testWhereJsonContainsKeyPostgres', () => {
    let builder = getPostgresBuilder()
    builder.select('*').from('users').whereJsonContainsKey('users.options->languages')
    expect(builder.toSql()).toBe(
      'select * from "users" where coalesce(("users"."options")::jsonb ?? \'languages\', false)'
    )

    builder = getPostgresBuilder()
    builder.select('*').from('users').whereJsonContainsKey('options->language->primary')
    expect(builder.toSql()).toBe(
      'select * from "users" where coalesce(("options"->\'language\')::jsonb ?? \'primary\', false)'
    )

    builder = getPostgresBuilder()
    builder
      .select('*')
      .from('users')
      .where('id', '=', 1)
      .orWhereJsonContainsKey('options->languages')
    expect(builder.toSql()).toBe(
      'select * from "users" where "id" = ? or coalesce(("options")::jsonb ?? \'languages\', false)'
    )

    builder = getPostgresBuilder()
    builder.select('*').from('users').whereJsonContainsKey('options->languages[0][1]')
    expect(builder.toSql()).toBe(
      'select * from "users" where case when jsonb_typeof(("options"->\'languages\'->0)::jsonb) = \'array\' then jsonb_array_length(("options"->\'languages\'->0)::jsonb) >= 2 else false end'
    )

    builder = getPostgresBuilder()
    builder.select('*').from('users').whereJsonContainsKey('options->languages[-1]')
    expect(builder.toSql()).toBe(
      'select * from "users" where case when jsonb_typeof(("options"->\'languages\')::jsonb) = \'array\' then jsonb_array_length(("options"->\'languages\')::jsonb) >= 1 else false end'
    )
  })

  test('testWhereJsonContainsKeySqlite', () => {
    let builder = getSQLiteBuilder()
    builder.select('*').from('users').whereJsonContainsKey('users.options->languages')
    expect(builder.toSql()).toBe(
      'select * from "users" where json_type("users"."options", \'$."languages"\') is not null'
    )

    builder = getSQLiteBuilder()
    builder.select('*').from('users').whereJsonContainsKey('options->language->primary')
    expect(builder.toSql()).toBe(
      'select * from "users" where json_type("options", \'$."language"."primary"\') is not null'
    )

    builder = getSQLiteBuilder()
    builder
      .select('*')
      .from('users')
      .where('id', '=', 1)
      .orWhereJsonContainsKey('options->languages')
    expect(builder.toSql()).toBe(
      'select * from "users" where "id" = ? or json_type("options", \'$."languages"\') is not null'
    )

    builder = getSQLiteBuilder()
    builder.select('*').from('users').whereJsonContainsKey('options->languages[0][1]')
    expect(builder.toSql()).toBe(
      'select * from "users" where json_type("options", \'$."languages"[0][1]\') is not null'
    )
  })

  test('testWhereJsonContainsKeySqlServer', () => {
    let builder = getSqlServerBuilder()
    builder.select('*').from('users').whereJsonContainsKey('users.options->languages')
    expect(builder.toSql()).toBe(
      'select * from [users] where \'languages\' in (select [key] from openjson([users].[options]))'
    )

    builder = getSqlServerBuilder()
    builder.select('*').from('users').whereJsonContainsKey('options->language->primary')
    expect(builder.toSql()).toBe(
      'select * from [users] where \'primary\' in (select [key] from openjson([options], \'$."language"\'))'
    )

    builder = getSqlServerBuilder()
    builder
      .select('*')
      .from('users')
      .where('id', '=', 1)
      .orWhereJsonContainsKey('options->languages')
    expect(builder.toSql()).toBe(
      'select * from [users] where [id] = ? or \'languages\' in (select [key] from openjson([options]))'
    )

    builder = getSqlServerBuilder()
    builder.select('*').from('users').whereJsonContainsKey('options->languages[0][1]')
    expect(builder.toSql()).toBe(
      'select * from [users] where 1 in (select [key] from openjson([options], \'$."languages"[0]\'))'
    )
  })

  test('testWhereJsonDoesntContainKeyMySql', () => {
    let builder = getMySqlBuilder()
    builder.select('*').from('users').whereJsonDoesntContainKey('options->languages')
    expect(builder.toSql()).toBe(
      'select * from `users` where not ifnull(json_contains_path(`options`, \'one\', \'$."languages"\'), 0)'
    )

    builder = getMySqlBuilder()
    builder
      .select('*')
      .from('users')
      .where('id', '=', 1)
      .orWhereJsonDoesntContainKey('options->languages')
    expect(builder.toSql()).toBe(
      'select * from `users` where `id` = ? or not ifnull(json_contains_path(`options`, \'one\', \'$."languages"\'), 0)'
    )

    builder = getMySqlBuilder()
    builder.select('*').from('users').whereJsonDoesntContainKey('options->languages[0][1]')
    expect(builder.toSql()).toBe(
      'select * from `users` where not ifnull(json_contains_path(`options`, \'one\', \'$."languages"[0][1]\'), 0)'
    )
  })

  test('testWhereJsonDoesntContainKeyPostgres', () => {
    let builder = getPostgresBuilder()
    builder.select('*').from('users').whereJsonDoesntContainKey('options->languages')
    expect(builder.toSql()).toBe(
      'select * from "users" where not coalesce(("options")::jsonb ?? \'languages\', false)'
    )

    builder = getPostgresBuilder()
    builder
      .select('*')
      .from('users')
      .where('id', '=', 1)
      .orWhereJsonDoesntContainKey('options->languages')
    expect(builder.toSql()).toBe(
      'select * from "users" where "id" = ? or not coalesce(("options")::jsonb ?? \'languages\', false)'
    )

    builder = getPostgresBuilder()
    builder.select('*').from('users').whereJsonDoesntContainKey('options->languages[0][1]')
    expect(builder.toSql()).toBe(
      'select * from "users" where not case when jsonb_typeof(("options"->\'languages\'->0)::jsonb) = \'array\' then jsonb_array_length(("options"->\'languages\'->0)::jsonb) >= 2 else false end'
    )

    builder = getPostgresBuilder()
    builder.select('*').from('users').whereJsonDoesntContainKey('options->languages[-1]')
    expect(builder.toSql()).toBe(
      'select * from "users" where not case when jsonb_typeof(("options"->\'languages\')::jsonb) = \'array\' then jsonb_array_length(("options"->\'languages\')::jsonb) >= 1 else false end'
    )
  })

  test('testWhereJsonDoesntContainKeySqlite', () => {
    let builder = getSQLiteBuilder()
    builder.select('*').from('users').whereJsonDoesntContainKey('options->languages')
    expect(builder.toSql()).toBe(
      'select * from "users" where not json_type("options", \'$."languages"\') is not null'
    )

    builder = getSQLiteBuilder()
    builder
      .select('*')
      .from('users')
      .where('id', '=', 1)
      .orWhereJsonDoesntContainKey('options->languages')
    expect(builder.toSql()).toBe(
      'select * from "users" where "id" = ? or not json_type("options", \'$."languages"\') is not null'
    )

    builder = getSQLiteBuilder()
    builder
      .select('*')
      .from('users')
      .where('id', '=', 1)
      .orWhereJsonDoesntContainKey('options->languages[0][1]')
    expect(builder.toSql()).toBe(
      'select * from "users" where "id" = ? or not json_type("options", \'$."languages"[0][1]\') is not null'
    )
  })

  test('testWhereJsonDoesntContainKeySqlServer', () => {
    let builder = getSqlServerBuilder()
    builder.select('*').from('users').whereJsonDoesntContainKey('options->languages')
    expect(builder.toSql()).toBe(
      'select * from [users] where not \'languages\' in (select [key] from openjson([options]))'
    )

    builder = getSqlServerBuilder()
    builder
      .select('*')
      .from('users')
      .where('id', '=', 1)
      .orWhereJsonDoesntContainKey('options->languages')
    expect(builder.toSql()).toBe(
      'select * from [users] where [id] = ? or not \'languages\' in (select [key] from openjson([options]))'
    )

    builder = getSqlServerBuilder()
    builder
      .select('*')
      .from('users')
      .where('id', '=', 1)
      .orWhereJsonDoesntContainKey('options->languages[0][1]')
    expect(builder.toSql()).toBe(
      'select * from [users] where [id] = ? or not 1 in (select [key] from openjson([options], \'$."languages"[0]\'))'
    )
  })

  test('testWhereJsonLengthMySql', () => {
    let builder = getMySqlBuilder()
    builder.select('*').from('users').whereJsonLength('options', 0)
    expect(builder.toSql()).toBe(
      'select * from `users` where json_length(`options`) = ?'
    )
    expect(builder.getBindings()).toEqual([0])

    builder = getMySqlBuilder()
    builder.select('*').from('users').whereJsonLength('users.options->languages', '>', 0)
    expect(builder.toSql()).toBe(
      'select * from `users` where json_length(`users`.`options`, \'$."languages"\') > ?'
    )
    expect(builder.getBindings()).toEqual([0])

    builder = getMySqlBuilder()
    builder
      .select('*')
      .from('users')
      .where('id', '=', 1)
      .orWhereJsonLength('options->languages', new Raw('0'))
    expect(builder.toSql()).toBe(
      'select * from `users` where `id` = ? or json_length(`options`, \'$."languages"\') = 0'
    )
    expect(builder.getBindings()).toEqual([1])

    builder = getMySqlBuilder()
    builder
      .select('*')
      .from('users')
      .where('id', '=', 1)
      .orWhereJsonLength('options->languages', '>', new Raw('0'))
    expect(builder.toSql()).toBe(
      'select * from `users` where `id` = ? or json_length(`options`, \'$."languages"\') > 0'
    )
    expect(builder.getBindings()).toEqual([1])
  })

  test('testWhereJsonLengthPostgres', () => {
    let builder = getPostgresBuilder()
    builder.select('*').from('users').whereJsonLength('options', 0)
    expect(builder.toSql()).toBe(
      'select * from "users" where jsonb_array_length(("options")::jsonb) = ?'
    )
    expect(builder.getBindings()).toEqual([0])

    builder = getPostgresBuilder()
    builder
      .select('*')
      .from('users')
      .whereJsonLength('users.options->languages', '>', 0)
    expect(builder.toSql()).toBe(
      'select * from "users" where jsonb_array_length(("users"."options"->\'languages\')::jsonb) > ?'
    )
    expect(builder.getBindings()).toEqual([0])

    builder = getPostgresBuilder()
    builder
      .select('*')
      .from('users')
      .where('id', '=', 1)
      .orWhereJsonLength('options->languages', new Raw('0'))
    expect(builder.toSql()).toBe(
      'select * from "users" where "id" = ? or jsonb_array_length(("options"->\'languages\')::jsonb) = 0'
    )
    expect(builder.getBindings()).toEqual([1])

    builder = getPostgresBuilder()
    builder
      .select('*')
      .from('users')
      .where('id', '=', 1)
      .orWhereJsonLength('options->languages', '>', new Raw('0'))
    expect(builder.toSql()).toBe(
      'select * from "users" where "id" = ? or jsonb_array_length(("options"->\'languages\')::jsonb) > 0'
    )
    expect(builder.getBindings()).toEqual([1])
  })

  test('testWhereJsonLengthSqlite', () => {
    let builder = getSQLiteBuilder()
    builder.select('*').from('users').whereJsonLength('options', 0)
    expect(builder.toSql()).toBe(
      'select * from "users" where json_array_length("options") = ?'
    )
    expect(builder.getBindings()).toEqual([0])

    builder = getSQLiteBuilder()
    builder.select('*').from('users').whereJsonLength('users.options->languages', '>', 0)
    expect(builder.toSql()).toBe(
      'select * from "users" where json_array_length("users"."options", \'$."languages"\') > ?'
    )
    expect(builder.getBindings()).toEqual([0])

    builder = getSQLiteBuilder()
    builder
      .select('*')
      .from('users')
      .where('id', '=', 1)
      .orWhereJsonLength('options->languages', new Raw('0'))
    expect(builder.toSql()).toBe(
      'select * from "users" where "id" = ? or json_array_length("options", \'$."languages"\') = 0'
    )
    expect(builder.getBindings()).toEqual([1])

    builder = getSQLiteBuilder()
    builder
      .select('*')
      .from('users')
      .where('id', '=', 1)
      .orWhereJsonLength('options->languages', '>', new Raw('0'))
    expect(builder.toSql()).toBe(
      'select * from "users" where "id" = ? or json_array_length("options", \'$."languages"\') > 0'
    )
    expect(builder.getBindings()).toEqual([1])
  })

  test('testWhereJsonLengthSqlServer', () => {
    let builder = getSqlServerBuilder()
    builder.select('*').from('users').whereJsonLength('options', 0)
    expect(builder.toSql()).toBe(
      'select * from [users] where (select count(*) from openjson([options])) = ?'
    )
    expect(builder.getBindings()).toEqual([0])

    builder = getSqlServerBuilder()
    builder.select('*').from('users').whereJsonLength('users.options->languages', '>', 0)
    expect(builder.toSql()).toBe(
      'select * from [users] where (select count(*) from openjson([users].[options], \'$."languages"\')) > ?'
    )
    expect(builder.getBindings()).toEqual([0])

    builder = getSqlServerBuilder()
    builder
      .select('*')
      .from('users')
      .where('id', '=', 1)
      .orWhereJsonLength('options->languages', new Raw('0'))
    expect(builder.toSql()).toBe(
      'select * from [users] where [id] = ? or (select count(*) from openjson([options], \'$."languages"\')) = 0'
    )
    expect(builder.getBindings()).toEqual([1])

    builder = getSqlServerBuilder()
    builder
      .select('*')
      .from('users')
      .where('id', '=', 1)
      .orWhereJsonLength('options->languages', '>', new Raw('0'))
    expect(builder.toSql()).toBe(
      'select * from [users] where [id] = ? or (select count(*) from openjson([options], \'$."languages"\')) > 0'
    )
    expect(builder.getBindings()).toEqual([1])
  })

  test('testFrom', () => {
    let builder = getBuilder()
    builder.from(getBuilder().from('users'), 'u')
    expect(builder.toSql()).toBe('select * from (select * from "users") as "u"')

    builder = getBuilder()
    const eloquentBuilder = new EloquentBuilder(getBuilder())
    builder.from(eloquentBuilder.from('users'), 'u')
    expect(builder.toSql()).toBe('select * from (select * from "users") as "u"')
  })

  test('testFromSub', () => {
    const builder = getBuilder()
    builder.fromSub((query) => {
      query.select(new Raw('max(last_seen_at) as last_seen_at')).from('user_sessions').where('foo', '=', '1')
    }, 'sessions').where('bar', '<', '10')
    expect(builder.toSql()).toBe(
      'select * from (select max(last_seen_at) as last_seen_at from "user_sessions" where "foo" = ?) as "sessions" where "bar" < ?'
    )
    expect(builder.getBindings()).toEqual(['1', '10'])

    expect(() => {
      getBuilder().fromSub(['invalid'] as never, 'sessions').where('bar', '<', '10')
    }).toThrow('InvalidArgumentException: A subquery must be a query builder instance, a Closure, or a string.')
  })

  test('testFromSubWithPrefix', () => {
    const builder = getBuilder('prefix_')
    builder.fromSub((query) => {
      query.select(new Raw('max(last_seen_at) as last_seen_at')).from('user_sessions').where('foo', '=', '1')
    }, 'sessions').where('bar', '<', '10')
    expect(builder.toSql()).toBe(
      'select * from (select max(last_seen_at) as last_seen_at from "prefix_user_sessions" where "foo" = ?) as "prefix_sessions" where "bar" < ?'
    )
    expect(builder.getBindings()).toEqual(['1', '10'])
  })

  test('testFromSubWithoutBindings', () => {
    const builder = getBuilder()
    builder.fromSub((query) => {
      query.select(new Raw('max(last_seen_at) as last_seen_at')).from('user_sessions')
    }, 'sessions')
    expect(builder.toSql()).toBe(
      'select * from (select max(last_seen_at) as last_seen_at from "user_sessions") as "sessions"'
    )

    expect(() => {
      getBuilder().fromSub(['invalid'] as never, 'sessions')
    }).toThrow('InvalidArgumentException: A subquery must be a query builder instance, a Closure, or a string.')
  })

  test('testFromRaw', () => {
    const builder = getBuilder()
    builder.fromRaw(new Raw('(select max(last_seen_at) as last_seen_at from "user_sessions") as "sessions"'))
    expect(builder.toSql()).toBe(
      'select * from (select max(last_seen_at) as last_seen_at from "user_sessions") as "sessions"'
    )
  })

  test('testFromRawOnSqlServer', () => {
    const builder = getSqlServerBuilder()
    builder.fromRaw('dbo.[SomeNameWithRoundBrackets (test)]')
    expect(builder.toSql()).toBe('select * from dbo.[SomeNameWithRoundBrackets (test)]')
  })

  test('testFromRawWithWhereOnTheMainQuery', () => {
    const builder = getBuilder()
    builder
      .fromRaw(new Raw('(select max(last_seen_at) as last_seen_at from "sessions") as "last_seen_at"'))
      .where('last_seen_at', '>', '1520652582')
    expect(builder.toSql()).toBe(
      'select * from (select max(last_seen_at) as last_seen_at from "sessions") as "last_seen_at" where "last_seen_at" > ?'
    )
    expect(builder.getBindings()).toEqual(['1520652582'])
  })

  test('testFromQuestionMarkOperatorOnPostgres', () => {
    let builder = getPostgresBuilder()
    builder.select('*').from('users').where('roles', '?', 'superuser')
    expect(builder.toSql()).toBe('select * from "users" where "roles" ?? ?')

    builder = getPostgresBuilder()
    builder.select('*').from('users').where('roles', '?|', 'superuser')
    expect(builder.toSql()).toBe('select * from "users" where "roles" ??| ?')

    builder = getPostgresBuilder()
    builder.select('*').from('users').where('roles', '?&', 'superuser')
    expect(builder.toSql()).toBe('select * from "users" where "roles" ??& ?')
  })

  test('testWhereColumnQuestionMarkOperatorOnPostgres', () => {
    let builder = getPostgresBuilder()
    builder.select('*').from('users').whereColumn('foo', '?', '_foo')
    expect(builder.toSql()).toBe('select * from "users" where "foo" ?? "_foo"')

    builder = getPostgresBuilder()
    builder.select('*').from('users').whereColumn('foo', '?|', '_foo')
    expect(builder.toSql()).toBe('select * from "users" where "foo" ??| "_foo"')

    builder = getPostgresBuilder()
    builder.select('*').from('users').whereColumn('foo', '?&', '_foo')
    expect(builder.toSql()).toBe('select * from "users" where "foo" ??& "_foo"')
  })

  test('testJoinQuestionMarkOperatorOnPostgres', () => {
    const builder = getPostgresBuilder()
    builder
      .select(['countries.*', new Raw('count(users.*) as "users"')])
      .from('countries')
      .join('users', 'users.country_codes', '?', 'countries.code')
    expect(builder.toSql()).toBe(
      'select "countries".*, count(users.*) as "users" from "countries" inner join "users" on "users"."country_codes" ?? "countries"."code"'
    )
  })

  test('testUseIndexMySql', () => {
    const builder = getMySqlBuilder()
    builder.select('foo').from('users').useIndex('test_index')
    expect(builder.toSql()).toBe('select `foo` from `users` use index (test_index)')
  })

  test('testForceIndexMySql', () => {
    const builder = getMySqlBuilder()
    builder.select('foo').from('users').forceIndex('test_index')
    expect(builder.toSql()).toBe('select `foo` from `users` force index (test_index)')
  })

  test('testIgnoreIndexMySql', () => {
    const builder = getMySqlBuilder()
    builder.select('foo').from('users').ignoreIndex('test_index')
    expect(builder.toSql()).toBe('select `foo` from `users` ignore index (test_index)')
  })

  test('testUseIndexSqlite', () => {
    const builder = getSQLiteBuilder()
    builder.select('foo').from('users').useIndex('test_index')
    expect(builder.toSql()).toBe('select "foo" from "users"')
  })

  test('testForceIndexSqlite', () => {
    const builder = getSQLiteBuilder()
    builder.select('foo').from('users').forceIndex('test_index')
    expect(builder.toSql()).toBe('select "foo" from "users" indexed by test_index')
  })

  test('testIgnoreIndexSqlite', () => {
    const builder = getSQLiteBuilder()
    builder.select('foo').from('users').ignoreIndex('test_index')
    expect(builder.toSql()).toBe('select "foo" from "users"')
  })

  test('testUseIndexSqlServer', () => {
    const builder = getSqlServerBuilder()
    builder.select('foo').from('users').useIndex('test_index')
    expect(builder.toSql()).toBe('select [foo] from [users]')
  })

  test('testForceIndexSqlServer', () => {
    const builder = getSqlServerBuilder()
    builder.select('foo').from('users').forceIndex('test_index')
    expect(builder.toSql()).toBe('select [foo] from [users] with (index([test_index]))')
  })

  test('testIgnoreIndexSqlServer', () => {
    const builder = getSqlServerBuilder()
    builder.select('foo').from('users').ignoreIndex('test_index')
    expect(builder.toSql()).toBe('select [foo] from [users]')
  })

  test('testClone', () => {
    const builder = getBuilder()
    builder.select('*').from('users')
    const cloned = builder.clone().where('email', 'foo')

    expect(cloned).not.toBe(builder)
    expect(builder.toSql()).toBe('select * from "users"')
    expect(cloned.toSql()).toBe('select * from "users" where "email" = ?')
  })

  test('testCloneWithout', () => {
    const builder = getBuilder()
    builder.select('*').from('users').where('email', 'foo').orderBy('email')
    const cloned = builder.cloneWithout(['orders'])

    expect(builder.toSql()).toBe('select * from "users" where "email" = ? order by "email" asc')
    expect(cloned.toSql()).toBe('select * from "users" where "email" = ?')
  })

  test('testCloneWithoutBindings', () => {
    const builder = getBuilder()
    builder.select('*').from('users').where('email', 'foo').orderBy('email')
    const cloned = builder.cloneWithout(['wheres']).cloneWithoutBindings(['where'])

    expect(builder.toSql()).toBe('select * from "users" where "email" = ? order by "email" asc')
    expect(builder.getBindings()).toEqual(['foo'])

    expect(cloned.toSql()).toBe('select * from "users" order by "email" asc')
    expect(cloned.getBindings()).toEqual([])
  })

  test('testWhereVectorSimilarToOnPostgres', () => {
    const builder = getPostgresBuilder()
    builder
      .select('*')
      .from('documents')
      .whereVectorSimilarTo('embedding', [1, 2, 3], 0.4)
      .limit(10)

    expect(builder.toSql()).toBe(
      'select * from "documents" where ("embedding" <=> ?) <= ? order by ("embedding" <=> ?) asc limit 10'
    )
    expect(builder.getBindings()).toEqual(['[1,2,3]', 0.6, '[1,2,3]'])
  })

  test('testWhereVectorSimilarToOnMariaDb', () => {
    const builder = getMariaDbBuilder()
    builder
      .select('*')
      .from('documents')
      .whereVectorSimilarTo('embedding', [1, 2, 3], 0.4)
      .limit(10)

    expect(builder.toSql()).toBe(
      'select * from `documents` where vec_distance_cosine(`embedding`, vec_fromtext(?)) <= ? order by vec_distance_cosine(`embedding`, vec_fromtext(?)) asc limit 10'
    )
    expect(builder.getBindings()).toEqual(['[1,2,3]', 0.6, '[1,2,3]'])
  })

  test('testWhereVectorSimilarToThrowsOnUnsupportedGrammar', () => {
    const builder = getMySqlBuilder()

    expect(() => {
      builder.select('*').from('documents').whereVectorSimilarTo('embedding', [1, 2, 3])
    }).toThrow('RuntimeException: Vector distance queries are only supported by Postgres and MariaDB.')
  })

  test('testWhereVectorDistanceLessThanOnPostgres', () => {
    const builder = getPostgresBuilder()
    builder.select('*').from('documents').whereVectorDistanceLessThan('embedding', [1, 2, 3], 0.5)

    expect(builder.toSql()).toBe('select * from "documents" where ("embedding" <=> ?) <= ?')
    expect(builder.getBindings()).toEqual(['[1,2,3]', 0.5])
  })

  test('testWhereVectorDistanceLessThanOnMariaDb', () => {
    const builder = getMariaDbBuilder()
    builder.select('*').from('documents').whereVectorDistanceLessThan('embedding', [1, 2, 3], 0.5)

    expect(builder.toSql()).toBe(
      'select * from `documents` where vec_distance_cosine(`embedding`, vec_fromtext(?)) <= ?'
    )
    expect(builder.getBindings()).toEqual(['[1,2,3]', 0.5])
  })

  test('testOrderByVectorDistanceOnMariaDb', () => {
    const builder = getMariaDbBuilder()
    builder.select('*').from('documents').orderByVectorDistance('embedding', [1, 2, 3])

    expect(builder.toSql()).toBe(
      'select * from `documents` order by vec_distance_cosine(`embedding`, vec_fromtext(?)) asc'
    )
    expect(builder.getBindings()).toEqual(['[1,2,3]'])
  })

  test('testSelectVectorDistanceOnMariaDb', () => {
    const builder = getMariaDbBuilder()
    builder.from('documents').selectVectorDistance('embedding', [1, 2, 3])

    expect(builder.toSql()).toBe(
      'select vec_distance_cosine(`embedding`, vec_fromtext(?)) as `embedding_distance` from `documents`'
    )
    expect(builder.getBindings()).toEqual(['[1,2,3]'])
  })

  test('testToRawSql', () => {
    const builder = getBuilder()
    const connection = builder.getConnection()
    const grammar = builder.getGrammar()

    jest.spyOn(connection, 'prepareBindings').mockImplementation((bindings) => bindings)
    jest.spyOn(grammar, 'substituteBindingsIntoRawSql').mockReturnValue(
      'select * from "users" where "email" = \'foo\''
    )

    builder.select('*').from('users').where('email', 'foo')

    expect(builder.toRawSql()).toBe('select * from "users" where "email" = \'foo\'')
    expect(connection.prepareBindings).toHaveBeenCalledWith(['foo'])
    expect(grammar.substituteBindingsIntoRawSql).toHaveBeenCalledWith(
      'select * from "users" where "email" = ?',
      ['foo']
    )
  })
})

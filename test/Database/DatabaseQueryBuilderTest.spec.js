import test from 'ava'

import getBuilder from './helpers/getBuilder.js'
import getMySqlBuilderWithProcessor from './helpers/getMySqlBuilderWithProcessor.js'
import getMySqlBuilder from './helpers/getMySqlBuilder.js'
import getPostgresBuilder from './helpers/getPostgresBuilder.js'
import getSQLiteBuilder from './helpers/getSQLiteBuilder.js'
import getSqlServerBuilder from './helpers/getSqlServerBuilder.js'
import EloquentBuilder from '../../src/Illuminate/Database/Eloquent/Builder.js'
import getPostgresBuilderWithProcessor from './helpers/getPostgresBuilderWithProcessor.js'
import Expression from './../../src/Illuminate/Database/Query/Expression.js'
import { collect } from '../../src/Illuminate/Collections/helpers.js'

import mock from '../helpers/mock.js'

const Raw = Expression

test('testBasicSelect', (t) => {
  const builder = getBuilder()
  builder.select('*').from('users')

  t.is(builder.toSql(), 'select * from "users"')
})

test('testBasicSelectWithGetColumns', async t => {
  const { createMock, verifyMock } = mock()

  const builder = getBuilder()

  const connectionMock = createMock(builder.getConnection())
  createMock(builder.getProcessor()).expects('processSelect').thrice()

  connectionMock.expects('select').once().callsFake((sql) => {
    return t.is('select * from "users"', sql)
  }).reset()

  connectionMock.expects('select').once().callsFake((sql) => {
    return t.is('select "foo", "bar" from "users"', sql)
  })

  connectionMock.expects('select').once().callsFake((sql) => {
    return t.is('select "baz" from "users"', sql)
  })

  await builder.from('users').get()
  t.deepEqual(builder.columns, [])

  await builder.from('users').get(['foo', 'bar'])
  t.deepEqual(builder.columns, [])

  await builder.from('users').get(['baz'])
  t.deepEqual(builder.columns, [])

  t.is(builder.toSql(), 'select * from "users"')
  t.deepEqual(builder.columns, [])

  verifyMock()
})

test('testBasicMySqlSelect', async t => {
  const { createMock, verifyMock } = mock()

  let builder = getMySqlBuilderWithProcessor()

  let connectionMock = createMock(builder.getConnection())

  connectionMock.expects('select').once()
    .withArgs('select * from `users`', [])

  await builder.select('*').from('users').get()

  builder = getMySqlBuilderWithProcessor()
  connectionMock = createMock(builder.getConnection())

  connectionMock.expects('select').once()
    .withArgs('select * from `users`', [])

  await builder.select('*').from('users').get()

  t.is('select * from `users`', builder.toSql())

  verifyMock()
})

test('testBasicTableWrappingProtectsQuotationMarks', t => {
  const builder = getBuilder()
  builder.select('*').from('some"table')

  t.is('select * from "some""table"', builder.toSql())
})

test('testAliasWrappingAsWholeConstant', t => {
  const builder = getBuilder()

  builder.select('x.y as foo.bar').from('baz')
  t.is('select "x"."y" as "foo.bar" from "baz"', builder.toSql())
})

test('testAliasWrappingWithSpacesInDatabaseName', t => {
  const builder = getBuilder()

  builder.select('w x.y.z as foo.bar').from('baz')
  t.is('select "w x"."y"."z" as "foo.bar" from "baz"', builder.toSql())
})

test('testAddingSelects', t => {
  const builder = getBuilder()

  builder.select('foo').addSelect('bar').addSelect(['baz', 'boom']).from('users')
  t.is('select "foo", "bar", "baz", "boom" from "users"', builder.toSql())
})

test('testBasicSelectWithPrefix', t => {
  const builder = getBuilder()

  builder.getGrammar().setTablePrefix('prefix_')
  builder.select('*').from('users')
  t.is('select * from "prefix_users"', builder.toSql())
})

test('testBasicSelectDistinct', t => {
  const builder = getBuilder()

  builder.distinct().select('foo', 'bar').from('users')
  t.is('select distinct "foo", "bar" from "users"', builder.toSql())
})

test('testBasicSelectDistinctOnColumns', t => {
  let builder = getBuilder()
  builder.distinct('foo').select('foo', 'bar').from('users')
  t.is('select distinct "foo", "bar" from "users"', builder.toSql())

  builder = getPostgresBuilder()
  builder.distinct('foo').select('foo', 'bar').from('users')
  t.is('select distinct on ("foo") "foo", "bar" from "users"', builder.toSql())
})

test('testBasicAlias', t => {
  const builder = getBuilder()

  builder.select('foo as bar').from('users')
  t.is('select "foo" as "bar" from "users"', builder.toSql())
})

test('testAliasWithPrefix', t => {
  const builder = getBuilder()

  builder.getGrammar().setTablePrefix('prefix_')
  builder.select('*').from('users as people')
  t.is('select * from "prefix_users" as "prefix_people"', builder.toSql())
})

test('testJoinAliasesWithPrefix', t => {
  const builder = getBuilder()

  builder.getGrammar().setTablePrefix('prefix_')
  builder.select('*').from('services').join('translations AS t', 't.item_id', '=', 'services.id')
  t.is('select * from "prefix_services" inner join "prefix_translations" as "prefix_t" on "prefix_t"."item_id" = "prefix_services"."id"', builder.toSql())
})

test('testBasicTableWrapping', t => {
  const builder = getBuilder()

  builder.select('*').from('public.users')
  t.is('select * from "public"."users"', builder.toSql())
})

test('testWhenCallback', t => {
  const callback = (query, condition) => {
    t.true(condition)

    query.where('id', '=', 1)
  }

  let builder = getBuilder()
  builder.select('*').from('users').when(true, callback).where('email', 'foo')
  t.is('select * from "users" where "id" = ? and "email" = ?', builder.toSql())

  builder = getBuilder()
  builder.select('*').from('users').when(false, callback).where('email', 'foo')
  t.is('select * from "users" where "email" = ?', builder.toSql())
})

test('testWhenCallbackWithReturn', t => {
  const callback = (query, condition) => {
    t.true(condition)

    return query.where('id', '=', 1)
  }

  let builder = getBuilder()
  builder.select('*').from('users').when(true, callback).where('email', 'foo')
  t.is('select * from "users" where "id" = ? and "email" = ?', builder.toSql())

  builder = getBuilder()
  builder.select('*').from('users').when(false, callback).where('email', 'foo')
  t.is('select * from "users" where "email" = ?', builder.toSql())
})

test('testWhenCallbackWithDefault', t => {
  const callback = (query, condition) => {
    t.is('truthy', condition)

    query.where('id', '=', 1)
  }

  const defaultCallback = (query, condition) => {
    t.is(0, condition)

    query.where('id', '=', 2)
  }

  let builder = getBuilder()
  builder.select('*').from('users').when('truthy', callback, defaultCallback).where('email', 'foo')
  t.is('select * from "users" where "id" = ? and "email" = ?', builder.toSql())
  t.deepEqual([1, 'foo'], builder.getBindings())

  builder = getBuilder()
  builder.select('*').from('users').when(0, callback, defaultCallback).where('email', 'foo')
  t.is('select * from "users" where "id" = ? and "email" = ?', builder.toSql())
  t.deepEqual([2, 'foo'], builder.getBindings())
})

test('testUnlessCallback', t => {
  const callback = (query, condition) => {
    t.false(condition)

    query.where('id', '=', 1)
  }

  let builder = getBuilder()
  builder.select('*').from('users').unless(false, callback).where('email', 'foo')
  t.is('select * from "users" where "id" = ? and "email" = ?', builder.toSql())

  builder = getBuilder()
  builder.select('*').from('users').unless(true, callback).where('email', 'foo')
  t.is('select * from "users" where "email" = ?', builder.toSql())
})

test('testUnlessCallbackWithReturn', t => {
  const callback = (query, condition) => {
    t.false(condition)

    return query.where('id', '=', 1)
  }

  let builder = getBuilder()
  builder.select('*').from('users').unless(false, callback).where('email', 'foo')
  t.is('select * from "users" where "id" = ? and "email" = ?', builder.toSql())

  builder = getBuilder()
  builder.select('*').from('users').unless(true, callback).where('email', 'foo')
  t.is('select * from "users" where "email" = ?', builder.toSql())
})

test('testUnlessCallbackWithDefault', t => {
  const callback = (query, condition) => {
    t.is(0, condition)

    query.where('id', '=', 1)
  }

  const defaultCallback = (query, condition) => {
    t.is('truthy', condition)

    query.where('id', '=', 2)
  }

  let builder = getBuilder()
  builder.select('*').from('users').unless(0, callback, defaultCallback).where('email', 'foo')
  t.is('select * from "users" where "id" = ? and "email" = ?', builder.toSql())
  t.deepEqual([1, 'foo'], builder.getBindings())

  builder = getBuilder()
  builder.select('*').from('users').unless('truthy', callback, defaultCallback).where('email', 'foo')
  t.is('select * from "users" where "id" = ? and "email" = ?', builder.toSql())
  t.deepEqual([2, 'foo'], builder.getBindings())
})

test('testTapCallback', t => {
  const callback = (query) => {
    return query.where('id', '=', 1)
  }

  const builder = getBuilder()
  builder.select('*').from('users').tap(callback).where('email', 'foo')
  t.is('select * from "users" where "id" = ? and "email" = ?', builder.toSql())
})

test('testBasicWheres', t => {
  const builder = getBuilder()
  builder.select('*').from('users').where('id', '=', 1)
  t.is('select * from "users" where "id" = ?', builder.toSql())
  t.deepEqual([1], builder.getBindings())
})

test('testBasicWheresInvalidOperator', t => {
  const builder = getBuilder()
  builder.select('*').from('users').where('id', '#', 1)
  t.is('select * from "users" where "id" = ?', builder.toSql())
  t.deepEqual(['#'], builder.getBindings())
})

test('testBasicWhereNot', async (t) => {
  const builder = getBuilder()
  builder.select('*').from('users').whereNot('name', 'foo').whereNot('name', '<>', 'bar')
  t.is('select * from "users" where not "name" = ? and not "name" <> ?', builder.toSql())
  t.deepEqual(['foo', 'bar'], builder.getBindings())
})

test('testWheresWithArrayValue', t => {
  let builder = getBuilder()
  builder.select('*').from('users').where('id', [12])
  t.is('select * from "users" where "id" = ?', builder.toSql())
  t.deepEqual([12], builder.getBindings())

  builder = getBuilder()
  builder.select('*').from('users').where('id', '=', [12, 30])
  t.is('select * from "users" where "id" = ?', builder.toSql())
  t.deepEqual([12], builder.getBindings())

  builder = getBuilder()
  builder.select('*').from('users').where('id', '!=', [12, 30])
  t.is('select * from "users" where "id" != ?', builder.toSql())
  t.deepEqual([12], builder.getBindings())

  builder = getBuilder()
  builder.select('*').from('users').where('id', '<>', [12, 30])
  t.is('select * from "users" where "id" <> ?', builder.toSql())
  t.deepEqual([12], builder.getBindings())

  builder = getBuilder()
  builder.select('*').from('users').where('id', '=', [[12, 30]])
  t.is('select * from "users" where "id" = ?', builder.toSql())
  t.deepEqual([12], builder.getBindings())
})

test('testMySqlWrappingProtectsQuotationMarks', t => {
  const builder = getMySqlBuilder()
  builder.select('*').from('some`table')
  t.is('select * from `some``table`', builder.toSql())
})

test('testDateBasedWheresAcceptsTwoArguments', t => {
  let builder = getMySqlBuilder()
  builder.select('*').from('users').whereDate('created_at', 1)
  t.is('select * from `users` where date(`created_at`) = ?', builder.toSql())

  builder = getMySqlBuilder()
  builder.select('*').from('users').whereDate('created_at', new Date('2021/08/07'))
  t.is('select * from `users` where date(`created_at`) = ?', builder.toSql())
  t.deepEqual(['2021-08-07'], builder.getBindings())

  builder = getMySqlBuilder()
  builder.select('*').from('users').whereDay('created_at', 1)
  t.is('select * from `users` where day(`created_at`) = ?', builder.toSql())

  builder = getMySqlBuilder()
  builder.select('*').from('users').whereDay('created_at', new Date('2021/08/07'))
  t.is('select * from `users` where day(`created_at`) = ?', builder.toSql())
  t.deepEqual(['07'], builder.getBindings())

  builder = getMySqlBuilder()
  builder.select('*').from('users').whereMonth('created_at', 1)
  t.is('select * from `users` where month(`created_at`) = ?', builder.toSql())

  builder = getMySqlBuilder()
  builder.select('*').from('users').whereYear('created_at', 1)
  t.is('select * from `users` where year(`created_at`) = ?', builder.toSql())

  builder = getMySqlBuilder()
  builder.select('*').from('users').whereYear('created_at', new Date('2021/08/07'))
  t.is('select * from `users` where year(`created_at`) = ?', builder.toSql())
  t.deepEqual(['2021'], builder.getBindings())
})

test('testDateBasedOrWheresAcceptsTwoArguments', t => {
  let builder = getMySqlBuilder()
  builder.select('*').from('users').where('id', 1).orWhereDate('created_at', 1)
  t.is('select * from `users` where `id` = ? or date(`created_at`) = ?', builder.toSql())

  builder = getMySqlBuilder()
  builder.select('*').from('users').where('id', 1).orWhereDay('created_at', 1)
  t.is('select * from `users` where `id` = ? or day(`created_at`) = ?', builder.toSql())

  builder = getMySqlBuilder()
  builder.select('*').from('users').where('id', 1).orWhereMonth('created_at', 1)
  t.is('select * from `users` where `id` = ? or month(`created_at`) = ?', builder.toSql())

  builder = getMySqlBuilder()
  builder.select('*').from('users').where('id', 1).orWhereYear('created_at', 1)
  t.is('select * from `users` where `id` = ? or year(`created_at`) = ?', builder.toSql())
})

test('testDateBasedWheresExpressionIsNotBound', t => {
  let builder = getBuilder()
  builder.select('*').from('users').whereDate('created_at', new Raw('NOW()')).where('admin', true)
  t.deepEqual([true], builder.getBindings())

  builder = getBuilder()
  builder.select('*').from('users').whereDay('created_at', new Raw('NOW()'))
  t.deepEqual([], builder.getBindings())

  builder = getBuilder()
  builder.select('*').from('users').whereMonth('created_at', new Raw('NOW()'))
  t.deepEqual([], builder.getBindings())

  builder = getBuilder()
  builder.select('*').from('users').whereYear('created_at', new Raw('NOW()'))
  t.deepEqual([], builder.getBindings())
})

test('testWhereDateMySql', t => {
  let builder = getMySqlBuilder()
  builder.select('*').from('users').whereDate('created_at', '=', '2015-12-21')
  t.is('select * from `users` where date(`created_at`) = ?', builder.toSql())
  t.deepEqual(['2015-12-21'], builder.getBindings())

  builder = getMySqlBuilder()
  builder.select('*').from('users').whereDate('created_at', '=', new Raw('NOW()'))
  t.is('select * from `users` where date(`created_at`) = NOW()', builder.toSql())
})

test('testWhereDayMySql', t => {
  const builder = getMySqlBuilder()
  builder.select('*').from('users').whereDay('created_at', '=', 1)
  t.is('select * from `users` where day(`created_at`) = ?', builder.toSql())
  t.deepEqual([1], builder.getBindings())
})

test('testOrWhereDayMySql', t => {
  const builder = getMySqlBuilder()
  builder.select('*').from('users').whereDay('created_at', '=', 1).orWhereDay('created_at', '=', 2)
  t.is('select * from `users` where day(`created_at`) = ? or day(`created_at`) = ?', builder.toSql())
  t.deepEqual([1, 2], builder.getBindings())
})

test('testOrWhereDayPostgres', async (t) => {
  const builder = getPostgresBuilder()
  builder.select('*').from('users').whereDay('created_at', '=', 1).orWhereDay('created_at', '=', 2)
  t.is('select * from "users" where extract(day from "created_at") = ? or extract(day from "created_at") = ?', builder.toSql())
  t.deepEqual([1, 2], builder.getBindings())
})

test('testOrWhereDaySqlServer', async (t) => {
  const builder = getSqlServerBuilder()
  builder.select('*').from('users').whereDay('created_at', '=', 1).orWhereDay('created_at', '=', 2)
  t.is('select * from [users] where day([created_at]) = ? or day([created_at]) = ?', builder.toSql())
  t.deepEqual([1, 2], builder.getBindings())
})

test('testWhereMonthMySql', t => {
  let builder = getMySqlBuilder()
  builder.select('*').from('users').whereMonth('created_at', '=', 5)
  t.is('select * from `users` where month(`created_at`) = ?', builder.toSql())
  t.deepEqual(['05'], builder.getBindings())

  builder = getMySqlBuilder()
  builder.select('*').from('users').whereMonth('created_at', '=', new Date('2021/08/10'))
  t.is('select * from `users` where month(`created_at`) = ?', builder.toSql())
  t.deepEqual(['08'], builder.getBindings())
})

test('testOrWhereMonthMySql', t => {
  const builder = getMySqlBuilder()
  builder.select('*').from('users').whereMonth('created_at', '=', 5).orWhereMonth('created_at', '=', 6)
  t.is('select * from `users` where month(`created_at`) = ? or month(`created_at`) = ?', builder.toSql())
  t.deepEqual(builder.getBindings(), ['05', '06'])
})

test('testOrWhereMonthPostgres', async (t) => {
  const builder = getPostgresBuilder()
  builder.select('*').from('users').whereMonth('created_at', '=', 5).orWhereMonth('created_at', '=', 6)
  t.is('select * from "users" where extract(month from "created_at") = ? or extract(month from "created_at") = ?', builder.toSql())
  t.deepEqual(builder.getBindings(), ['05', '06'])
})

test('testOrWhereMonthSqlServer', async (t) => {
  const builder = getSqlServerBuilder()
  builder.select('*').from('users').whereMonth('created_at', '=', 5).orWhereMonth('created_at', '=', 6)
  t.is('select * from [users] where month([created_at]) = ? or month([created_at]) = ?', builder.toSql())
  t.deepEqual(['05', '06'], builder.getBindings())
})

test('testWhereYearMySql', t => {
  const builder = getMySqlBuilder()
  builder.select('*').from('users').whereYear('created_at', '=', 2014)
  t.is('select * from `users` where year(`created_at`) = ?', builder.toSql())
  t.deepEqual([2014], builder.getBindings())
})

test('testOrWhereYearMySql', t => {
  const builder = getMySqlBuilder()
  builder.select('*').from('users').whereYear('created_at', '=', 2014).orWhereYear('created_at', '=', 2015)
  t.is('select * from `users` where year(`created_at`) = ? or year(`created_at`) = ?', builder.toSql())
  t.deepEqual([2014, 2015], builder.getBindings())
})

test('testOrWhereYearPostgres', async (t) => {
  const builder = getPostgresBuilder()
  builder.select('*').from('users').whereYear('created_at', '=', 2014).orWhereYear('created_at', '=', 2015)
  t.is('select * from "users" where extract(year from "created_at") = ? or extract(year from "created_at") = ?', builder.toSql())
  t.deepEqual([2014, 2015], builder.getBindings())
})

test('testOrWhereYearSqlServer', async (t) => {
  const builder = getSqlServerBuilder()
  builder.select('*').from('users').whereYear('created_at', '=', 2014).orWhereYear('created_at', '=', 2015)
  t.is('select * from [users] where year([created_at]) = ? or year([created_at]) = ?', builder.toSql())
  t.deepEqual([2014, 2015], builder.getBindings())
})

test('testWhereTimeMySql', t => {
  let builder = getMySqlBuilder()
  builder.select('*').from('users').whereTime('created_at', '>=', '22:00')
  t.is('select * from `users` where time(`created_at`) >= ?', builder.toSql())
  t.deepEqual(['22:00'], builder.getBindings())

  builder = getMySqlBuilder()
  builder.select('*').from('users').whereTime('created_at', '>=', new Date('2021-08-10T22:00:09'))
  t.is('select * from `users` where time(`created_at`) >= ?', builder.toSql())
  t.deepEqual(['22:00:09'], builder.getBindings())
})

test('testWhereTimeOperatorOptionalMySql', t => {
  const builder = getMySqlBuilder()
  builder.select('*').from('users').whereTime('created_at', '22:00')

  t.is('select * from `users` where time(`created_at`) = ?', builder.toSql())
  t.deepEqual(['22:00'], builder.getBindings())
})

test('testWhereTimeOperatorOptionalPostgres', t => {
  const builder = getPostgresBuilder()
  builder.select('*').from('users').whereTime('created_at', '22:00')

  t.is('select * from "users" where "created_at"::time = ?', builder.toSql())
  t.deepEqual(['22:00'], builder.getBindings())
})

test('testWhereTimeSqlServer', t => {
  let builder = getSqlServerBuilder()
  builder.select('*').from('users').whereTime('created_at', '22:00')
  t.is(builder.toSql(), 'select * from [users] where cast([created_at] as time) = ?')
  t.deepEqual(builder.getBindings(), ['22:00'])

  builder = getSqlServerBuilder()
  builder.select('*').from('users').whereTime('created_at', new Raw('NOW()'))
  t.is(builder.toSql(), 'select * from [users] where cast([created_at] as time) = NOW()')
  t.deepEqual(builder.getBindings(), [])
})

test('testOrWhereTimeMySql', async (t) => {
  const builder = getMySqlBuilder()
  builder.select('*').from('users').whereTime('created_at', '<=', '10:00').orWhereTime('created_at', '>=', '22:00')
  t.is('select * from `users` where time(`created_at`) <= ? or time(`created_at`) >= ?', builder.toSql())
  t.deepEqual(builder.getBindings(), ['10:00', '22:00'])
})

test('testOrWhereTimePostgres', async (t) => {
  const builder = getPostgresBuilder()
  builder.select('*').from('users').whereTime('created_at', '<=', '10:00').orWhereTime('created_at', '>=', '22:00')
  t.is('select * from "users" where "created_at"::time <= ? or "created_at"::time >= ?', builder.toSql())
  t.deepEqual(builder.getBindings(), ['10:00', '22:00'])
})

test('testOrWhereTimeSqlServer', async (t) => {
  let builder = getSqlServerBuilder()
  builder.select('*').from('users').whereTime('created_at', '<=', '10:00').orWhereTime('created_at', '>=', '22:00')
  t.is('select * from [users] where cast([created_at] as time) <= ? or cast([created_at] as time) >= ?', builder.toSql())
  t.deepEqual(builder.getBindings(), ['10:00', '22:00'])

  builder = getSqlServerBuilder()
  builder.select('*').from('users').whereTime('created_at', '<=', '10:00').orWhereTime('created_at', new Raw('NOW()'))
  t.is('select * from [users] where cast([created_at] as time) <= ? or cast([created_at] as time) = NOW()', builder.toSql())
  t.deepEqual(builder.getBindings(), ['10:00'])
})

test('testWhereDatePostgres', t => {
  let builder = getPostgresBuilder()
  builder.select('*').from('users').whereDate('created_at', '=', '2015-12-21')

  t.is('select * from "users" where "created_at"::date = ?', builder.toSql())
  t.deepEqual(['2015-12-21'], builder.getBindings())

  builder = getPostgresBuilder()
  builder.select('*').from('users').whereDate('created_at', new Raw('NOW()'))
  t.is('select * from "users" where "created_at"::date = NOW()', builder.toSql())
})

test('testWhereDayPostgres', t => {
  const builder = getPostgresBuilder()
  builder.select('*').from('users').whereDay('created_at', '=', 1)

  t.is('select * from "users" where extract(day from "created_at") = ?', builder.toSql())
  t.deepEqual([1], builder.getBindings())
})

test('testWhereMonthPostgres', t => {
  const builder = getPostgresBuilder()
  builder.select('*').from('users').whereMonth('created_at', '=', 5)

  t.is('select * from "users" where extract(month from "created_at") = ?', builder.toSql())
  t.deepEqual(['05'], builder.getBindings())
})

test('testWhereYearPostgres', t => {
  const builder = getPostgresBuilder()
  builder.select('*').from('users').whereYear('created_at', '=', 2014)

  t.is('select * from "users" where extract(year from "created_at") = ?', builder.toSql())
  t.deepEqual([2014], builder.getBindings())
})

test('testWhereTimePostgres', t => {
  const builder = getPostgresBuilder()
  builder.select('*').from('users').whereTime('created_at', '>=', '22:00')

  t.is('select * from "users" where "created_at"::time >= ?', builder.toSql())
  t.deepEqual(['22:00'], builder.getBindings())
})

test('testWhereLikePostgres', t => {
  let builder = getPostgresBuilder()
  builder.select('*').from('users').where('id', 'like', '1')

  t.is('select * from "users" where "id"::text like ?', builder.toSql())
  t.deepEqual(['1'], builder.getBindings())

  builder = getPostgresBuilder()
  builder.select('*').from('users').where('id', 'LIKE', '1')
  t.is('select * from "users" where "id"::text LIKE ?', builder.toSql())
  t.deepEqual(['1'], builder.getBindings())

  builder = getPostgresBuilder()
  builder.select('*').from('users').where('id', 'ilike', '1')

  t.is('select * from "users" where "id"::text ilike ?', builder.toSql())
  t.deepEqual(['1'], builder.getBindings())

  builder = getPostgresBuilder()
  builder.select('*').from('users').where('id', 'not like', '1')

  t.is('select * from "users" where "id"::text not like ?', builder.toSql())
  t.deepEqual(['1'], builder.getBindings())

  builder = getPostgresBuilder()
  builder.select('*').from('users').where('id', 'not ilike', '1')

  t.is('select * from "users" where "id"::text not ilike ?', builder.toSql())
  t.deepEqual(['1'], builder.getBindings())
})

test('testWhereDateSqlite', t => {
  let builder = getSQLiteBuilder()
  builder.select('*').from('users').whereDate('created_at', '=', '2015-12-21')

  t.is('select * from "users" where strftime(\'%Y-%m-%d\', "created_at") = cast(? as text)', builder.toSql())
  t.deepEqual(['2015-12-21'], builder.getBindings())

  builder = getSQLiteBuilder()
  builder.select('*').from('users').whereDate('created_at', new Raw('NOW()'))
  t.is('select * from "users" where strftime(\'%Y-%m-%d\', "created_at") = cast(NOW() as text)', builder.toSql())
})

test('testWhereDaySqlite', t => {
  const builder = getSQLiteBuilder()
  builder.select('*').from('users').whereDay('created_at', '=', 1)

  t.is('select * from "users" where strftime(\'%d\', "created_at") = cast(? as text)', builder.toSql())
  t.deepEqual([1], builder.getBindings())
})

test('testWhereMonthSqlite', t => {
  const builder = getSQLiteBuilder()
  builder.select('*').from('users').whereMonth('created_at', '=', 5)
  t.is('select * from "users" where strftime(\'%m\', "created_at") = cast(? as text)', builder.toSql())
  t.deepEqual(['05'], builder.getBindings())
})

test('testWhereYearSqlite', t => {
  const builder = getSQLiteBuilder()
  builder.select('*').from('users').whereYear('created_at', '=', 2014)
  t.is('select * from "users" where strftime(\'%Y\', "created_at") = cast(? as text)', builder.toSql())
  t.deepEqual([2014], builder.getBindings())
})

test('testWhereTimeSqlite', t => {
  const builder = getSQLiteBuilder()
  builder.select('*').from('users').whereTime('created_at', '>=', '22:00')
  t.is('select * from "users" where strftime(\'%H:%M:%S\', "created_at") >= cast(? as text)', builder.toSql())
  t.deepEqual(['22:00'], builder.getBindings())
})

test('testWhereTimeOperatorOptionalSqlite', t => {
  const builder = getSQLiteBuilder()
  builder.select('*').from('users').whereTime('created_at', '22:00')
  t.is('select * from "users" where strftime(\'%H:%M:%S\', "created_at") = cast(? as text)', builder.toSql())
  t.deepEqual(['22:00'], builder.getBindings())
})

test('testWhereDateSqlServer', t => {
  let builder = getSqlServerBuilder()
  builder.select('*').from('users').whereDate('created_at', '=', '2015-12-21')
  t.is('select * from [users] where cast([created_at] as date) = ?', builder.toSql())
  t.deepEqual(['2015-12-21'], builder.getBindings())

  builder = getSqlServerBuilder()
  builder.select('*').from('users').whereDate('created_at', new Raw('NOW()'))
  t.is('select * from [users] where cast([created_at] as date) = NOW()', builder.toSql())
})

test('testWhereDaySqlServer', t => {
  const builder = getSqlServerBuilder()
  builder.select('*').from('users').whereDay('created_at', '=', 1)
  t.is('select * from [users] where day([created_at]) = ?', builder.toSql())
  t.deepEqual([1], builder.getBindings())
})

test('testWhereMonthSqlServer', t => {
  const builder = getSqlServerBuilder()
  builder.select('*').from('users').whereMonth('created_at', '=', 5)
  t.is('select * from [users] where month([created_at]) = ?', builder.toSql())
  t.deepEqual(['05'], builder.getBindings())
})

test('testWhereYearSqlServer', t => {
  const builder = getSqlServerBuilder()
  builder.select('*').from('users').whereYear('created_at', '=', 2014)
  t.is('select * from [users] where year([created_at]) = ?', builder.toSql())
  t.deepEqual([2014], builder.getBindings())
})

test('testWhereBetweens', t => {
  let builder = getBuilder()
  builder.select('*').from('users').whereBetween('id', [1, 2])
  t.is('select * from "users" where "id" between ? and ?', builder.toSql())
  t.deepEqual([1, 2], builder.getBindings())

  builder = getBuilder()
  builder.select('*').from('users').whereBetween('id', [[1, 2, 3]])
  t.is('select * from "users" where "id" between ? and ?', builder.toSql())
  t.deepEqual([1, 2], builder.getBindings())

  builder = getBuilder()
  builder.select('*').from('users').whereBetween('id', [[1], [2, 3]])
  t.is('select * from "users" where "id" between ? and ?', builder.toSql())
  t.deepEqual([1, 2], builder.getBindings())

  builder = getBuilder()
  builder.select('*').from('users').whereNotBetween('id', [1, 2])
  t.is('select * from "users" where "id" not between ? and ?', builder.toSql())
  t.deepEqual([1, 2], builder.getBindings())

  builder = getBuilder()
  builder.select('*').from('users').whereBetween('id', [new Raw(1), new Raw(2)])
  t.is('select * from "users" where "id" between 1 and 2', builder.toSql())
  t.deepEqual([], builder.getBindings())
})

test('testOrWhereBetween', async (t) => {
  let builder = getBuilder()
  builder.select('*').from('users').where('id', '=', 1).orWhereBetween('id', [3, 5])
  t.is('select * from "users" where "id" = ? or "id" between ? and ?', builder.toSql())
  t.deepEqual([1, 3, 5], builder.getBindings())

  builder = getBuilder()
  builder.select('*').from('users').where('id', '=', 1).orWhereBetween('id', [[3, 4, 5]])
  t.is('select * from "users" where "id" = ? or "id" between ? and ?', builder.toSql())
  t.deepEqual([1, 3, 4], builder.getBindings())

  builder = getBuilder()
  builder.select('*').from('users').where('id', '=', 1).orWhereBetween('id', [[3, 5]])
  t.is('select * from "users" where "id" = ? or "id" between ? and ?', builder.toSql())
  t.deepEqual([1, 3, 5], builder.getBindings())

  builder = getBuilder()
  builder.select('*').from('users').where('id', '=', 1).orWhereBetween('id', [[4], [6, 8]])
  t.is('select * from "users" where "id" = ? or "id" between ? and ?', builder.toSql())
  t.deepEqual([1, 4, 6], builder.getBindings())

  builder = getBuilder()
  builder.select('*').from('users').where('id', '=', 1).orWhereBetween('id', collect([3, 4]))
  t.is('select * from "users" where "id" = ? or "id" between ? and ?', builder.toSql())
  t.deepEqual([1, 3, 4], builder.getBindings())

  builder = getBuilder()
  builder.select('*').from('users').where('id', '=', 1).orWhereBetween('id', [new Raw(3), new Raw(4)])
  t.is('select * from "users" where "id" = ? or "id" between 3 and 4', builder.toSql())
  t.deepEqual([1], builder.getBindings())
})

test('testOrWhereNotBetween', async (t) => {
  let builder = getBuilder()
  builder.select('*').from('users').where('id', '=', 1).orWhereNotBetween('id', [3, 5])
  t.is('select * from "users" where "id" = ? or "id" not between ? and ?', builder.toSql())
  t.deepEqual([1, 3, 5], builder.getBindings())

  builder = getBuilder()
  builder.select('*').from('users').where('id', '=', 1).orWhereNotBetween('id', [[3, 4, 5]])
  t.is('select * from "users" where "id" = ? or "id" not between ? and ?', builder.toSql())
  t.deepEqual([1, 3, 4], builder.getBindings())

  builder = getBuilder()
  builder.select('*').from('users').where('id', '=', 1).orWhereNotBetween('id', [[3, 5]])
  t.is('select * from "users" where "id" = ? or "id" not between ? and ?', builder.toSql())
  t.deepEqual([1, 3, 5], builder.getBindings())

  builder = getBuilder()
  builder.select('*').from('users').where('id', '=', 1).orWhereNotBetween('id', [[4], [6, 8]])
  t.is('select * from "users" where "id" = ? or "id" not between ? and ?', builder.toSql())
  t.deepEqual([1, 4, 6], builder.getBindings())

  builder = getBuilder()
  builder.select('*').from('users').where('id', '=', 1).orWhereNotBetween('id', collect([3, 4]))
  t.is('select * from "users" where "id" = ? or "id" not between ? and ?', builder.toSql())
  t.deepEqual([1, 3, 4], builder.getBindings())

  builder = getBuilder()
  builder.select('*').from('users').where('id', '=', 1).orWhereNotBetween('id', [new Raw(3), new Raw(4)])
  t.is('select * from "users" where "id" = ? or "id" not between 3 and 4', builder.toSql())
  t.deepEqual([1], builder.getBindings())
})

test('testWhereBetweenColumns', t => {
  let builder = getBuilder()
  builder.select('*').from('users').whereBetweenColumns('id', ['users.created_at', 'users.updated_at'])
  t.is('select * from "users" where "id" between "users"."created_at" and "users"."updated_at"', builder.toSql())
  t.deepEqual([], builder.getBindings())

  builder = getBuilder()
  builder.select('*').from('users').whereNotBetweenColumns('id', ['created_at', 'updated_at'])
  t.is('select * from "users" where "id" not between "created_at" and "updated_at"', builder.toSql())
  t.deepEqual([], builder.getBindings())

  builder = getBuilder()
  builder.select('*').from('users').whereBetweenColumns('id', [new Raw(1), new Raw(2)])
  t.is('select * from "users" where "id" between 1 and 2', builder.toSql())
  t.deepEqual([], builder.getBindings())
})

test('testOrWhereBetweenColumns', async (t) => {
  let builder = getBuilder()
  builder.select('*').from('users').where('id', 2).orWhereBetweenColumns('id', ['users.created_at', 'users.updated_at'])
  t.is('select * from "users" where "id" = ? or "id" between "users"."created_at" and "users"."updated_at"', builder.toSql())
  t.deepEqual(builder.getBindings(), [2])

  builder = getBuilder()
  builder.select('*').from('users').where('id', 2).orWhereBetweenColumns('id', ['created_at', 'updated_at'])
  t.is('select * from "users" where "id" = ? or "id" between "created_at" and "updated_at"', builder.toSql())
  t.deepEqual(builder.getBindings(), [2])

  builder = getBuilder()
  builder.select('*').from('users').where('id', 2).orWhereBetweenColumns('id', [new Raw(1), new Raw(2)])
  t.is('select * from "users" where "id" = ? or "id" between 1 and 2', builder.toSql())
  t.deepEqual(builder.getBindings(), [2])
})

test('testOrWhereNotBetweenColumns', async (t) => {
  let builder = getBuilder()
  builder.select('*').from('users').where('id', 2).orWhereNotBetweenColumns('id', ['users.created_at', 'users.updated_at'])
  t.is('select * from "users" where "id" = ? or "id" not between "users"."created_at" and "users"."updated_at"', builder.toSql())
  t.deepEqual(builder.getBindings(), [2])

  builder = getBuilder()
  builder.select('*').from('users').where('id', 2).orWhereNotBetweenColumns('id', ['created_at', 'updated_at'])
  t.is('select * from "users" where "id" = ? or "id" not between "created_at" and "updated_at"', builder.toSql())
  t.deepEqual(builder.getBindings(), [2])

  builder = getBuilder()
  builder.select('*').from('users').where('id', 2).orWhereNotBetweenColumns('id', [new Raw(1), new Raw(2)])
  t.is('select * from "users" where "id" = ? or "id" not between 1 and 2', builder.toSql())
  t.deepEqual(builder.getBindings(), [2])
})

test('testBasicOrWheres', t => {
  const builder = getBuilder()
  builder.select('*').from('users').where('id', '=', 1).orWhere('email', '=', 'foo')
  t.is('select * from "users" where "id" = ? or "email" = ?', builder.toSql())
  t.deepEqual([1, 'foo'], builder.getBindings())
})

test('testBasicOrWhereNot', async (t) => {
  const builder = getBuilder()
  builder.select('*').from('users').orWhereNot('name', 'foo').orWhereNot('name', '<>', 'bar')
  t.is('select * from "users" where not "name" = ? or not "name" <> ?', builder.toSql())
  t.deepEqual(builder.getBindings(), ['foo', 'bar'])
})

test('testRawWheres', t => {
  const builder = getBuilder()
  builder.select('*').from('users').whereRaw('id = ? or email = ?', [1, 'foo'])
  t.is('select * from "users" where id = ? or email = ?', builder.toSql())
  t.deepEqual([1, 'foo'], builder.getBindings())
})

test('testRawOrWheres', t => {
  const builder = getBuilder()
  builder.select('*').from('users').where('id', '=', 1).orWhereRaw('email = ?', ['foo'])
  t.is('select * from "users" where "id" = ? or email = ?', builder.toSql())
  t.deepEqual([1, 'foo'], builder.getBindings())
})

test('testBasicWhereIns', t => {
  let builder = getBuilder()
  builder.select('*').from('users').whereIn('id', [1, 2, 3])
  t.is('select * from "users" where "id" in (?, ?, ?)', builder.toSql())
  t.deepEqual([1, 2, 3], builder.getBindings())

  builder = getBuilder()
  builder.select('*').from('users').where('id', '=', 1).orWhereIn('id', [1, 2, 3])
  t.is('select * from "users" where "id" = ? or "id" in (?, ?, ?)', builder.toSql())
  t.deepEqual([1, 1, 2, 3], builder.getBindings())
})

test('testBasicWhereInsException', async (t) => {
  const error = t.throws(() => {
    const builder = getBuilder()
    builder.select('*').from('users').whereIn('id', [
      {
        a: 1,
        b: 1
      },
      { c: 2 },
      [3]
    ])
  }, { instanceOf: Error })

  t.true(error.message.includes('InvalidArgumentException'))
})

test('testBasicWhereNotIns', t => {
  let builder = getBuilder()
  builder.select('*').from('users').whereNotIn('id', [1, 2, 3])
  t.is('select * from "users" where "id" not in (?, ?, ?)', builder.toSql())
  t.deepEqual([1, 2, 3], builder.getBindings())

  builder = getBuilder()
  builder.select('*').from('users').where('id', '=', 1).orWhereNotIn('id', [1, 2, 3])
  t.is('select * from "users" where "id" = ? or "id" not in (?, ?, ?)', builder.toSql())
  t.deepEqual([1, 1, 2, 3], builder.getBindings())
})

test('testRawWhereIns', t => {
  let builder = getBuilder()
  builder.select('*').from('users').whereIn('id', [new Raw(1)])
  t.is('select * from "users" where "id" in (1)', builder.toSql())

  builder = getBuilder()
  builder.select('*').from('users').where('id', '=', 1).orWhereIn('id', [new Raw(1)])
  t.is('select * from "users" where "id" = ? or "id" in (1)', builder.toSql())
  t.deepEqual([1], builder.getBindings())
})

test('testEmptyWhereIns', t => {
  let builder = getBuilder()
  builder.select('*').from('users').whereIn('id', [])
  t.is('select * from "users" where 0 = 1', builder.toSql())
  t.deepEqual([], builder.getBindings())

  builder = getBuilder()
  builder.select('*').from('users').where('id', '=', 1).orWhereIn('id', [])
  t.is('select * from "users" where "id" = ? or 0 = 1', builder.toSql())
  t.deepEqual([1], builder.getBindings())
})

test('testEmptyWhereNotIns', t => {
  let builder = getBuilder()
  builder.select('*').from('users').whereNotIn('id', [])
  t.is('select * from "users" where 1 = 1', builder.toSql())
  t.deepEqual([], builder.getBindings())

  builder = getBuilder()
  builder.select('*').from('users').where('id', '=', 1).orWhereNotIn('id', [])
  t.is('select * from "users" where "id" = ? or 1 = 1', builder.toSql())
  t.deepEqual([1], builder.getBindings())
})

test('testWhereIntegerInRaw', t => {
  const builder = getBuilder()
  builder.select('*').from('users').whereIntegerInRaw('id', ['1a', 2])
  t.is('select * from "users" where "id" in (1, 2)', builder.toSql())
  t.deepEqual([], builder.getBindings())
})

test('testOrWhereIntegerInRaw', t => {
  const builder = getBuilder()
  builder.select('*').from('users').where('id', '=', 1).orWhereIntegerInRaw('id', ['1a', 2])
  t.is('select * from "users" where "id" = ? or "id" in (1, 2)', builder.toSql())
  t.deepEqual([1], builder.getBindings())
})

test('testWhereIntegerNotInRaw', t => {
  const builder = getBuilder()
  builder.select('*').from('users').whereIntegerNotInRaw('id', ['1a', 2])
  t.is('select * from "users" where "id" not in (1, 2)', builder.toSql())
  t.deepEqual([], builder.getBindings())
})

test('testOrWhereIntegerNotInRaw', t => {
  const builder = getBuilder()
  builder.select('*').from('users').where('id', '=', 1).orWhereIntegerNotInRaw('id', ['1a', 2])
  t.is('select * from "users" where "id" = ? or "id" not in (1, 2)', builder.toSql())
  t.deepEqual([1], builder.getBindings())
})

test('testEmptyWhereIntegerInRaw', t => {
  const builder = getBuilder()
  builder.select('*').from('users').whereIntegerInRaw('id', [])
  t.is('select * from "users" where 0 = 1', builder.toSql())
  t.deepEqual([], builder.getBindings())
})

test('testEmptyWhereIntegerNotInRaw', t => {
  const builder = getBuilder()
  builder.select('*').from('users').whereIntegerNotInRaw('id', [])
  t.is('select * from "users" where 1 = 1', builder.toSql())
  t.deepEqual([], builder.getBindings())
})

test('testBasicWhereColumn', t => {
  let builder = getBuilder()
  builder.select('*').from('users').whereColumn('first_name', 'last_name').orWhereColumn('first_name', 'middle_name')
  t.is('select * from "users" where "first_name" = "last_name" or "first_name" = "middle_name"', builder.toSql())
  t.deepEqual([], builder.getBindings())

  builder = getBuilder()
  builder.select('*').from('users').whereColumn('updated_at', '>', 'created_at')
  t.is('select * from "users" where "updated_at" > "created_at"', builder.toSql())
  t.deepEqual([], builder.getBindings())
})

test('testArrayWhereColumn', t => {
  const conditions = [
    ['first_name', 'last_name'],
    ['updated_at', '>', 'created_at']
  ]

  const builder = getBuilder()
  builder.select('*').from('users').whereColumn(conditions)
  t.is('select * from "users" where ("first_name" = "last_name" and "updated_at" > "created_at")', builder.toSql())
  t.deepEqual([], builder.getBindings())
})

test('testWhereFulltextMySql', t => {
  let builder = getMySqlBuilderWithProcessor()
  builder.select('*').from('users').whereFulltext('body', 'Hello World')
  t.is('select * from `users` where match (`body`) against (? in natural language mode)', builder.toSql())
  t.deepEqual(['Hello World'], builder.getBindings())

  builder = getMySqlBuilderWithProcessor()
  builder.select('*').from('users').whereFulltext('body', 'Hello World', { expanded: true })
  t.is('select * from `users` where match (`body`) against (? in natural language mode with query expansion)', builder.toSql())
  t.deepEqual(['Hello World'], builder.getBindings())

  builder = getMySqlBuilderWithProcessor()
  builder.select('*').from('users').whereFulltext('body', '+Hello -World', { mode: 'boolean' })
  t.is('select * from `users` where match (`body`) against (? in boolean mode)', builder.toSql())
  t.deepEqual(['+Hello -World'], builder.getBindings())

  builder = getMySqlBuilderWithProcessor()
  builder.select('*').from('users').whereFulltext('body', '+Hello -World', { mode: 'boolean', expanded: true })
  t.is('select * from `users` where match (`body`) against (? in boolean mode)', builder.toSql())
  t.deepEqual(['+Hello -World'], builder.getBindings())

  builder = getMySqlBuilderWithProcessor()
  builder.select('*').from('users').whereFulltext(['body', 'title'], 'Car,Plane')
  t.is('select * from `users` where match (`body`, `title`) against (? in natural language mode)', builder.toSql())
  t.deepEqual(['Car,Plane'], builder.getBindings())
})

test('testWhereFulltextPostgres', t => {
  let builder = getPostgresBuilderWithProcessor()
  builder.select('*').from('users').whereFulltext('body', 'Hello World')
  t.is('select * from "users" where (to_tsvector(\'english\', "body")) @@ plainto_tsquery(\'english\', ?)', builder.toSql())
  t.deepEqual(['Hello World'], builder.getBindings())

  builder = getPostgresBuilderWithProcessor()
  builder.select('*').from('users').whereFulltext('body', 'Hello World', { language: 'simple' })
  t.is('select * from "users" where (to_tsvector(\'simple\', "body")) @@ plainto_tsquery(\'simple\', ?)', builder.toSql())
  t.deepEqual(['Hello World'], builder.getBindings())

  builder = getPostgresBuilderWithProcessor()
  builder.select('*').from('users').whereFulltext('body', 'Hello World', { mode: 'plain' })
  t.is('select * from "users" where (to_tsvector(\'english\', "body")) @@ plainto_tsquery(\'english\', ?)', builder.toSql())
  t.deepEqual(['Hello World'], builder.getBindings())

  builder = getPostgresBuilderWithProcessor()
  builder.select('*').from('users').whereFulltext('body', 'Hello World', { mode: 'phrase' })
  t.is('select * from "users" where (to_tsvector(\'english\', "body")) @@ phraseto_tsquery(\'english\', ?)', builder.toSql())
  t.deepEqual(['Hello World'], builder.getBindings())

  builder = getPostgresBuilderWithProcessor()
  builder.select('*').from('users').whereFulltext('body', '+Hello -World', { mode: 'websearch' })
  t.is('select * from "users" where (to_tsvector(\'english\', "body")) @@ websearch_to_tsquery(\'english\', ?)', builder.toSql())
  t.deepEqual(['+Hello -World'], builder.getBindings())

  builder = getPostgresBuilderWithProcessor()
  builder.select('*').from('users').whereFulltext('body', 'Hello World', { language: 'simple', mode: 'plain' })
  t.is('select * from "users" where (to_tsvector(\'simple\', "body")) @@ plainto_tsquery(\'simple\', ?)', builder.toSql())
  t.deepEqual(['Hello World'], builder.getBindings())

  builder = getPostgresBuilderWithProcessor()
  builder.select('*').from('users').whereFulltext(['body', 'title'], 'Car Plane')
  t.is('select * from "users" where (to_tsvector(\'english\', "body") || to_tsvector(\'english\', "title")) @@ plainto_tsquery(\'english\', ?)', builder.toSql())
  t.deepEqual(['Car Plane'], builder.getBindings())
})

test('testUnions', t => {
  let builder = getBuilder()
  builder.select('*').from('users').where('id', '=', 1)
  builder.union(getBuilder().select('*').from('users').where('id', '=', 2))
  t.is('(select * from "users" where "id" = ?) union (select * from "users" where "id" = ?)', builder.toSql())
  t.deepEqual([1, 2], builder.getBindings())

  builder = getMySqlBuilder()
  builder.select('*').from('users').where('id', '=', 1)
  builder.union(getMySqlBuilder().select('*').from('users').where('id', '=', 2))
  t.is('(select * from `users` where `id` = ?) union (select * from `users` where `id` = ?)', builder.toSql())
  t.deepEqual([1, 2], builder.getBindings())

  builder = getMySqlBuilder()
  let expectedSql = '(select `a` from `t1` where `a` = ? and `b` = ?) union (select `a` from `t2` where `a` = ? and `b` = ?) order by `a` asc limit 10'
  const union = getMySqlBuilder().select('a').from('t2').where('a', 11).where('b', 2)
  builder.select('a').from('t1').where('a', 10).where('b', 1).union(union).orderBy('a').limit(10)
  t.deepEqual(expectedSql, builder.toSql())
  t.deepEqual([10, 1, 11, 2], builder.getBindings())

  builder = getPostgresBuilder()
  expectedSql = '(select "name" from "users" where "id" = ?) union (select "name" from "users" where "id" = ?)'
  builder.select('name').from('users').where('id', '=', 1)
  builder.union(getPostgresBuilder().select('name').from('users').where('id', '=', 2))
  t.deepEqual(expectedSql, builder.toSql())
  t.deepEqual([1, 2], builder.getBindings())

  builder = getSQLiteBuilder()
  expectedSql = 'select * from (select "name" from "users" where "id" = ?) union select * from (select "name" from "users" where "id" = ?)'
  builder.select('name').from('users').where('id', '=', 1)
  builder.union(getSQLiteBuilder().select('name').from('users').where('id', '=', 2))
  t.deepEqual(expectedSql, builder.toSql())
  t.deepEqual([1, 2], builder.getBindings())

  builder = getSqlServerBuilder()
  expectedSql = 'select * from (select [name] from [users] where [id] = ?) as [temp_table] union select * from (select [name] from [users] where [id] = ?) as [temp_table]'
  builder.select('name').from('users').where('id', '=', 1)
  builder.union(getSqlServerBuilder().select('name').from('users').where('id', '=', 2))
  t.deepEqual(expectedSql, builder.toSql())
  t.deepEqual([1, 2], builder.getBindings())
})

test('testUnionAlls', t => {
  let builder = getBuilder()
  builder.select('*').from('users').where('id', '=', 1)
  builder.unionAll(getBuilder().select('*').from('users').where('id', '=', 2))
  t.is('(select * from "users" where "id" = ?) union all (select * from "users" where "id" = ?)', builder.toSql())
  t.deepEqual([1, 2], builder.getBindings())

  const expectedSql = '(select * from "users" where "id" = ?) union all (select * from "users" where "id" = ?)'
  builder = getPostgresBuilder()
  builder.select('*').from('users').where('id', '=', 1)
  builder.unionAll(getBuilder().select('*').from('users').where('id', '=', 2))
  t.is(expectedSql, builder.toSql())
  t.deepEqual([1, 2], builder.getBindings())
})

test('testMultipleUnions', t => {
  const builder = getBuilder()
  builder.select('*').from('users').where('id', '=', 1)
  builder.union(getBuilder().select('*').from('users').where('id', '=', 2))
  builder.union(getBuilder().select('*').from('users').where('id', '=', 3))
  t.is('(select * from "users" where "id" = ?) union (select * from "users" where "id" = ?) union (select * from "users" where "id" = ?)', builder.toSql())
  t.deepEqual([1, 2, 3], builder.getBindings())
})

test('testMultipleUnionAlls', t => {
  const builder = getBuilder()
  builder.select('*').from('users').where('id', '=', 1)
  builder.unionAll(getBuilder().select('*').from('users').where('id', '=', 2))
  builder.unionAll(getBuilder().select('*').from('users').where('id', '=', 3))
  t.is('(select * from "users" where "id" = ?) union all (select * from "users" where "id" = ?) union all (select * from "users" where "id" = ?)', builder.toSql())
  t.deepEqual([1, 2, 3], builder.getBindings())
})

test('testUnionOrderBys', t => {
  const builder = getBuilder()
  builder.select('*').from('users').where('id', '=', 1)
  builder.union(getBuilder().select('*').from('users').where('id', '=', 2))
  builder.orderBy('id', 'desc')

  t.is('(select * from "users" where "id" = ?) union (select * from "users" where "id" = ?) order by "id" desc', builder.toSql())
  t.deepEqual([1, 2], builder.getBindings())
})

test('testUnionLimitsAndOffsets', t => {
  let builder = getBuilder()
  builder.select('*').from('users')
  builder.union(getBuilder().select('*').from('dogs'))
  builder.skip(5).take(10)
  t.is('(select * from "users") union (select * from "dogs") limit 10 offset 5', builder.toSql())

  let expectedSql = '(select * from "users") union (select * from "dogs") limit 10 offset 5'
  builder = getPostgresBuilder()
  builder.select('*').from('users')
  builder.union(getBuilder().select('*').from('dogs'))
  builder.skip(5).take(10)
  t.is(expectedSql, builder.toSql())

  expectedSql = '(select * from "users" limit 11) union (select * from "dogs" limit 22) limit 10 offset 5'
  builder = getPostgresBuilder()
  builder.select('*').from('users').limit(11)
  builder.union(getBuilder().select('*').from('dogs').limit(22))
  builder.skip(5).take(10)
  t.is(expectedSql, builder.toSql())
})

test('testUnionWithJoin', t => {
  const builder = getBuilder()
  builder.select('*').from('users')
  builder.union(getBuilder().select('*').from('dogs').join('breeds', (join) => {
    join.on('dogs.breed_id', '=', 'breeds.id')
      .where('breeds.is_native', '=', 1)
  }))
  t.is('(select * from "users") union (select * from "dogs" inner join "breeds" on "dogs"."breed_id" = "breeds"."id" and "breeds"."is_native" = ?)', builder.toSql())
  t.deepEqual([1], builder.getBindings())
})

test('testMySqlUnionOrderBys', t => {
  const builder = getMySqlBuilder()
  builder.select('*').from('users').where('id', '=', 1)
  builder.union(getMySqlBuilder().select('*').from('users').where('id', '=', 2))
  builder.orderBy('id', 'desc')
  t.is('(select * from `users` where `id` = ?) union (select * from `users` where `id` = ?) order by `id` desc', builder.toSql())
  t.deepEqual([1, 2], builder.getBindings())
})

test('testMySqlUnionLimitsAndOffsets', t => {
  const builder = getMySqlBuilder()
  builder.select('*').from('users')
  builder.union(getMySqlBuilder().select('*').from('dogs'))
  builder.skip(5).take(10)
  t.is('(select * from `users`) union (select * from `dogs`) limit 10 offset 5', builder.toSql())
})

test('testUnionAggregate', t => {
  const { createMock, verifyMock } = mock()

  let expected = 'select count(*) as aggregate from ((select * from `posts`) union (select * from `videos`)) as `temp_table`'
  let builder = getMySqlBuilder()

  createMock(builder.getConnection()).expects('select').once().withArgs(expected, [])
  createMock(builder.getProcessor()).expects('processSelect').once()
  builder.from('posts').union(getMySqlBuilder().from('videos')).count()

  expected = 'select count(*) as aggregate from ((select `id` from `posts`) union (select `id` from `videos`)) as `temp_table`'
  builder = getMySqlBuilder()
  createMock(builder.getConnection()).expects('select').once().withArgs(expected, [])
  createMock(builder.getProcessor()).expects('processSelect').once()
  builder.from('posts').select('id').union(getMySqlBuilder().from('videos').select('id')).count()

  expected = 'select count(*) as aggregate from ((select * from "posts") union (select * from "videos")) as "temp_table"'
  builder = getPostgresBuilder()
  createMock(builder.getConnection()).expects('select').once().withArgs(expected, [])
  createMock(builder.getProcessor()).expects('processSelect').once()
  builder.from('posts').union(getPostgresBuilder().from('videos')).count()

  expected = 'select count(*) as aggregate from (select * from (select * from "posts") union select * from (select * from "videos")) as "temp_table"'
  builder = getSQLiteBuilder()
  createMock(builder.getConnection()).expects('select').once().withArgs(expected, [])
  createMock(builder.getProcessor()).expects('processSelect').once()
  builder.from('posts').union(getSQLiteBuilder().from('videos')).count()

  expected = 'select count(*) as aggregate from (select * from (select * from [posts]) as [temp_table] union select * from (select * from [videos]) as [temp_table]) as [temp_table]'
  builder = getSqlServerBuilder()
  createMock(builder.getConnection()).expects('select').once().withArgs(expected, [])
  createMock(builder.getProcessor()).expects('processSelect').once()
  builder.from('posts').union(getSqlServerBuilder().from('videos')).count()

  verifyMock()

  t.pass()
})

test('testHavingAggregate', async t => {
  const { createMock, verifyMock } = mock()

  const expected = 'select count(*) as aggregate from (select (select `count(*)` from `videos` where `posts`.`id` = `videos`.`post_id`) as `videos_count` from `posts` having `videos_count` > ?) as `temp_table`'
  const builder = getMySqlBuilder()
  const connectionMock = createMock(builder.getConnection())

  connectionMock.expects('getDatabaseName').twice()
  connectionMock.expects('select').once().withArgs(expected, [1]).returns([{ aggregate: 1 }])
  createMock(builder.getProcessor()).expects('processSelect').once().callsFake((builder, results) => {
    return results
  })

  builder.from('posts').selectSub((query) => {
    query.from('videos').select('count(*)').whereColumn('posts.id', '=', 'videos.post_id')
  }, 'videos_count').having('videos_count', '>', 1)
  await builder.count()

  verifyMock()

  t.pass()
})

test('testSubSelectWhereIns', t => {
  let builder = getBuilder()
  builder.select('*').from('users').whereIn('id', (query) => {
    query.select('id').from('users').where('age', '>', 25).take(3)
  })
  t.is(builder.toSql(), 'select * from "users" where "id" in (select "id" from "users" where "age" > ? limit 3)')
  t.deepEqual(builder.getBindings(), [25])

  builder = getBuilder()
  builder.select('*').from('users').whereNotIn('id', (query) => {
    query.select('id').from('users').where('age', '>', 25).take(3)
  })
  t.is(builder.toSql(), 'select * from "users" where "id" not in (select "id" from "users" where "age" > ? limit 3)')
  t.deepEqual(builder.getBindings(), [25])
})

test('testBasicWhereNulls', t => {
  let builder = getBuilder()
  builder.select('*').from('users').whereNull('id')
  t.is('select * from "users" where "id" is null', builder.toSql())
  t.deepEqual([], builder.getBindings())

  builder = getBuilder()
  builder.select('*').from('users').where('id', '=', 1).orWhereNull('id')
  t.is('select * from "users" where "id" = ? or "id" is null', builder.toSql())
  t.deepEqual([1], builder.getBindings())
})

test('testBasicWhereNullExpressionsMysql', async (t) => {
  let builder = getMySqlBuilder()
  builder.select('*').from('users').whereNull(new Raw('id'))
  t.is('select * from `users` where id is null', builder.toSql())
  t.deepEqual(builder.getBindings(), [])

  builder = getMySqlBuilder()
  builder.select('*').from('users').where('id', '=', 1).orWhereNull(new Raw('id'))
  t.is('select * from `users` where `id` = ? or id is null', builder.toSql())
  t.deepEqual(builder.getBindings(), [1])
})

test('testJsonWhereNullMysql', t => {
  const builder = getMySqlBuilder()
  builder.select('*').from('users').whereNull('items->id')
  t.is('select * from `users` where (json_extract(`items`, \'$."id"\') is null OR json_type(json_extract(`items`, \'$."id"\')) = \'NULL\')', builder.toSql())
})

test('testJsonWhereNotNullMysql', t => {
  const builder = getMySqlBuilder()
  builder.select('*').from('users').whereNotNull('items->id')
  t.is('select * from `users` where (json_extract(`items`, \'$."id"\') is not null AND json_type(json_extract(`items`, \'$."id"\')) != \'NULL\')', builder.toSql())
})

test('testJsonWhereNullExpressionMysql', async (t) => {
  const builder = getMySqlBuilder()
  builder.select('*').from('users').whereNull(new Raw('items->id'))
  t.is('select * from `users` where (json_extract(`items`, \'$."id"\') is null OR json_type(json_extract(`items`, \'$."id"\')) = \'NULL\')', builder.toSql())
})

test('testJsonWhereNotNullExpressionMysql', async (t) => {
  const builder = getMySqlBuilder()
  builder.select('*').from('users').whereNotNull(new Raw('items->id'))
  t.is('select * from `users` where (json_extract(`items`, \'$."id"\') is not null AND json_type(json_extract(`items`, \'$."id"\')) != \'NULL\')', builder.toSql())
})

test('testArrayWhereNulls', t => {
  let builder = getBuilder()
  builder.select('*').from('users').whereNull(['id', 'expires_at'])
  t.is('select * from "users" where "id" is null and "expires_at" is null', builder.toSql())
  t.deepEqual([], builder.getBindings())

  builder = getBuilder()
  builder.select('*').from('users').where('id', '=', 1).orWhereNull(['id', 'expires_at'])
  t.is('select * from "users" where "id" = ? or "id" is null or "expires_at" is null', builder.toSql())
  t.deepEqual([1], builder.getBindings())
})

test('testBasicWhereNotNulls', t => {
  let builder = getBuilder()
  builder.select('*').from('users').whereNotNull('id')
  t.is('select * from "users" where "id" is not null', builder.toSql())
  t.deepEqual([], builder.getBindings())

  builder = getBuilder()
  builder.select('*').from('users').where('id', '>', 1).orWhereNotNull('id')
  t.is('select * from "users" where "id" > ? or "id" is not null', builder.toSql())
  t.deepEqual([1], builder.getBindings())
})

test('testArrayWhereNotNulls', t => {
  let builder = getBuilder()
  builder.select('*').from('users').whereNotNull(['id', 'expires_at'])
  t.is('select * from "users" where "id" is not null and "expires_at" is not null', builder.toSql())
  t.deepEqual([], builder.getBindings())

  builder = getBuilder()
  builder.select('*').from('users').where('id', '>', 1).orWhereNotNull(['id', 'expires_at'])
  t.is('select * from "users" where "id" > ? or "id" is not null or "expires_at" is not null', builder.toSql())
  t.deepEqual([1], builder.getBindings())
})

test('testGroupBys', t => {
  let builder = getBuilder()
  builder.select('*').from('users').groupBy('email')
  t.is('select * from "users" group by "email"', builder.toSql())

  builder = getBuilder()
  builder.select('*').from('users').groupBy('id', 'email')
  t.is('select * from "users" group by "id", "email"', builder.toSql())

  builder = getBuilder()
  builder.select('*').from('users').groupBy(['id', 'email'])
  t.is('select * from "users" group by "id", "email"', builder.toSql())

  builder = getBuilder()
  builder.select('*').from('users').groupBy(new Raw('DATE(created_at)'))
  t.is('select * from "users" group by DATE(created_at)', builder.toSql())

  builder = getBuilder()
  builder.select('*').from('users').groupByRaw('DATE(created_at), ? DESC', ['foo'])
  t.is('select * from "users" group by DATE(created_at), ? DESC', builder.toSql())
  t.deepEqual(['foo'], builder.getBindings())

  builder = getBuilder()
  builder.havingRaw('?', ['havingRawBinding']).groupByRaw('?', ['groupByRawBinding']).whereRaw('?', ['whereRawBinding'])
  t.deepEqual(['whereRawBinding', 'groupByRawBinding', 'havingRawBinding'], builder.getBindings())
})

test('testOrderBys', t => {
  let builder = getBuilder()
  builder.select('*').from('users').orderBy('email').orderBy('age', 'desc')
  t.is('select * from "users" order by "email" asc, "age" desc', builder.toSql())

  builder.orders = []
  t.is('select * from "users"', builder.toSql())

  builder.orders = []
  t.is('select * from "users"', builder.toSql())

  builder = getBuilder()
  builder.select('*').from('users').orderBy('email').orderByRaw('"age" ? desc', ['foo'])
  t.is('select * from "users" order by "email" asc, "age" ? desc', builder.toSql())
  t.deepEqual(['foo'], builder.getBindings())

  builder = getBuilder()
  builder.select('*').from('users').orderByDesc('name')
  t.is('select * from "users" order by "name" desc', builder.toSql())

  builder = getBuilder()
  builder.select('*').from('posts').where('public', 1)
    .unionAll(getBuilder().select('*').from('videos').where('public', 1))
    .orderByRaw('field(category, ?, ?) asc', ['news', 'opinion'])
  t.is('(select * from "posts" where "public" = ?) union all (select * from "videos" where "public" = ?) order by field(category, ?, ?) asc', builder.toSql())
  t.deepEqual([1, 1, 'news', 'opinion'], builder.getBindings())
})

test('testLatest', t => {
  let builder = getBuilder()
  builder.select('*').from('users').latest()
  t.is('select * from "users" order by "created_at" desc', builder.toSql())

  builder = getBuilder()
  builder.select('*').from('users').latest().limit(1)
  t.is('select * from "users" order by "created_at" desc limit 1', builder.toSql())

  builder = getBuilder()
  builder.select('*').from('users').latest('updated_at')
  t.is('select * from "users" order by "updated_at" desc', builder.toSql())
})

test('testOldest', t => {
  let builder = getBuilder()
  builder.select('*').from('users').oldest()
  t.is('select * from "users" order by "created_at" asc', builder.toSql())

  builder = getBuilder()
  builder.select('*').from('users').oldest().limit(1)
  t.is('select * from "users" order by "created_at" asc limit 1', builder.toSql())

  builder = getBuilder()
  builder.select('*').from('users').oldest('updated_at')
  t.is('select * from "users" order by "updated_at" asc', builder.toSql())
})

test('testInRandomOrderMySql', t => {
  const builder = getBuilder()
  builder.select('*').from('users').inRandomOrder()
  t.is('select * from "users" order by RANDOM()', builder.toSql())
})

test('testInRandomOrderPostgres', t => {
  const builder = getPostgresBuilder()
  builder.select('*').from('users').inRandomOrder()
  t.is('select * from "users" order by RANDOM()', builder.toSql())
})

test('testInRandomOrderSqlServer', t => {
  const builder = getSqlServerBuilder()
  builder.select('*').from('users').inRandomOrder()
  t.is('select * from [users] order by NEWID()', builder.toSql())
})

test('testOrderBysSqlServer', t => {
  let builder = getSqlServerBuilder()
  builder.select('*').from('users').orderBy('email').orderBy('age', 'desc')
  t.is('select * from [users] order by [email] asc, [age] desc', builder.toSql())

  builder.orders = []
  t.is('select * from [users]', builder.toSql())

  builder.orders = []
  t.is('select * from [users]', builder.toSql())

  builder = getSqlServerBuilder()
  builder.select('*').from('users').orderBy('email')
  t.is('select * from [users] order by [email] asc', builder.toSql())

  builder = getSqlServerBuilder()
  builder.select('*').from('users').orderByDesc('name')
  t.is('select * from [users] order by [name] desc', builder.toSql())

  builder = getSqlServerBuilder()
  builder.select('*').from('users').orderByRaw('[age] asc')
  t.is('select * from [users] order by [age] asc', builder.toSql())

  builder = getSqlServerBuilder()
  builder.select('*').from('users').orderBy('email').orderByRaw('[age] ? desc', ['foo'])
  t.is('select * from [users] order by [email] asc, [age] ? desc', builder.toSql())
  t.deepEqual(['foo'], builder.getBindings())

  builder = getSqlServerBuilder()
  builder.select('*').from('users').skip(25).take(10).orderByRaw('[email] desc')
  t.is('select * from [users] order by [email] desc offset 25 rows fetch next 10 rows only', builder.toSql())
})

test('testReorder', t => {
  let builder = getBuilder()
  builder.select('*').from('users').orderBy('name')
  t.is('select * from "users" order by "name" asc', builder.toSql())
  builder.reorder()
  t.is('select * from "users"', builder.toSql())

  builder = getBuilder()
  builder.select('*').from('users').orderBy('name')
  t.is('select * from "users" order by "name" asc', builder.toSql())
  builder.reorder('email', 'desc')
  t.is('select * from "users" order by "email" desc', builder.toSql())

  builder = getBuilder()
  builder.select('*').from('first')
  builder.union(getBuilder().select('*').from('second'))
  builder.orderBy('name')
  t.is('(select * from "first") union (select * from "second") order by "name" asc', builder.toSql())
  builder.reorder()
  t.is('(select * from "first") union (select * from "second")', builder.toSql())

  builder = getBuilder()
  builder.select('*').from('users').orderByRaw('?', [true])
  t.deepEqual([true], builder.getBindings())
  builder.reorder()
  t.deepEqual([], builder.getBindings())
})

test('testOrderBySubQueries', t => {
  const expected = 'select * from "users" order by (select "created_at" from "logins" where "user_id" = "users"."id" limit 1)'
  const subQuery = (query) => {
    return query.select('created_at').from('logins').whereColumn('user_id', 'users.id').limit(1)
  }

  let builder = getBuilder().select('*').from('users').orderBy(subQuery)
  t.is(`${expected} asc`, builder.toSql())

  builder = getBuilder().select('*').from('users').orderBy(subQuery, 'desc')
  t.is(`${expected} desc`, builder.toSql())

  builder = getBuilder().select('*').from('users').orderByDesc(subQuery)
  t.is(`${expected} desc`, builder.toSql())

  builder = getBuilder()
  builder.select('*').from('posts').where('public', 1)
    .unionAll(getBuilder().select('*').from('videos').where('public', 1))
    .orderBy(getBuilder().selectRaw('field(category, ?, ?)', ['news', 'opinion']))
  t.is('(select * from "posts" where "public" = ?) union all (select * from "videos" where "public" = ?) order by (select field(category, ?, ?)) asc', builder.toSql())
  t.deepEqual([1, 1, 'news', 'opinion'], builder.getBindings())
})

test('testOrderByInvalidDirectionParam', t => {
  const error = t.throws(() => {
    const builder = getBuilder()
    builder.select('*').from('users').orderBy('age', 'asec')
  }, { instanceOf: Error })

  t.true(error.message.includes('InvalidArgumentException'))
})

test('testHavings', t => {
  let builder = getBuilder()
  builder.select('*').from('users').having('email', '>', 1)
  t.is('select * from "users" having "email" > ?', builder.toSql())

  builder = getBuilder()
  builder.select('*').from('users')
    .orHaving('email', '=', 'test@example.com')
    .orHaving('email', '=', 'test2@example.com')
  t.is('select * from "users" having "email" = ? or "email" = ?', builder.toSql())

  builder = getBuilder()
  builder.select('*').from('users').groupBy('email').having('email', '>', 1)
  t.is('select * from "users" group by "email" having "email" > ?', builder.toSql())

  builder = getBuilder()
  builder.select('email as foo_email').from('users').having('foo_email', '>', 1)
  t.is('select "email" as "foo_email" from "users" having "foo_email" > ?', builder.toSql())

  builder = getBuilder()
  builder.select(['category', new Raw('count(*) as "total"')]).from('item').where('department', '=', 'popular').groupBy('category').having('total', '>', new Raw('3'))
  t.is('select "category", count(*) as "total" from "item" where "department" = ? group by "category" having "total" > 3', builder.toSql())

  builder = getBuilder()
  builder.select(['category', new Raw('count(*) as "total"')]).from('item').where('department', '=', 'popular').groupBy('category').having('total', '>', 3)
  t.is('select "category", count(*) as "total" from "item" where "department" = ? group by "category" having "total" > ?', builder.toSql())
})

test('testNestedHavings', t => {
  const builder = getBuilder()
  builder.select('*').from('users').having('email', '=', 'foo').orHaving((query) => {
    query.having('name', '=', 'bar').having('age', '=', 25)
  })
  t.is('select * from "users" having "email" = ? or ("name" = ? and "age" = ?)', builder.toSql())
  t.deepEqual(['foo', 'bar', 25], builder.getBindings())
})

test('testNestedHavingBindings', t => {
  const builder = getBuilder()
  builder.having('email', '=', 'foo').having((query) => {
    query.selectRaw('?', ['ignore']).having('name', '=', 'bar')
  })
  t.deepEqual(['foo', 'bar'], builder.getBindings())
})

test('testHavingBetweens', t => {
  let builder = getBuilder()
  builder.select('*').from('users').havingBetween('id', [1, 2, 3])
  t.is('select * from "users" having "id" between ? and ?', builder.toSql())
  t.deepEqual([1, 2], builder.getBindings())

  builder = getBuilder()
  builder.select('*').from('users').havingBetween('id', [[1, 2], [3, 4]])
  t.is('select * from "users" having "id" between ? and ?', builder.toSql())
  t.deepEqual([1, 2], builder.getBindings())
})

test('testHavingNull', t => {
  let builder = getBuilder()
  builder.select('*').from('users').havingNull('email')
  t.is('select * from "users" having "email" is null', builder.toSql())

  builder = getBuilder()
  builder.select('*').from('users')
    .havingNull('email')
    .havingNull('phone')
  t.is('select * from "users" having "email" is null and "phone" is null', builder.toSql())

  builder = getBuilder()
  builder.select('*').from('users')
    .orHavingNull('email')
    .orHavingNull('phone')
  t.is('select * from "users" having "email" is null or "phone" is null', builder.toSql())

  builder = getBuilder()
  builder.select('*').from('users').groupBy('email').havingNull('email')
  t.is('select * from "users" group by "email" having "email" is null', builder.toSql())

  builder = getBuilder()
  builder.select('email as foo_email').from('users').havingNull('foo_email')
  t.is('select "email" as "foo_email" from "users" having "foo_email" is null', builder.toSql())

  builder = getBuilder()
  builder.select(['category', new Raw('count(*) as "total"')]).from('item').where('department', '=', 'popular').groupBy('category').havingNull('total')
  t.is('select "category", count(*) as "total" from "item" where "department" = ? group by "category" having "total" is null', builder.toSql())

  builder = getBuilder()
  builder.select(['category', new Raw('count(*) as "total"')]).from('item').where('department', '=', 'popular').groupBy('category').havingNull('total')
  t.is('select "category", count(*) as "total" from "item" where "department" = ? group by "category" having "total" is null', builder.toSql())
})

test('testHavingNotNull', t => {
  let builder = getBuilder()
  builder.select('*').from('users').havingNotNull('email')
  t.is('select * from "users" having "email" is not null', builder.toSql())

  builder = getBuilder()
  builder.select('*').from('users')
    .havingNotNull('email')
    .havingNotNull('phone')
  t.is('select * from "users" having "email" is not null and "phone" is not null', builder.toSql())

  builder = getBuilder()
  builder.select('*').from('users')
    .orHavingNotNull('email')
    .orHavingNotNull('phone')
  t.is('select * from "users" having "email" is not null or "phone" is not null', builder.toSql())

  builder = getBuilder()
  builder.select('*').from('users').groupBy('email').havingNotNull('email')
  t.is('select * from "users" group by "email" having "email" is not null', builder.toSql())

  builder = getBuilder()
  builder.select('email as foo_email').from('users').havingNotNull('foo_email')
  t.is('select "email" as "foo_email" from "users" having "foo_email" is not null', builder.toSql())

  builder = getBuilder()
  builder.select(['category', new Raw('count(*) as "total"')]).from('item').where('department', '=', 'popular').groupBy('category').havingNotNull('total')
  t.is('select "category", count(*) as "total" from "item" where "department" = ? group by "category" having "total" is not null', builder.toSql())

  builder = getBuilder()
  builder.select(['category', new Raw('count(*) as "total"')]).from('item').where('department', '=', 'popular').groupBy('category').havingNotNull('total')
  t.is('select "category", count(*) as "total" from "item" where "department" = ? group by "category" having "total" is not null', builder.toSql())
})

test('testHavingExpression', async (t) => {
  const newExpression = new Expression()
  newExpression.getValue = (grammar) => {
    return '1 = 1'
  }

  const builder = getBuilder()
  builder.select('*').from('users').having(newExpression)

  t.is(builder.toSql(), 'select * from "users" having 1 = 1')
  t.deepEqual([], builder.getBindings())
})

test('testHavingShortcut', t => {
  const builder = getBuilder()
  builder.select('*').from('users').having('email', 1).orHaving('email', 2)
  t.is('select * from "users" having "email" = ? or "email" = ?', builder.toSql())
})

test('testHavingFollowedBySelectGet', async t => {
  const { createMock, verifyMock } = mock()

  let builder = getBuilder()
  let query = 'select "category", count(*) as "total" from "item" where "department" = ? group by "category" having "total" > ?'
  let connectionMock = createMock(builder.getConnection())
  let processorMock = createMock(builder.getProcessor())
  connectionMock.expects('select').once().withArgs(query, ['popular', 3]).returns([{ category: 'rock', total: 5 }])
  processorMock.expects('processSelect').callsFake((builder, results) => {
    return results
  })
  builder.from('item')
  let result = await builder.select(['category', new Raw('count(*) as "total"')]).where('department', '=', 'popular').groupBy('category').having('total', '>', 3).get()
  t.deepEqual([{ category: 'rock', total: 5 }], result.all())

  // Using \Raw value
  builder = getBuilder()
  query = 'select "category", count(*) as "total" from "item" where "department" = ? group by "category" having "total" > 3'
  connectionMock = createMock(builder.getConnection())
  processorMock = createMock(builder.getProcessor())
  connectionMock.expects('select').once().withArgs(query, ['popular']).returns([{ category: 'rock', total: 5 }])
  processorMock.expects('processSelect').callsFake((builder, results) => {
    return results
  })
  builder.from('item')
  result = await builder.select(['category', new Raw('count(*) as "total"')]).where('department', '=', 'popular').groupBy('category').having('total', '>', new Raw('3')).get()
  t.deepEqual([{ category: 'rock', total: 5 }], result.all())

  verifyMock()
})

test('testRawHavings', t => {
  let builder = getBuilder()
  builder.select('*').from('users').havingRaw('user_foo < user_bar')
  t.is('select * from "users" having user_foo < user_bar', builder.toSql())

  builder = getBuilder()
  builder.select('*').from('users').having('baz', '=', 1).orHavingRaw('user_foo < user_bar')
  t.is('select * from "users" having "baz" = ? or user_foo < user_bar', builder.toSql())

  builder = getBuilder()
  builder.select('*').from('users').havingBetween('last_login_date', ['2018-11-16', '2018-12-16']).orHavingRaw('user_foo < user_bar')
  t.is('select * from "users" having "last_login_date" between ? and ? or user_foo < user_bar', builder.toSql())
})

test('testLimitsAndOffsets', t => {
  let builder = getBuilder()
  builder.select('*').from('users').offset(5).limit(10)
  t.is('select * from "users" limit 10 offset 5', builder.toSql())

  builder = getBuilder()
  builder.select('*').from('users').skip(5).take(10)
  t.is('select * from "users" limit 10 offset 5', builder.toSql())

  builder = getBuilder()
  builder.select('*').from('users').skip(0).take(0)
  t.is('select * from "users" limit 0 offset 0', builder.toSql())

  builder = getBuilder()
  builder.select('*').from('users').skip(-5).take(-10)
  t.is('select * from "users" offset 0', builder.toSql())
})

test('testForPage', t => {
  let builder = getBuilder()
  builder.select('*').from('users').forPage(2, 15)
  t.is('select * from "users" limit 15 offset 15', builder.toSql())

  builder = getBuilder()
  builder.select('*').from('users').forPage(0, 15)
  t.is('select * from "users" limit 15 offset 0', builder.toSql())

  builder = getBuilder()
  builder.select('*').from('users').forPage(-2, 15)
  t.is('select * from "users" limit 15 offset 0', builder.toSql())

  builder = getBuilder()
  builder.select('*').from('users').forPage(2, 0)
  t.is('select * from "users" limit 0 offset 0', builder.toSql())

  builder = getBuilder()
  builder.select('*').from('users').forPage(0, 0)
  t.is('select * from "users" limit 0 offset 0', builder.toSql())

  builder = getBuilder()
  builder.select('*').from('users').forPage(-2, 0)
  t.is('select * from "users" limit 0 offset 0', builder.toSql())
})

test('testGetCountForPaginationWithBindings', async t => {
  const { createMock, verifyMock } = mock()

  const builder = getBuilder()
  builder.from('users').selectSub((query) => {
    query.select('body').from('posts').where('id', 4)
  }, 'post')

  createMock(builder.getConnection()).expects('select').once().withArgs('select count(*) as aggregate from "users"', []).resolves([{ aggregate: 1 }])
  createMock(builder.getProcessor()).expects('processSelect').once().callsFake((builder, results) => {
    return results
  })

  const count = await builder.getCountForPagination()
  t.is(1, count)
  t.deepEqual([4], builder.getBindings())

  verifyMock()
})

test('testGetCountForPaginationWithColumnAliases', async t => {
  const { createMock, verifyMock } = mock()

  const builder = getBuilder()
  const columns = ['body as post_body', 'teaser', 'posts.created as published']
  builder.from('posts').select(columns)

  createMock(builder.getConnection()).expects('select').once().withArgs('select count("body", "teaser", "posts"."created") as aggregate from "posts"', []).returns([{ aggregate: 1 }])
  createMock(builder.getProcessor()).expects('processSelect').once().callsFake((builder, results) => {
    return results
  })

  const count = await builder.getCountForPagination(columns)
  t.is(1, count)

  verifyMock()
})

test('testGetCountForPaginationWithUnion', async t => {
  const { createMock, verifyMock } = mock()

  const builder = getBuilder()
  builder.from('posts').select('id').union(getBuilder().from('videos').select('id'))

  createMock(builder.getConnection()).expects('select').once().withArgs('select count(*) as aggregate from ((select "id" from "posts") union (select "id" from "videos")) as "temp_table"', []).returns([{ aggregate: 1 }])
  createMock(builder.getProcessor()).expects('processSelect').once().callsFake((builder, results) => {
    return results
  })

  const count = await builder.getCountForPagination()
  t.is(1, count)

  verifyMock()
})

test('testWhereShortcut', t => {
  const builder = getBuilder()
  builder.select('*').from('users').where('id', 1).orWhere('name', 'foo')
  t.is('select * from "users" where "id" = ? or "name" = ?', builder.toSql())
  t.deepEqual([1, 'foo'], builder.getBindings())
})

test('testWhereWithArrayConditions', t => {
  let builder = getBuilder()
  builder.select('*').from('users').where([['foo', 1], ['bar', 2]])
  t.is('select * from "users" where ("foo" = ? and "bar" = ?)', builder.toSql())
  t.deepEqual([1, 2], builder.getBindings())

  builder = getBuilder()
  builder.select('*').from('users').where({ foo: 1, bar: 2 })
  t.is('select * from "users" where ("foo" = ? and "bar" = ?)', builder.toSql())
  t.deepEqual([1, 2], builder.getBindings())

  builder = getBuilder()
  builder.select('*').from('users').where([['foo', 1], ['bar', '<', 2]])
  t.is('select * from "users" where ("foo" = ? and "bar" < ?)', builder.toSql())
  t.deepEqual([1, 2], builder.getBindings())
})

test('testNestedWheres', t => {
  const builder = getBuilder()
  builder.select('*').from('users').where('email', '=', 'foo').orWhere((query) => {
    query.where('name', '=', 'bar').where('age', '=', 25)
  })
  t.is('select * from "users" where "email" = ? or ("name" = ? and "age" = ?)', builder.toSql())
  t.deepEqual(['foo', 'bar', 25], builder.getBindings())
})

test('testNestedWhereBindings', t => {
  const builder = getBuilder()
  builder.where('email', '=', 'foo').where((query) => {
    query.selectRaw('?', ['ignore']).where('name', '=', 'bar')
  })
  t.deepEqual(['foo', 'bar'], builder.getBindings())
})

test('testWhereNot', t => {
  let builder = getBuilder()
  builder.select('*').from('users').whereNot((query) => {
    query.where('email', '=', 'foo')
  })
  t.is('select * from "users" where not ("email" = ?)', builder.toSql())
  t.deepEqual(['foo'], builder.getBindings())

  builder = getBuilder()
  builder.select('*').from('users').where('name', '=', 'bar').whereNot((query) => {
    query.where('email', '=', 'foo')
  })
  t.is('select * from "users" where "name" = ? and not ("email" = ?)', builder.toSql())
  t.deepEqual(['bar', 'foo'], builder.getBindings())

  builder = getBuilder()
  builder.select('*').from('users').where('name', '=', 'bar').orWhereNot((query) => {
    query.where('email', '=', 'foo')
  })
  t.is('select * from "users" where "name" = ? or not ("email" = ?)', builder.toSql())
  t.deepEqual(['bar', 'foo'], builder.getBindings())
})

test('testIncrementManyArgumentValidation1', t => {
  const error = t.throws(() => {
    const builder = getBuilder()
    builder.from('users').incrementEach({ col: 'a' })
  }, { instanceOf: Error })

  t.true(error.message.includes('InvalidArgumentException: Non-numeric value passed as increment amount for column: \'col\'.'))
})

test('testIncrementManyArgumentValidation2', t => {
  const error = t.throws(() => {
    const builder = getBuilder()
    builder.from('users').incrementEach({ 11: 12 })
  }, { instanceOf: Error })

  t.true(error.message.includes('InvalidArgumentException: Non-associative array passed to incrementEach method.'))
})

test('testWhereNotWithArrayConditions', t => {
  let builder = getBuilder()
  builder.select('*').from('users').whereNot([['foo', 1], ['bar', 2]])
  t.is(builder.toSql(), 'select * from "users" where not (("foo" = ? and "bar" = ?))')
  t.deepEqual(builder.getBindings(), [1, 2])

  builder = getBuilder()
  builder.select('*').from('users').whereNot({ foo: 1, bar: 2 })
  t.is(builder.toSql(), 'select * from "users" where not (("foo" = ? and "bar" = ?))')
  t.deepEqual(builder.getBindings(), [1, 2])

  builder = getBuilder()
  builder.select('*').from('users').whereNot([['foo', 1], ['bar', '<', 2]])
  t.is(builder.toSql(), 'select * from "users" where not (("foo" = ? and "bar" < ?))')
  t.deepEqual(builder.getBindings(), [1, 2])
})

test('testFullSubSelects', t => {
  const builder = getBuilder()
  builder.select('*').from('users').where('email', '=', 'foo').orWhere('id', '=', (query) => {
    query.select(new Raw('max(id)')).from('users').where('email', '=', 'bar')
  })

  t.is('select * from "users" where "email" = ? or "id" = (select max(id) from "users" where "email" = ?)', builder.toSql())
  t.deepEqual(['foo', 'bar'], builder.getBindings())
})

test('testWhereExists', t => {
  let builder = getBuilder()
  builder.select('*').from('orders').whereExists((query) => {
    query.select('*').from('products').where('products.id', '=', new Raw('"orders"."id"'))
  })
  t.is('select * from "orders" where exists (select * from "products" where "products"."id" = "orders"."id")', builder.toSql())

  builder = getBuilder()
  builder.select('*').from('orders').whereNotExists((query) => {
    query.select('*').from('products').where('products.id', '=', new Raw('"orders"."id"'))
  })
  t.is('select * from "orders" where not exists (select * from "products" where "products"."id" = "orders"."id")', builder.toSql())

  builder = getBuilder()
  builder.select('*').from('orders').where('id', '=', 1).orWhereExists((query) => {
    query.select('*').from('products').where('products.id', '=', new Raw('"orders"."id"'))
  })
  t.is('select * from "orders" where "id" = ? or exists (select * from "products" where "products"."id" = "orders"."id")', builder.toSql())

  builder = getBuilder()
  builder.select('*').from('orders').where('id', '=', 1).orWhereNotExists((query) => {
    query.select('*').from('products').where('products.id', '=', new Raw('"orders"."id"'))
  })
  t.is('select * from "orders" where "id" = ? or not exists (select * from "products" where "products"."id" = "orders"."id")', builder.toSql())
})

test('testBasicJoins', (t) => {
  let builder = getBuilder()
  builder.select('*').from('users').join('contacts', 'users.id', 'contacts.id')
  t.is('select * from "users" inner join "contacts" on "users"."id" = "contacts"."id"', builder.toSql())

  builder = getBuilder()
  builder.select('*').from('users').join('contacts', 'users.id', '=', 'contacts.id').leftJoin('photos', 'users.id', '=', 'photos.id')
  t.is('select * from "users" inner join "contacts" on "users"."id" = "contacts"."id" left join "photos" on "users"."id" = "photos"."id"', builder.toSql())

  builder = getBuilder()
  builder.select('*').from('users').leftJoinWhere('photos', 'users.id', '=', 'bar').joinWhere('photos', 'users.id', '=', 'foo')
  t.is('select * from "users" left join "photos" on "users"."id" = ? inner join "photos" on "users"."id" = ?', builder.toSql())
  t.deepEqual(['bar', 'foo'], builder.getBindings())
})

test('testCrossJoins', (t) => {
  let builder = getBuilder()
  builder.select('*').from('sizes').crossJoin('colors')
  t.is('select * from "sizes" cross join "colors"', builder.toSql())

  builder = getBuilder()
  builder.select('*').from('tableB').join('tableA', 'tableA.column1', '=', 'tableB.column2', 'cross')
  t.is('select * from "tableB" cross join "tableA" on "tableA"."column1" = "tableB"."column2"', builder.toSql())

  builder = getBuilder()
  builder.select('*').from('tableB').crossJoin('tableA', 'tableA.column1', '=', 'tableB.column2')
  t.is('select * from "tableB" cross join "tableA" on "tableA"."column1" = "tableB"."column2"', builder.toSql())
})

test('testCrossJoinSubs', async (t) => {
  const builder = getBuilder()
  builder.selectRaw('(sale / overall.sales) * 100 AS percent_of_total').from('sales').crossJoinSub(getBuilder().selectRaw('SUM(sale) AS sales').from('sales'), 'overall')
  t.is('select (sale / overall.sales) * 100 AS percent_of_total from "sales" cross join (select SUM(sale) AS sales from "sales") as "overall"', builder.toSql())
})

test('testComplexJoin', (t) => {
  let builder = getBuilder()
  builder.select('*').from('users').join('contacts', (join) => {
    join.on('users.id', '=', 'contacts.id').orOn('users.name', '=', 'contacts.name')
  })
  t.is('select * from "users" inner join "contacts" on "users"."id" = "contacts"."id" or "users"."name" = "contacts"."name"', builder.toSql())

  builder = getBuilder()
  builder.select('*').from('users').join('contacts', (join) => {
    join.where('users.id', '=', 'foo').orWhere('users.name', '=', 'bar')
  })
  t.is('select * from "users" inner join "contacts" on "users"."id" = ? or "users"."name" = ?', builder.toSql())
  t.deepEqual(['foo', 'bar'], builder.getBindings())

  // Run the assertions again
  t.is('select * from "users" inner join "contacts" on "users"."id" = ? or "users"."name" = ?', builder.toSql())
  t.deepEqual(['foo', 'bar'], builder.getBindings())
})

test('testJoinWhereNull', (t) => {
  let builder = getBuilder()
  builder.select('*').from('users').join('contacts', (join) => {
    join.on('users.id', '=', 'contacts.id').whereNull('contacts.deleted_at')
  })
  t.is('select * from "users" inner join "contacts" on "users"."id" = "contacts"."id" and "contacts"."deleted_at" is null', builder.toSql())

  builder = getBuilder()
  builder.select('*').from('users').join('contacts', (join) => {
    join.on('users.id', '=', 'contacts.id').orWhereNull('contacts.deleted_at')
  })
  t.is('select * from "users" inner join "contacts" on "users"."id" = "contacts"."id" or "contacts"."deleted_at" is null', builder.toSql())
})

test('testJoinWhereNotNull', (t) => {
  let builder = getBuilder()
  builder.select('*').from('users').join('contacts', (join) => {
    join.on('users.id', '=', 'contacts.id').whereNotNull('contacts.deleted_at')
  })
  t.is('select * from "users" inner join "contacts" on "users"."id" = "contacts"."id" and "contacts"."deleted_at" is not null', builder.toSql())

  builder = getBuilder()
  builder.select('*').from('users').join('contacts', (join) => {
    join.on('users.id', '=', 'contacts.id').orWhereNotNull('contacts.deleted_at')
  })
  t.is('select * from "users" inner join "contacts" on "users"."id" = "contacts"."id" or "contacts"."deleted_at" is not null', builder.toSql())
})

test('testJoinWhereIn', (t) => {
  let builder = getBuilder()
  builder.select('*').from('users').join('contacts', (join) => {
    join.on('users.id', '=', 'contacts.id').whereIn('contacts.name', [48, 'baz', null])
  })
  t.is('select * from "users" inner join "contacts" on "users"."id" = "contacts"."id" and "contacts"."name" in (?, ?, ?)', builder.toSql())
  t.deepEqual([48, 'baz', null], builder.getBindings())

  builder = getBuilder()
  builder.select('*').from('users').join('contacts', (join) => {
    join.on('users.id', '=', 'contacts.id').orWhereIn('contacts.name', [48, 'baz', null])
  })
  t.is('select * from "users" inner join "contacts" on "users"."id" = "contacts"."id" or "contacts"."name" in (?, ?, ?)', builder.toSql())
  t.deepEqual([48, 'baz', null], builder.getBindings())
})

test('testJoinWhereInSubquery', (t) => {
  let builder = getBuilder()
  builder.select('*').from('users').join('contacts', (join) => {
    const query = getBuilder()

    query.select('name').from('contacts').where('name', 'baz')
    join.on('users.id', '=', 'contacts.id').whereIn('contacts.name', query)
  })
  t.is('select * from "users" inner join "contacts" on "users"."id" = "contacts"."id" and "contacts"."name" in (select "name" from "contacts" where "name" = ?)', builder.toSql())
  t.deepEqual(['baz'], builder.getBindings())

  builder = getBuilder()
  builder.select('*').from('users').join('contacts', (join) => {
    const query = getBuilder()

    query.select('name').from('contacts').where('name', 'baz')
    join.on('users.id', '=', 'contacts.id').orWhereIn('contacts.name', query)
  })
  t.is('select * from "users" inner join "contacts" on "users"."id" = "contacts"."id" or "contacts"."name" in (select "name" from "contacts" where "name" = ?)', builder.toSql())
  t.deepEqual(['baz'], builder.getBindings())
})

test('testJoinWhereNotIn', (t) => {
  let builder = getBuilder()
  builder.select('*').from('users').join('contacts', (join) => {
    join.on('users.id', '=', 'contacts.id').whereNotIn('contacts.name', [48, 'baz', null])
  })
  t.is('select * from "users" inner join "contacts" on "users"."id" = "contacts"."id" and "contacts"."name" not in (?, ?, ?)', builder.toSql())
  t.deepEqual([48, 'baz', null], builder.getBindings())

  builder = getBuilder()
  builder.select('*').from('users').join('contacts', (join) => {
    join.on('users.id', '=', 'contacts.id').orWhereNotIn('contacts.name', [48, 'baz', null])
  })
  t.is('select * from "users" inner join "contacts" on "users"."id" = "contacts"."id" or "contacts"."name" not in (?, ?, ?)', builder.toSql())
  t.deepEqual([48, 'baz', null], builder.getBindings())
})

test('testJoinsWithNestedConditions', (t) => {
  let builder = getBuilder()
  builder.select('*').from('users').leftJoin('contacts', (join) => {
    join.on('users.id', '=', 'contacts.id').where((join) => {
      join.where('contacts.country', '=', 'US').orWhere('contacts.is_partner', '=', 1)
    })
  })
  t.is('select * from "users" left join "contacts" on "users"."id" = "contacts"."id" and ("contacts"."country" = ? or "contacts"."is_partner" = ?)', builder.toSql())
  t.deepEqual(['US', 1], builder.getBindings())

  builder = getBuilder()
  builder.select('*').from('users').leftJoin('contacts', (join) => {
    join.on('users.id', '=', 'contacts.id').where('contacts.is_active', '=', 1).orOn((join) => {
      join.orWhere((join) => {
        join.where('contacts.country', '=', 'UK').orOn('contacts.type', '=', 'users.type')
      }).where((join) => {
        join.where('contacts.country', '=', 'US').orWhereNull('contacts.is_partner')
      })
    })
  })
  t.is('select * from "users" left join "contacts" on "users"."id" = "contacts"."id" and "contacts"."is_active" = ? or (("contacts"."country" = ? or "contacts"."type" = "users"."type") and ("contacts"."country" = ? or "contacts"."is_partner" is null))', builder.toSql())
  t.deepEqual([1, 'UK', 'US'], builder.getBindings())
})

test('testJoinsWithAdvancedConditions', (t) => {
  const builder = getBuilder()
  builder.select('*').from('users').leftJoin('contacts', (join) => {
    join.on('users.id', 'contacts.id').where((join) => {
      join.orWhereNull('contacts.disabled')
        .orWhereRaw('year(contacts.created_at) = 2016')
    })
  })
  t.is('select * from "users" left join "contacts" on "users"."id" = "contacts"."id" and ("contacts"."disabled" is null or year(contacts.created_at) = 2016)', builder.toSql())
  t.deepEqual([], builder.getBindings())
})

test('testJoinsWithSubqueryCondition', (t) => {
  let builder = getBuilder()
  builder.select('*').from('users').leftJoin('contacts', (join) => {
    join.on('users.id', 'contacts.id').whereIn('contact_type_id', (query) => {
      query.select('id').from('contact_types')
        .where('category_id', '1')
        .whereNull('deleted_at')
    })
  })
  t.is('select * from "users" left join "contacts" on "users"."id" = "contacts"."id" and "contact_type_id" in (select "id" from "contact_types" where "category_id" = ? and "deleted_at" is null)', builder.toSql())
  t.deepEqual(['1'], builder.getBindings())

  builder = getBuilder()
  builder.select('*').from('users').leftJoin('contacts', (join) => {
    join.on('users.id', 'contacts.id').whereExists((query) => {
      query.selectRaw('1').from('contact_types')
        .whereRaw('contact_types.id = contacts.contact_type_id')
        .where('category_id', '1')
        .whereNull('deleted_at')
    })
  })
  t.is('select * from "users" left join "contacts" on "users"."id" = "contacts"."id" and exists (select 1 from "contact_types" where contact_types.id = contacts.contact_type_id and "category_id" = ? and "deleted_at" is null)', builder.toSql())
  t.deepEqual(['1'], builder.getBindings())
})

test('testJoinsWithAdvancedSubqueryCondition', (t) => {
  const builder = getBuilder()
  builder.select('*').from('users').leftJoin('contacts', (join) => {
    join.on('users.id', 'contacts.id').whereExists((query) => {
      query.selectRaw('1').from('contact_types')
        .whereRaw('contact_types.id = contacts.contact_type_id')
        .where('category_id', '1')
        .whereNull('deleted_at')
        .whereIn('level_id', (query) => {
          query.select('id').from('levels')
            .where('is_active', true)
        })
    })
  })
  t.is('select * from "users" left join "contacts" on "users"."id" = "contacts"."id" and exists (select 1 from "contact_types" where contact_types.id = contacts.contact_type_id and "category_id" = ? and "deleted_at" is null and "level_id" in (select "id" from "levels" where "is_active" = ?))', builder.toSql())
  t.deepEqual(['1', true], builder.getBindings())
})

test('testJoinsWithNestedJoins', (t) => {
  const builder = getBuilder()
  builder.select('users.id', 'contacts.id', 'contact_types.id').from('users').leftJoin('contacts', (join) => {
    join.on('users.id', 'contacts.id').join('contact_types', 'contacts.contact_type_id', '=', 'contact_types.id')
  })
  t.is('select "users"."id", "contacts"."id", "contact_types"."id" from "users" left join ("contacts" inner join "contact_types" on "contacts"."contact_type_id" = "contact_types"."id") on "users"."id" = "contacts"."id"', builder.toSql())
})

test('testJoinsWithMultipleNestedJoins', (t) => {
  const builder = getBuilder()
  builder.select('users.id', 'contacts.id', 'contact_types.id', 'countrys.id', 'planets.id').from('users').leftJoin('contacts', (join) => {
    join.on('users.id', 'contacts.id')
      .join('contact_types', 'contacts.contact_type_id', '=', 'contact_types.id')
      .leftJoin('countrys', (query) => {
        query.on('contacts.country', '=', 'countrys.country')
          .join('planets', (query) => {
            query.on('countrys.planet_id', '=', 'planet.id')
              .where('planet.is_settled', '=', 1)
              .where('planet.population', '>=', 10000)
          })
      })
  })
  t.is('select "users"."id", "contacts"."id", "contact_types"."id", "countrys"."id", "planets"."id" from "users" left join ("contacts" inner join "contact_types" on "contacts"."contact_type_id" = "contact_types"."id" left join ("countrys" inner join "planets" on "countrys"."planet_id" = "planet"."id" and "planet"."is_settled" = ? and "planet"."population" >= ?) on "contacts"."country" = "countrys"."country") on "users"."id" = "contacts"."id"', builder.toSql())
  t.deepEqual([1, 10000], builder.getBindings())
})

test('testJoinsWithNestedJoinWithAdvancedSubqueryCondition', (t) => {
  const builder = getBuilder()
  builder.select('users.id', 'contacts.id', 'contact_types.id').from('users').leftJoin('contacts', (join) => {
    join.on('users.id', 'contacts.id')
      .join('contact_types', 'contacts.contact_type_id', '=', 'contact_types.id')
      .whereExists((query) => {
        query.select('*').from('countrys')
          .whereColumn('contacts.country', '=', 'countrys.country')
          .join('planets', (query) => {
            query.on('countrys.planet_id', '=', 'planet.id')
              .where('planet.is_settled', '=', 1)
          })
          .where('planet.population', '>=', 10000)
      })
  })
  t.is('select "users"."id", "contacts"."id", "contact_types"."id" from "users" left join ("contacts" inner join "contact_types" on "contacts"."contact_type_id" = "contact_types"."id") on "users"."id" = "contacts"."id" and exists (select * from "countrys" inner join "planets" on "countrys"."planet_id" = "planet"."id" and "planet"."is_settled" = ? where "contacts"."country" = "countrys"."country" and "planet"."population" >= ?)', builder.toSql())
  t.deepEqual([1, 10000], builder.getBindings())
})

test('testJoinWithNestedOnCondition', async (t) => {
  const builder = getBuilder()
  builder.select('users.id').from('users').join('contacts', (join) => {
    return join
      .on('users.id', 'contacts.id')
      .addNestedWhereQuery(getBuilder().where('contacts.id', 1))
  })
  t.is(builder.toSql(), 'select "users"."id" from "users" inner join "contacts" on "users"."id" = "contacts"."id" and ("contacts"."id" = ?)')
  t.deepEqual([1], builder.getBindings())
})

test('testJoinSub', (t) => {
  let builder = getBuilder()
  builder.from('users').joinSub('select * from "contacts"', 'sub', 'users.id', '=', 'sub.id')
  t.is('select * from "users" inner join (select * from "contacts") as "sub" on "users"."id" = "sub"."id"', builder.toSql())

  builder = getBuilder()
  builder.from('users').joinSub((query) => {
    query.from('contacts')
  }, 'sub', 'users.id', '=', 'sub.id')
  t.is('select * from "users" inner join (select * from "contacts") as "sub" on "users"."id" = "sub"."id"', builder.toSql())

  builder = getBuilder()
  const eloquentBuilder = new EloquentBuilder(getBuilder().from('contacts'))
  builder.from('users').joinSub(eloquentBuilder, 'sub', 'users.id', '=', 'sub.id')
  t.is('select * from "users" inner join (select * from "contacts") as "sub" on "users"."id" = "sub"."id"', builder.toSql())

  builder = getBuilder()
  const sub1 = getBuilder().from('contacts').where('name', 'foo')
  const sub2 = getBuilder().from('contacts').where('name', 'bar')
  builder.from('users')
    .joinSub(sub1, 'sub1', 'users.id', '=', 1, 'inner', true)
    .joinSub(sub2, 'sub2', 'users.id', '=', 'sub2.user_id')
  let expected = 'select * from "users" '
  expected += 'inner join (select * from "contacts" where "name" = ?) as "sub1" on "users"."id" = ? '
  expected += 'inner join (select * from "contacts" where "name" = ?) as "sub2" on "users"."id" = "sub2"."user_id"'
  t.deepEqual(expected, builder.toSql())
  t.deepEqual(['foo', 1, 'bar'], builder.getRawBindings().join)
})

test('testJoinSubWithPrefix', (t) => {
  const builder = getBuilder()
  builder.getGrammar().setTablePrefix('prefix_')
  builder.from('users').joinSub('select * from "contacts"', 'sub', 'users.id', '=', 'sub.id')
  t.is('select * from "prefix_users" inner join (select * from "contacts") as "prefix_sub" on "prefix_users"."id" = "prefix_sub"."id"', builder.toSql())
})

test('testLeftJoinSub', (t) => {
  const builder = getBuilder()
  builder.from('users').leftJoinSub(getBuilder().from('contacts'), 'sub', 'users.id', '=', 'sub.id')
  t.is('select * from "users" left join (select * from "contacts") as "sub" on "users"."id" = "sub"."id"', builder.toSql())
})

test('testRightJoinSub', (t) => {
  const builder = getBuilder()
  builder.from('users').rightJoinSub(getBuilder().from('contacts'), 'sub', 'users.id', '=', 'sub.id')
  t.is('select * from "users" right join (select * from "contacts") as "sub" on "users"."id" = "sub"."id"', builder.toSql())
})

test('testRawExpressionsInSelect', (t) => {
  const builder = getBuilder()
  builder.select(new Raw('substr(foo, 6)')).from('users')
  t.is('select substr(foo, 6) from "users"', builder.toSql())
})

test('testFindReturnsFirstResultByID', async (t) => {
  const { createMock, verifyMock } = mock()

  const builder = getBuilder()
  createMock(builder.getConnection()).expects('select').once().withArgs('select * from "users" where "id" = ? limit 1', [1]).returns([{ foo: 'bar' }])
  createMock(builder.getProcessor()).expects('processSelect').once().withArgs(builder, [{ foo: 'bar' }]).callsFake((query, results) => {
    return results
  })
  const results = await builder.from('users').find(1)
  t.deepEqual({ foo: 'bar' }, results)

  verifyMock()
})

test('testFindOrReturnsFirstResultByID', async (t) => {
  const { createStub, restoreStub } = mock()

  const data = class {}
  const builder = getBuilder()
  const stub = createStub(builder, 'first')

  stub.onFirstCall().returns(data)
  stub.withArgs(['column']).onFirstCall().returns(data)
  stub.onThirdCall().returns(null)

  t.deepEqual(data, builder.findOr(1, () => 'callback result'))
  t.deepEqual(data, builder.findOr(1, ['column'], () => 'callback result'))
  t.deepEqual('callback result', builder.findOr(1, () => 'callback result'))

  restoreStub(builder, 'first')
})

test('testFirstMethodReturnsFirstResult', async (t) => {
  const { createMock, verifyMock } = mock()

  const builder = getBuilder()
  createMock(builder.getConnection()).expects('select').once().withArgs('select * from "users" where "id" = ? limit 1', [1]).returns([{ foo: 'bar' }])
  createMock(builder.getProcessor()).expects('processSelect').once().withArgs(builder, [{ foo: 'bar' }]).callsFake((query, results) => {
    return results
  })
  const results = await builder.from('users').where('id', '=', 1).first()
  t.deepEqual({ foo: 'bar' }, results)

  verifyMock()
})

test('testPluckMethodGetsCollectionOfColumnValues', async (t) => {
  const { createMock, verifyMock } = mock()

  let builder = getBuilder()
  createMock(builder.getConnection()).expects('select').once().returns([{ foo: 'bar' }, { foo: 'baz' }])
  createMock(builder.getProcessor()).expects('processSelect').once().withArgs(builder, [{ foo: 'bar' }, { foo: 'baz' }]).callsFake((query, results) => {
    return results
  })
  let results = await builder.from('users').where('id', '=', 1).pluck('foo')
  t.deepEqual(results.all(), ['bar', 'baz'])

  builder = getBuilder()
  createMock(builder.getConnection()).expects('select').once().returns([{ id: 1, foo: 'bar' }, { id: 10, foo: 'baz' }])
  createMock(builder.getProcessor()).expects('processSelect').once().withArgs(builder, [{ id: 1, foo: 'bar' }, { id: 10, foo: 'baz' }]).callsFake((query, results) => {
    return results
  })
  results = await builder.from('users').where('id', '=', 1).pluck('foo', 'id')
  t.deepEqual(results.all(), { 1: 'bar', 10: 'baz' })

  verifyMock()
})

test('testImplode', async (t) => {
  const { createMock, verifyMock } = mock()

  // Test without glue.
  let builder = getBuilder()
  createMock(builder.getConnection()).expects('select').once().returns([{ foo: 'bar' }, { foo: 'baz' }])
  createMock(builder.getProcessor()).expects('processSelect').once().withArgs(builder, [{ foo: 'bar' }, { foo: 'baz' }]).callsFake((query, results) => {
    return results
  })
  let results = await builder.from('users').where('id', '=', 1).implode('foo')
  t.is('barbaz', results)

  // Test with glue.
  builder = getBuilder()
  createMock(builder.getConnection()).expects('select').once().returns([{ foo: 'bar' }, { foo: 'baz' }])
  createMock(builder.getProcessor()).expects('processSelect').once().withArgs(builder, [{ foo: 'bar' }, { foo: 'baz' }]).callsFake((query, results) => {
    return results
  })
  results = await builder.from('users').where('id', '=', 1).implode('foo', ',')
  t.is('bar,baz', results)

  verifyMock()
})

test('testValueMethodReturnsSingleColumn', async (t) => {
  const { createMock, verifyMock } = mock()

  const builder = getBuilder()
  createMock(builder.getConnection()).expects('select').once().withArgs('select "foo" from "users" where "id" = ? limit 1', [1]).returns([{ foo: 'bar' }])
  createMock(builder.getProcessor()).expects('processSelect').once().withArgs(builder, [{ foo: 'bar' }]).returns([{ foo: 'bar' }])
  const results = await builder.from('users').where('id', '=', 1).value('foo')
  t.deepEqual('bar', results)

  verifyMock()
})

test('testRawValueMethodReturnsSingleColumn', async (t) => {
  const { createMock, verifyMock } = mock()

  const builder = getBuilder()
  createMock(builder.getConnection()).expects('select').once().withArgs('select UPPER("foo") from "users" where "id" = ? limit 1', [1]).returns([{ 'UPPER("foo")': 'BAR' }])
  createMock(builder.getProcessor()).expects('processSelect').once().withArgs(builder, [{ 'UPPER("foo")': 'BAR' }]).resolves([{ 'UPPER("foo")': 'BAR' }])

  const results = await builder.from('users').where('id', '=', 1).rawValue('UPPER("foo")')
  t.is('BAR', results)

  verifyMock()
})

test('testAggregateFunctions', async (t) => {
  const { createMock, verifyMock } = mock()

  let builder = getBuilder()
  createMock(builder.getConnection()).expects('select').once().withArgs('select count(*) as aggregate from "users"', []).returns([{ aggregate: 1 }])
  createMock(builder.getProcessor()).expects('processSelect').once().callsFake((builder, results) => {
    return results
  })
  const count = await builder.from('users').count()
  t.is(1, count)

  builder = getBuilder()
  createMock(builder.getConnection()).expects('select').once().withArgs('select exists(select * from "users") as "exists"', []).returns([{ exists: 1 }])
  const exists = await builder.from('users').exists()
  t.true(exists)

  builder = getBuilder()
  createMock(builder.getConnection()).expects('select').once().withArgs('select exists(select * from "users") as "exists"', []).returns([{ exists: 0 }])
  const doesntExist = await builder.from('users').doesntExist()
  t.true(doesntExist)

  builder = getBuilder()
  createMock(builder.getConnection()).expects('select').once().withArgs('select max("id") as aggregate from "users"', []).returns([{ aggregate: 1 }])
  createMock(builder.getProcessor()).expects('processSelect').once().callsFake((builder, results) => {
    return results
  })
  const max = await builder.from('users').max('id')
  t.is(1, max)

  builder = getBuilder()
  createMock(builder.getConnection()).expects('select').once().withArgs('select min("id") as aggregate from "users"', []).returns([{ aggregate: 1 }])
  createMock(builder.getProcessor()).expects('processSelect').once().callsFake((builder, results) => {
    return results
  })
  const min = await builder.from('users').min('id')
  t.is(1, min)

  builder = getBuilder()
  createMock(builder.getConnection()).expects('select').once().withArgs('select sum("id") as aggregate from "users"', []).returns([{ aggregate: 1 }])
  createMock(builder.getProcessor()).expects('processSelect').once().callsFake((builder, results) => {
    return results
  })
  const sum = await builder.from('users').sum('id')
  t.is(1, sum)

  verifyMock()
})

test('testSqlServerExists', async (t) => {
  const { createMock, verifyMock } = mock()

  const builder = getSqlServerBuilder()
  createMock(builder.getConnection()).expects('select').once().withArgs('select top 1 1 [exists] from [users]', []).returns([{ exists: 1 }])
  const results = await builder.from('users').exists()
  t.true(results)

  verifyMock()
})

test('testExistsOr', async (t) => {
  const { createMock, verifyMock } = mock()

  let builder = getBuilder()
  createMock(builder.getConnection()).expects('select').returns([{ exists: 0 }])
  let results = await builder.from('users').existsOr(() => {
    return 123
  })
  t.is(123, results)

  builder = getBuilder()
  createMock(builder.getConnection()).expects('select').returns([{ exists: 1 }])
  results = await builder.from('users').existsOr(() => {
    throw new Error('RuntimeException')
  })
  t.true(results)

  verifyMock()
})

test('testDoesntExistsOr', async (t) => {
  const { createMock, verifyMock } = mock()

  let builder = getBuilder()
  createMock(builder.getConnection()).expects('select').resolves([{ exists: 1 }])
  let results = await builder.from('users').doesntExistOr(() => {
    return 123
  })
  t.is(123, results)

  builder = getBuilder()
  createMock(builder.getConnection()).expects('select').resolves([{ exists: 0 }])
  results = await builder.from('users').doesntExistOr(() => {
    throw new Error('RuntimeException')
  })
  t.true(results)

  verifyMock()
})

test('testAggregateResetFollowedByGet', async (t) => {
  const { createMock, verifyMock } = mock()

  const builder = getBuilder()
  const connectionMock = createMock(builder.getConnection())

  connectionMock.expects('select').once().withArgs('select count(*) as aggregate from "users"', []).returns([{ aggregate: 1 }])
  connectionMock.expects('select').once().withArgs('select sum("id") as aggregate from "users"', []).returns([{ aggregate: 2 }])
  connectionMock.expects('select').once().withArgs('select "column1", "column2" from "users"', []).resolves([{ column1: 'foo', column2: 'bar' }])

  createMock(builder.getProcessor()).expects('processSelect').thrice().callsFake((builder, results) => {
    return results
  })

  builder.from('users').select('column1', 'column2')
  const count = await builder.count()
  t.is(1, count)

  const sum = await builder.sum('id')
  t.is(2, sum)

  const result = await builder.get()
  t.deepEqual([{ column1: 'foo', column2: 'bar' }], result.all())

  verifyMock()
})

test('testAggregateResetFollowedBySelectGet', async (t) => {
  const { createMock, verifyMock } = mock()

  const builder = getBuilder()
  const connectionMock = createMock(builder.getConnection())
  connectionMock.expects('select').once().withArgs('select count("column1") as aggregate from "users"', []).returns([{ aggregate: 1 }])
  connectionMock.expects('select').once().withArgs('select "column2", "column3" from "users"', []).returns([{ column2: 'foo', column3: 'bar' }])
  createMock(builder.getProcessor()).expects('processSelect').twice().callsFake((builder, results) => {
    return results
  })

  builder.from('users')
  const count = await builder.count('column1')
  t.is(1, count)

  const result = await builder.select('column2', 'column3').get()
  t.deepEqual([{ column2: 'foo', column3: 'bar' }], result.all())

  verifyMock()
})

test('testAggregateResetFollowedByGetWithColumns', async (t) => {
  const { createMock, verifyMock } = mock()

  const builder = getBuilder()

  const connectionMock = createMock(builder.getConnection())
  connectionMock.expects('select').once().withArgs('select count("column1") as aggregate from "users"', []).returns([{ aggregate: 1 }])
  connectionMock.expects('select').once().withArgs('select "column2", "column3" from "users"', []).returns([{ column2: 'foo', column3: 'bar' }])
  createMock(builder.getProcessor()).expects('processSelect').twice().callsFake((builder, results) => {
    return results
  })

  builder.from('users')
  const count = await builder.count('column1')
  t.is(1, count)

  const result = await builder.get(['column2', 'column3'])
  t.deepEqual([{ column2: 'foo', column3: 'bar' }], result.all())

  verifyMock()
})

test('testAggregateWithSubSelect', async (t) => {
  const { createMock, verifyMock } = mock()

  const builder = getBuilder()
  createMock(builder.getConnection()).expects('select').once().withArgs('select count(*) as aggregate from "users"', []).returns([{ aggregate: 1 }])
  createMock(builder.getProcessor()).expects('processSelect').once().callsFake((builder, results) => {
    return results
  })

  await builder.from('users').selectSub((query) => {
    query.from('posts').select('foo', 'bar').where('title', 'foo')
  }, 'post')

  const count = await builder.count()
  t.is(1, count)
  t.is('(select "foo", "bar" from "posts" where "title" = ?) as "post"', builder.columns[0].getValue())
  t.deepEqual(['foo'], builder.getBindings())

  verifyMock()
})

test('testSubqueriesBindings', (t) => {
  let builder = getBuilder()
  const second = getBuilder().select('*').from('users').orderByRaw('id = ?', 2)
  const third = getBuilder().select('*').from('users').where('id', 3).groupBy('id').having('id', '!=', 4)
  builder.groupBy('a').having('a', '=', 1).union(second).union(third)
  t.deepEqual([1, 2, 3, 4], builder.getBindings())

  builder = getBuilder().select('*').from('users').where('email', '=', (query) => {
    query.select(new Raw('max(id)'))
      .from('users').where('email', '=', 'bar')
      .orderByRaw('email like ?', '%.com')
      .groupBy('id').having('id', '=', 4)
  }).orWhere('id', '=', 'foo').groupBy('id').having('id', '=', 5)

  t.deepEqual(['bar', 4, '%.com', 'foo', 5], builder.getBindings())
})

test('testInsertMethod', async (t) => {
  const { createMock, verifyMock } = mock()

  const builder = getBuilder()
  createMock(builder.getConnection()).expects('insert').once().withArgs('insert into "users" ("email") values (?)', ['foo']).returns(true)

  const result = await builder.from('users').insert({ email: 'foo' })
  t.true(result)

  verifyMock()
})

test('testInsertUsingMethod', async (t) => {
  const { createMock, verifyMock } = mock()

  const builder = getBuilder()
  createMock(builder.getConnection()).expects('affectingStatement').once().withArgs('insert into "table1" ("foo") select "bar" from "table2" where "foreign_id" = ?', [5]).returns(1)

  const result = await builder.from('table1').insertUsing(
    ['foo'],
    (query) => {
      query.select(['bar']).from('table2').where('foreign_id', '=', 5)
    }
  )

  t.is(1, result)

  verifyMock()
})

test('testInsertUsingWithEmptyColumns', async (t) => {
  const { createMock, verifyMock } = mock()

  const builder = getBuilder()
  createMock(builder.getConnection()).expects('affectingStatement').once().withArgs('insert into "table1" select * from "table2" where "foreign_id" = ?', [5]).resolves(1)

  const result = await builder.from('table1').insertUsing(
    [],
    (query) => {
      query.from('table2').where('foreign_id', '=', 5)
    }
  )

  t.is(result, 1)

  verifyMock()
})

test('testInsertUsingInvalidSubquery', async t => {
  const error = await t.throwsAsync(async () => {
    const builder = getBuilder()
    await builder.from('table1').insertUsing(['foo'], ['bar'])
  }, { instanceOf: Error })

  t.true(error.message.includes('InvalidArgumentException'))
  t.true(error.message.includes('A subquery must be a query builder instance, a Closure, or a string'))
})

test('testInsertOrIgnoreMethod', async (t) => {
  const error = await t.throwsAsync(async () => {
    const builder = getBuilder()
    await builder.from('users').insertOrIgnore({ email: 'foo' })
  }, { instanceOf: Error })

  t.true(error.message.includes('RuntimeException'))
  t.true(error.message.includes('does not support'))
})

test('testMySqlInsertOrIgnoreMethod', async (t) => {
  const { createMock, verifyMock } = mock()

  const builder = getMySqlBuilder()
  createMock(builder.getConnection()).expects('affectingStatement').once().withArgs('insert ignore into `users` (`email`) values (?)', ['foo']).resolves(1)
  const result = await builder.from('users').insertOrIgnore({ email: 'foo' })
  t.is(1, result)

  verifyMock()
})

test('testPostgresInsertOrIgnoreMethod', async (t) => {
  const { createMock, verifyMock } = mock()

  const builder = getPostgresBuilder()
  createMock(builder.getConnection()).expects('affectingStatement').once().withArgs('insert into "users" ("email") values (?) on conflict do nothing', ['foo']).returns(1)
  const result = await builder.from('users').insertOrIgnore({ email: 'foo' })
  t.is(1, result)

  verifyMock()
})

test('testSQLiteInsertOrIgnoreMethod', async (t) => {
  const { createMock, verifyMock } = mock()

  const builder = getSQLiteBuilder()
  createMock(builder.getConnection()).expects('affectingStatement').once().withArgs('insert or ignore into "users" ("email") values (?)', ['foo']).resolves(1)

  const result = await builder.from('users').insertOrIgnore({ email: 'foo' })
  t.is(1, result)

  verifyMock()
})

test('testSqlServerInsertOrIgnoreMethod', async (t) => {
  const error = await t.throwsAsync(async () => {
    const builder = getSqlServerBuilder()
    await builder.from('users').insertOrIgnore({ email: 'foo' })
  }, { instanceOf: Error })

  t.true(error.message.includes('RuntimeException'))
  t.true(error.message.includes('does not support'))
})

test('testInsertGetIdMethod', async (t) => {
  const { createMock, verifyMock } = mock()

  const builder = getBuilder()
  createMock(builder.getProcessor()).expects('processInsertGetId').once().withArgs(builder, 'insert into "users" ("email") values (?)', ['foo'], 'id').resolves(1)
  const result = await builder.from('users').insertGetId({ email: 'foo' }, 'id')
  t.is(1, result)

  verifyMock()
})

test('testInsertGetIdMethodRemovesExpressions', async (t) => {
  const { createMock, verifyMock } = mock()

  const builder = getBuilder()
  createMock(builder.getProcessor()).expects('processInsertGetId').once().withArgs(builder, 'insert into "users" ("email", "bar") values (?, bar)', ['foo'], 'id').resolves(1)
  const result = await builder.from('users').insertGetId({ email: 'foo', bar: new Raw('bar') }, 'id')
  t.is(1, result)

  verifyMock()
})

test('testInsertGetIdWithEmptyValues', async (t) => {
  const { createMock, verifyMock } = mock()

  let builder = getMySqlBuilder()
  createMock(builder.getProcessor()).expects('processInsertGetId').once().withArgs(builder, 'insert into `users` () values ()', [], undefined)
  await builder.from('users').insertGetId([])

  builder = getPostgresBuilder()
  createMock(builder.getProcessor()).expects('processInsertGetId').once().withArgs(builder, 'insert into "users" default values returning "id"', [], undefined)
  await builder.from('users').insertGetId([])

  builder = getSQLiteBuilder()
  createMock(builder.getProcessor()).expects('processInsertGetId').once().withArgs(builder, 'insert into "users" default values', [], undefined)
  await builder.from('users').insertGetId([])

  builder = getSqlServerBuilder()
  createMock(builder.getProcessor()).expects('processInsertGetId').once().withArgs(builder, 'insert into [users] default values', [], undefined)
  await builder.from('users').insertGetId([])

  t.pass()

  verifyMock()
})

test('testInsertMethodRespectsRawBindings', async (t) => {
  const { createMock, verifyMock } = mock()

  const builder = getBuilder()

  createMock(builder.getConnection()).expects('insert').once().withArgs('insert into "users" ("email") values (CURRENT TIMESTAMP)', []).resolves(true)
  const result = await builder.from('users').insert({ email: new Raw('CURRENT TIMESTAMP') })
  t.true(result)

  verifyMock()
})

test('testMultipleInsertsWithExpressionValues', async (t) => {
  const { createMock, verifyMock } = mock()

  const builder = getBuilder()

  createMock(builder.getConnection()).expects('insert').once().withArgs('insert into "users" ("email") values (UPPER(\'Foo\')), (LOWER(\'Foo\'))', []).resolves(true)
  const result = await builder.from('users').insert([{ email: new Raw("UPPER('Foo')") }, { email: new Raw("LOWER('Foo')") }])
  t.true(result)

  verifyMock()
})

test('testUpdateMethod', async (t) => {
  const { createMock, verifyMock } = mock()

  let builder = getBuilder()
  createMock(builder.getConnection()).expects('update').once().withArgs('update "users" set "email" = ?, "name" = ? where "id" = ?', ['foo', 'bar', 1]).resolves(1)
  let result = await builder.from('users').where('id', '=', 1).update({ email: 'foo', name: 'bar' })
  t.is(1, result)

  builder = getMySqlBuilder()
  createMock(builder.getConnection()).expects('update').once().withArgs('update `users` set `email` = ?, `name` = ? where `id` = ? order by `foo` desc limit 5', ['foo', 'bar', 1]).resolves(1)
  result = await builder.from('users').where('id', '=', 1).orderBy('foo', 'desc').limit(5).update({ email: 'foo', name: 'bar' })
  t.is(1, result)

  verifyMock()
})

test('testUpsertMethod', async (t) => {
  const { createMock, verifyMock } = mock()

  let builder = getMySqlBuilder()
  let connectionMock = createMock(builder.getConnection())
  connectionMock.expects('getConfig').withArgs('use_upsert_alias').returns(false)
  connectionMock.expects('affectingStatement').once().withArgs('insert into `users` (`email`, `name`) values (?, ?), (?, ?) on duplicate key update `email` = values(`email`), `name` = values(`name`)', ['foo', 'bar', 'foo2', 'bar2']).resolves(2)
  let result = await builder.from('users').upsert([{ email: 'foo', name: 'bar' }, { name: 'bar2', email: 'foo2' }], 'email')
  t.is(result, 2)

  builder = getMySqlBuilder()
  connectionMock = createMock(builder.getConnection())
  connectionMock.expects('getConfig').withArgs('use_upsert_alias').returns(true)
  connectionMock.expects('affectingStatement').once().withArgs('insert into `users` (`email`, `name`) values (?, ?), (?, ?) as lihtne_upsert_alias on duplicate key update `email` = `lihtne_upsert_alias`.`email`, `name` = `lihtne_upsert_alias`.`name`', ['foo', 'bar', 'foo2', 'bar2']).resolves(2)
  result = await builder.from('users').upsert([{ email: 'foo', name: 'bar' }, { name: 'bar2', email: 'foo2' }], 'email')
  t.is(result, 2)

  builder = getPostgresBuilder()
  createMock(builder.getConnection()).expects('affectingStatement').once().withArgs('insert into "users" ("email", "name") values (?, ?), (?, ?) on conflict ("email") do update set "email" = "excluded"."email", "name" = "excluded"."name"', ['foo', 'bar', 'foo2', 'bar2']).resolves(2)
  result = await builder.from('users').upsert([{ email: 'foo', name: 'bar' }, { name: 'bar2', email: 'foo2' }], 'email')
  t.is(result, 2)

  builder = getSQLiteBuilder()
  createMock(builder.getConnection()).expects('affectingStatement').once().withArgs('insert into "users" ("email", "name") values (?, ?), (?, ?) on conflict ("email") do update set "email" = "excluded"."email", "name" = "excluded"."name"', ['foo', 'bar', 'foo2', 'bar2']).resolves(2)
  result = await builder.from('users').upsert([{ email: 'foo', name: 'bar' }, { name: 'bar2', email: 'foo2' }], 'email')
  t.is(result, 2)

  builder = getSqlServerBuilder()
  createMock(builder.getConnection()).expects('affectingStatement').once().withArgs('merge [users] using (values (?, ?), (?, ?)) [lihtne_source] ([email], [name]) on [lihtne_source].[email] = [users].[email] when matched then update set [email] = [lihtne_source].[email], [name] = [lihtne_source].[name] when not matched then insert ([email], [name]) values ([email], [name]);', ['foo', 'bar', 'foo2', 'bar2']).resolves(2)
  result = await builder.from('users').upsert([{ email: 'foo', name: 'bar' }, { name: 'bar2', email: 'foo2' }], 'email')
  t.is(result, 2)

  verifyMock()
})

test('testUpsertMethodWithUpdateColumns', async (t) => {
  const { createMock, verifyMock } = mock()

  let builder = getMySqlBuilder()
  let connectionMock = createMock(builder.getConnection())
  connectionMock.expects('getConfig').withArgs('use_upsert_alias').returns(false)
  connectionMock.expects('affectingStatement').once().withArgs('insert into `users` (`email`, `name`) values (?, ?), (?, ?) on duplicate key update `name` = values(`name`)', ['foo', 'bar', 'foo2', 'bar2']).resolves(2)
  let result = await builder.from('users').upsert([{ email: 'foo', name: 'bar' }, { name: 'bar2', email: 'foo2' }], 'email', ['name'])
  t.is(result, 2)

  builder = getMySqlBuilder()
  connectionMock = createMock(builder.getConnection())
  connectionMock.expects('getConfig').withArgs('use_upsert_alias').returns(true)
  connectionMock.expects('affectingStatement').once().withArgs('insert into `users` (`email`, `name`) values (?, ?), (?, ?) as lihtne_upsert_alias on duplicate key update `name` = `lihtne_upsert_alias`.`name`', ['foo', 'bar', 'foo2', 'bar2']).resolves(2)
  result = await builder.from('users').upsert([{ email: 'foo', name: 'bar' }, { name: 'bar2', email: 'foo2' }], 'email', ['name'])
  t.is(result, 2)

  builder = getPostgresBuilder()
  connectionMock = createMock(builder.getConnection())
  connectionMock.expects('affectingStatement').once().withArgs('insert into "users" ("email", "name") values (?, ?), (?, ?) on conflict ("email") do update set "name" = "excluded"."name"', ['foo', 'bar', 'foo2', 'bar2']).resolves(2)
  result = await builder.from('users').upsert([{ email: 'foo', name: 'bar' }, { name: 'bar2', email: 'foo2' }], 'email', ['name'])
  t.is(result, 2)

  builder = getSQLiteBuilder()
  connectionMock = createMock(builder.getConnection())
  connectionMock.expects('affectingStatement').once().withArgs('insert into "users" ("email", "name") values (?, ?), (?, ?) on conflict ("email") do update set "name" = "excluded"."name"', ['foo', 'bar', 'foo2', 'bar2']).resolves(2)
  result = await builder.from('users').upsert([{ email: 'foo', name: 'bar' }, { name: 'bar2', email: 'foo2' }], 'email', ['name'])
  t.is(result, 2)

  builder = getSqlServerBuilder()
  connectionMock = createMock(builder.getConnection())
  connectionMock.expects('affectingStatement').once().withArgs('merge [users] using (values (?, ?), (?, ?)) [lihtne_source] ([email], [name]) on [lihtne_source].[email] = [users].[email] when matched then update set [name] = [lihtne_source].[name] when not matched then insert ([email], [name]) values ([email], [name]);', ['foo', 'bar', 'foo2', 'bar2']).resolves(2)
  result = await builder.from('users').upsert([{ email: 'foo', name: 'bar' }, { name: 'bar2', email: 'foo2' }], 'email', ['name'])
  t.is(result, 2)

  verifyMock()
})

test('testUpdateMethodWithJoins', async (t) => {
  const { createMock, verifyMock } = mock()

  let builder = getBuilder()
  createMock(builder.getConnection()).expects('update').once().withArgs('update "users" inner join "orders" on "users"."id" = "orders"."user_id" set "email" = ?, "name" = ? where "users"."id" = ?', ['foo', 'bar', 1]).resolves(1)
  let result = await builder.from('users').join('orders', 'users.id', '=', 'orders.user_id').where('users.id', '=', 1).update({ email: 'foo', name: 'bar' })
  t.is(result, 1)

  builder = getBuilder()
  createMock(builder.getConnection()).expects('update').once().withArgs('update "users" inner join "orders" on "users"."id" = "orders"."user_id" and "users"."id" = ? set "email" = ?, "name" = ?', [1, 'foo', 'bar']).resolves(1)
  result = await builder.from('users').join('orders', (join) => {
    join.on('users.id', '=', 'orders.user_id')
      .where('users.id', '=', 1)
  }).update({ email: 'foo', name: 'bar' })
  t.is(result, 1)

  verifyMock()
})

test('testUpdateMethodWithJoinsOnSqlServer', async (t) => {
  const { createMock, verifyMock } = mock()

  let builder = getSqlServerBuilder()
  createMock(builder.getConnection()).expects('update').once().withArgs('update [users] set [email] = ?, [name] = ? from [users] inner join [orders] on [users].[id] = [orders].[user_id] where [users].[id] = ?', ['foo', 'bar', 1]).resolves(1)
  let result = await builder.from('users').join('orders', 'users.id', '=', 'orders.user_id').where('users.id', '=', 1).update({ email: 'foo', name: 'bar' })
  t.deepEqual(result, 1)

  builder = getSqlServerBuilder()
  createMock(builder.getConnection()).expects('update').once().withArgs('update [users] set [email] = ?, [name] = ? from [users] inner join [orders] on [users].[id] = [orders].[user_id] and [users].[id] = ?', ['foo', 'bar', 1]).resolves(1)
  result = await builder.from('users').join('orders', (join) => {
    join.on('users.id', '=', 'orders.user_id')
      .where('users.id', '=', 1)
  }).update({ email: 'foo', name: 'bar' })
  t.is(result, 1)

  verifyMock()
})

test('testUpdateMethodWithJoinsOnMySql', async (t) => {
  const { createMock, verifyMock } = mock()

  let builder = getMySqlBuilder()
  createMock(builder.getConnection()).expects('update').once().withArgs('update `users` inner join `orders` on `users`.`id` = `orders`.`user_id` set `email` = ?, `name` = ? where `users`.`id` = ?', ['foo', 'bar', 1]).resolves(1)
  let result = await builder.from('users').join('orders', 'users.id', '=', 'orders.user_id').where('users.id', '=', 1).update({ email: 'foo', name: 'bar' })
  t.is(result, 1)

  builder = getMySqlBuilder()
  createMock(builder.getConnection()).expects('update').once().withArgs('update `users` inner join `orders` on `users`.`id` = `orders`.`user_id` and `users`.`id` = ? set `email` = ?, `name` = ?', [1, 'foo', 'bar']).resolves(1)
  result = await builder.from('users').join('orders', (join) => {
    join.on('users.id', '=', 'orders.user_id')
      .where('users.id', '=', 1)
  }).update({ email: 'foo', name: 'bar' })
  t.is(result, 1)

  verifyMock()
})

test('testUpdateMethodWithJoinsOnSQLite', async (t) => {
  const { createMock, verifyMock } = mock()

  let builder = getSQLiteBuilder()
  createMock(builder.getConnection()).expects('update').once().withArgs('update "users" set "email" = ?, "name" = ? where "rowid" in (select "users"."rowid" from "users" where "users"."id" > ? order by "id" asc limit 3)', ['foo', 'bar', 1]).resolves(1)
  let result = await builder.from('users').where('users.id', '>', 1).limit(3).oldest('id').update({ email: 'foo', name: 'bar' })
  t.is(result, 1)

  builder = getSQLiteBuilder()
  createMock(builder.getConnection()).expects('update').once().withArgs('update "users" set "email" = ?, "name" = ? where "rowid" in (select "users"."rowid" from "users" inner join "orders" on "users"."id" = "orders"."user_id" where "users"."id" = ?)', ['foo', 'bar', 1]).resolves(1)
  result = await builder.from('users').join('orders', 'users.id', '=', 'orders.user_id').where('users.id', '=', 1).update({ email: 'foo', name: 'bar' })
  t.is(result, 1)

  builder = getSQLiteBuilder()
  createMock(builder.getConnection()).expects('update').once().withArgs('update "users" set "email" = ?, "name" = ? where "rowid" in (select "users"."rowid" from "users" inner join "orders" on "users"."id" = "orders"."user_id" and "users"."id" = ?)', ['foo', 'bar', 1]).resolves(1)
  result = await builder.from('users').join('orders', (join) => {
    join.on('users.id', '=', 'orders.user_id')
      .where('users.id', '=', 1)
  }).update({ email: 'foo', name: 'bar' })
  t.is(result, 1)

  builder = getSQLiteBuilder()
  createMock(builder.getConnection()).expects('update').once().withArgs('update "users" as "u" set "email" = ?, "name" = ? where "rowid" in (select "u"."rowid" from "users" as "u" inner join "orders" as "o" on "u"."id" = "o"."user_id")', ['foo', 'bar']).resolves(1)
  result = await builder.from('users as u').join('orders as o', 'u.id', '=', 'o.user_id').update({ email: 'foo', name: 'bar' })
  t.is(result, 1)

  verifyMock()
})

test('testUpdateMethodWithJoinsAndAliasesOnSqlServer', async (t) => {
  const { createMock, verifyMock } = mock()

  const builder = getSqlServerBuilder()
  createMock(builder.getConnection()).expects('update').once().withArgs('update [u] set [email] = ?, [name] = ? from [users] as [u] inner join [orders] on [u].[id] = [orders].[user_id] where [u].[id] = ?', ['foo', 'bar', 1]).resolves(1)
  const result = await builder.from('users as u').join('orders', 'u.id', '=', 'orders.user_id').where('u.id', '=', 1).update({ email: 'foo', name: 'bar' })
  t.is(result, 1)

  verifyMock()
})

test('testUpdateMethodWithoutJoinsOnPostgres', async (t) => {
  const { createMock, verifyMock } = mock()

  let builder = getPostgresBuilder()
  createMock(builder.getConnection()).expects('update').once().withArgs('update "users" set "email" = ?, "name" = ? where "id" = ?', ['foo', 'bar', 1]).resolves(1)
  let result = await builder.from('users').where('id', '=', 1).update({ 'users.email': 'foo', name: 'bar' })
  t.is(result, 1)

  builder = getPostgresBuilder()
  createMock(builder.getConnection()).expects('update').once().withArgs('update "users" set "email" = ?, "name" = ? where "id" = ?', ['foo', 'bar', 1]).resolves(1)
  result = await builder.from('users').where('id', '=', 1).selectRaw('?', ['ignore']).update({ 'users.email': 'foo', name: 'bar' })
  t.is(result, 1)

  builder = getPostgresBuilder()
  createMock(builder.getConnection()).expects('update').once().withArgs('update "users"."users" set "email" = ?, "name" = ? where "id" = ?', ['foo', 'bar', 1]).resolves(1)
  result = await builder.from('users.users').where('id', '=', 1).selectRaw('?', ['ignore']).update({ 'users.users.email': 'foo', name: 'bar' })
  t.is(result, 1)

  verifyMock()
})

test('testUpdateMethodWithJoinsOnPostgres', async (t) => {
  const { createMock, verifyMock } = mock()

  let builder = getPostgresBuilder()
  createMock(builder.getConnection()).expects('update').once().withArgs('update "users" set "email" = ?, "name" = ? where "ctid" in (select "users"."ctid" from "users" inner join "orders" on "users"."id" = "orders"."user_id" where "users"."id" = ?)', ['foo', 'bar', 1]).resolves(1)
  let result = await builder.from('users').join('orders', 'users.id', '=', 'orders.user_id').where('users.id', '=', 1).update({ email: 'foo', name: 'bar' })
  t.is(result, 1)

  builder = getPostgresBuilder()
  createMock(builder.getConnection()).expects('update').once().withArgs('update "users" set "email" = ?, "name" = ? where "ctid" in (select "users"."ctid" from "users" inner join "orders" on "users"."id" = "orders"."user_id" and "users"."id" = ?)', ['foo', 'bar', 1]).resolves(1)
  result = await builder.from('users').join('orders', (join) => {
    join.on('users.id', '=', 'orders.user_id')
      .where('users.id', '=', 1)
  }).update({ email: 'foo', name: 'bar' })
  t.is(result, 1)

  builder = getPostgresBuilder()
  createMock(builder.getConnection()).expects('update').once().withArgs('update "users" set "email" = ?, "name" = ? where "ctid" in (select "users"."ctid" from "users" inner join "orders" on "users"."id" = "orders"."user_id" and "users"."id" = ? where "name" = ?)', ['foo', 'bar', 1, 'baz']).resolves(1)
  result = await builder.from('users')
    .join('orders', (join) => {
      join.on('users.id', '=', 'orders.user_id')
        .where('users.id', '=', 1)
    }).where('name', 'baz')
    .update({ email: 'foo', name: 'bar' })
  t.is(result, 1)

  verifyMock()
})

test('testUpdateFromMethodWithJoinsOnPostgres', async (t) => {
  const { createMock, verifyMock } = mock()

  let builder = getPostgresBuilder()
  createMock(builder.getConnection()).expects('update').once().withArgs('update "users" set "email" = ?, "name" = ? from "orders" where "users"."id" = ? and "users"."id" = "orders"."user_id"', ['foo', 'bar', 1]).resolves(1)
  let result = await builder.from('users').join('orders', 'users.id', '=', 'orders.user_id').where('users.id', '=', 1).updateFrom({ email: 'foo', name: 'bar' })
  t.is(result, 1)

  builder = getPostgresBuilder()
  createMock(builder.getConnection()).expects('update').once().withArgs('update "users" set "email" = ?, "name" = ? from "orders" where "users"."id" = "orders"."user_id" and "users"."id" = ?', ['foo', 'bar', 1]).resolves(1)
  result = await builder.from('users').join('orders', (join) => {
    join.on('users.id', '=', 'orders.user_id')
      .where('users.id', '=', 1)
  }).updateFrom({ email: 'foo', name: 'bar' })
  t.is(result, 1)

  builder = getPostgresBuilder()
  createMock(builder.getConnection()).expects('update').once().withArgs('update "users" set "email" = ?, "name" = ? from "orders" where "name" = ? and "users"."id" = "orders"."user_id" and "users"."id" = ?', ['foo', 'bar', 'baz', 1]).resolves(1)
  result = await builder.from('users')
    .join('orders', (join) => {
      join.on('users.id', '=', 'orders.user_id')
        .where('users.id', '=', 1)
    }).where('name', 'baz')
    .updateFrom({ email: 'foo', name: 'bar' })
  t.is(result, 1)

  verifyMock()
})

test('testUpdateMethodRespectsRaw', async (t) => {
  const { createMock, verifyMock } = mock()

  const builder = getBuilder()
  createMock(builder.getConnection()).expects('update').once().withArgs('update "users" set "email" = foo, "name" = ? where "id" = ?', ['bar', 1]).resolves(1)
  const result = await builder.from('users').where('id', '=', 1).update({ email: new Raw('foo'), name: 'bar' })
  t.deepEqual(result, 1)

  verifyMock()
})

test('testUpdateOrInsertMethod', async (t) => {
  const { createStub } = mock()

  let builder = getBuilder()
  createStub(builder, 'where').withArgs({ email: 'foo' }).onFirstCall().returns(builder)
  createStub(builder, 'exists').resolves(false)
  createStub(builder, 'insert').withArgs({ email: 'foo', name: 'bar' }).onFirstCall().resolves(true)

  let result = await builder.updateOrInsert({ email: 'foo' }, { name: 'bar' })
  t.true(result)

  builder = getBuilder()

  createStub(builder, 'where').withArgs({ email: 'foo' }).onFirstCall().returns(builder)
  createStub(builder, 'exists').onFirstCall().resolves(true)
  createStub(builder, 'take').resolvesThis(builder)
  createStub(builder, 'update').withArgs({ name: 'bar' }).onFirstCall().resolves(1)

  result = await builder.updateOrInsert({ email: 'foo' }, { name: 'bar' })
  t.true(result)
})

test('testUpdateOrInsertMethodWorksWithEmptyUpdateValues', async (t) => {
  const { createStub } = mock()

  const builder = getBuilder()

  createStub(builder, 'where').withArgs({ email: 'foo' }).onFirstCall().returns(builder)
  createStub(builder, 'exists').onFirstCall().resolves(true)

  const result = await builder.updateOrInsert({ email: 'foo' })
  t.true(result)
  t.true(createStub(builder, 'update').notCalled)
})

test('testDeleteMethod', async (t) => {
  const { createMock, verifyMock } = mock()

  let builder = getBuilder()
  createMock(builder.getConnection()).expects('delete').once().withArgs('delete from "users" where "email" = ?', ['foo']).resolves(1)
  let result = await builder.from('users').where('email', '=', 'foo').delete()
  t.is(result, 1)

  builder = getBuilder()
  createMock(builder.getConnection()).expects('delete').once().withArgs('delete from "users" where "users"."id" = ?', [1]).resolves(1)
  result = await builder.from('users').delete(1)
  t.is(result, 1)

  builder = getBuilder()
  createMock(builder.getConnection()).expects('delete').once().withArgs('delete from "users" where "users"."id" = ?', [1]).resolves(1)
  result = await builder.from('users').selectRaw('?', ['ignore']).delete(1)
  t.is(result, 1)

  builder = getSQLiteBuilder()
  createMock(builder.getConnection()).expects('delete').once().withArgs('delete from "users" where "rowid" in (select "users"."rowid" from "users" where "email" = ? order by "id" asc limit 1)', ['foo']).resolves(1)
  result = await builder.from('users').where('email', '=', 'foo').orderBy('id').take(1).delete()
  t.is(result, 1)

  builder = getMySqlBuilder()
  createMock(builder.getConnection()).expects('delete').once().withArgs('delete from `users` where `email` = ? order by `id` asc limit 1', ['foo']).resolves(1)
  result = await builder.from('users').where('email', '=', 'foo').orderBy('id').take(1).delete()
  t.is(result, 1)

  builder = getSqlServerBuilder()
  createMock(builder.getConnection()).expects('delete').once().withArgs('delete from [users] where [email] = ?', ['foo']).resolves(1)
  result = await builder.from('users').where('email', '=', 'foo').delete()
  t.is(result, 1)

  builder = getSqlServerBuilder()
  createMock(builder.getConnection()).expects('delete').once().withArgs('delete top (1) from [users] where [email] = ?', ['foo']).resolves(1)
  result = await builder.from('users').where('email', '=', 'foo').orderBy('id').take(1).delete()
  t.is(result, 1)

  verifyMock()
})

// test('testDeleteWithJoinMethod', async (t) => {
//   const builder = getSqliteBuilder()
//   builder.getConnection().shouldReceive('delete').once().with('delete from "users" where "rowid" in (select "users"."rowid" from "users" inner join "contacts" on "users"."id" = "contacts"."id" where "users"."email" = ? order by "users"."id" asc limit 1)', ['foo']).andReturn(1)
//   result = builder.from('users').join('contacts', 'users.id', '=', 'contacts.id').where('users.email', '=', 'foo').orderBy('users.id').limit(1).delete()
//   t.deepEqual(1, result)

//   const builder = getSqliteBuilder()
//   builder.getConnection().shouldReceive('delete').once().with('delete from "users" as "u" where "rowid" in (select "u"."rowid" from "users" as "u" inner join "contacts" as "c" on "u"."id" = "c"."id")', []).andReturn(1)
//   result = builder.from('users as u').join('contacts as c', 'u.id', '=', 'c.id').delete()
//   t.deepEqual(1, result)

//   const builder = getMySqlBuilder()
//   builder.getConnection().shouldReceive('delete').once().with('delete `users` from `users` inner join `contacts` on `users`.`id` = `contacts`.`id` where `email` = ?', ['foo']).andReturn(1)
//   result = builder.from('users').join('contacts', 'users.id', '=', 'contacts.id').where('email', '=', 'foo').orderBy('id').limit(1).delete()
//   t.deepEqual(1, result)

//   const builder = getMySqlBuilder()
//   builder.getConnection().shouldReceive('delete').once().with('delete `a` from `users` as `a` inner join `users` as `b` on `a`.`id` = `b`.`user_id` where `email` = ?', ['foo']).andReturn(1)
//   result = builder.from('users AS a').join('users AS b', 'a.id', '=', 'b.user_id').where('email', '=', 'foo').orderBy('id').limit(1).delete()
//   t.deepEqual(1, result)

//   const builder = getMySqlBuilder()
//   builder.getConnection().shouldReceive('delete').once().with('delete `users` from `users` inner join `contacts` on `users`.`id` = `contacts`.`id` where `users`.`id` = ?', [1]).andReturn(1)
//   result = builder.from('users').join('contacts', 'users.id', '=', 'contacts.id').orderBy('id').take(1).delete(1)
//   t.deepEqual(1, result)

//   const builder = getSqlServerBuilder()
//   builder.getConnection().shouldReceive('delete').once().with('delete [users] from [users] inner join [contacts] on [users].[id] = [contacts].[id] where [email] = ?', ['foo']).andReturn(1)
//   result = builder.from('users').join('contacts', 'users.id', '=', 'contacts.id').where('email', '=', 'foo').delete()
//   t.deepEqual(1, result)

//   const builder = getSqlServerBuilder()
//   builder.getConnection().shouldReceive('delete').once().with('delete [a] from [users] as [a] inner join [users] as [b] on [a].[id] = [b].[user_id] where [email] = ?', ['foo']).andReturn(1)
//   result = builder.from('users AS a').join('users AS b', 'a.id', '=', 'b.user_id').where('email', '=', 'foo').orderBy('id').limit(1).delete()
//   t.deepEqual(1, result)

//   const builder = getSqlServerBuilder()
//   builder.getConnection().shouldReceive('delete').once().with('delete [users] from [users] inner join [contacts] on [users].[id] = [contacts].[id] where [users].[id] = ?', [1]).andReturn(1)
//   result = builder.from('users').join('contacts', 'users.id', '=', 'contacts.id').delete(1)
//   t.deepEqual(1, result)

//   const builder = getPostgresBuilder()
//   builder.getConnection().shouldReceive('delete').once().with('delete from "users" where "ctid" in (select "users"."ctid" from "users" inner join "contacts" on "users"."id" = "contacts"."id" where "users"."email" = ?)', ['foo']).andReturn(1)
//   result = builder.from('users').join('contacts', 'users.id', '=', 'contacts.id').where('users.email', '=', 'foo').delete()
//   t.deepEqual(1, result)

//   const builder = getPostgresBuilder()
//   builder.getConnection().shouldReceive('delete').once().with('delete from "users" as "a" where "ctid" in (select "a"."ctid" from "users" as "a" inner join "users" as "b" on "a"."id" = "b"."user_id" where "email" = ? order by "id" asc limit 1)', ['foo']).andReturn(1)
//   result = builder.from('users AS a').join('users AS b', 'a.id', '=', 'b.user_id').where('email', '=', 'foo').orderBy('id').limit(1).delete()
//   t.deepEqual(1, result)

//   const builder = getPostgresBuilder()
//   builder.getConnection().shouldReceive('delete').once().with('delete from "users" where "ctid" in (select "users"."ctid" from "users" inner join "contacts" on "users"."id" = "contacts"."id" where "users"."id" = ? order by "id" asc limit 1)', [1]).andReturn(1)
//   result = builder.from('users').join('contacts', 'users.id', '=', 'contacts.id').orderBy('id').take(1).delete(1)
//   t.deepEqual(1, result)

//   const builder = getPostgresBuilder()
//   builder.getConnection().shouldReceive('delete').once().with('delete from "users" where "ctid" in (select "users"."ctid" from "users" inner join "contacts" on "users"."id" = "contacts"."user_id" and "users"."id" = ? where "name" = ?)', [1, 'baz']).andReturn(1)
//   result = builder.from('users')
//     .join('contacts', function (join) {
//       join.on('users.id', '=', 'contacts.user_id')
//         .where('users.id', '=', 1)
//     }).where('name', 'baz')
//     .delete()
//   t.deepEqual(1, result)

//   const builder = getPostgresBuilder()
//   builder.getConnection().shouldReceive('delete').once().with('delete from "users" where "ctid" in (select "users"."ctid" from "users" inner join "contacts" on "users"."id" = "contacts"."id")', []).andReturn(1)
//   result = builder.from('users').join('contacts', 'users.id', '=', 'contacts.id').delete()
//   t.deepEqual(1, result)
// })

// test('testTruncateMethod', async (t) => {
//   const builder = getBuilder()
//   builder.getConnection().shouldReceive('statement').once().with('truncate table "users"', [])
//   builder.from('users').truncate()

//   sqlite = new SQLiteGrammar
//   const builder = getBuilder()
//   builder.from('users')
//   t.deepEqual([
//     'delete from sqlite_sequence where name = ?' => ['users'],
//     'delete from "users"' => [],
//   ], sqlite.compileTruncate(builder))
// })

// test('testPreserveAddsClosureToArray', async (t) => {
//   const builder = getBuilder()
//   builder.beforeQuery(function () {
//   })
//   assertCount(1, builder.beforeQueryCallbacks)
//   assertInstanceOf(Closure.class, builder.beforeQueryCallbacks[0])
// })

// test('testApplyPreserveCleansArray', async (t) => {
//   const builder = getBuilder()
//   builder.beforeQuery(function () {
//   })
//   assertCount(1, builder.beforeQueryCallbacks)
//   builder.applyBeforeQueryCallbacks()
//   assertCount(0, builder.beforeQueryCallbacks)
// })

// test('testPreservedAreAppliedByToSql', async (t) => {
//   const builder = getBuilder()
//   builder.beforeQuery(function (builder) {
//     builder.where('foo', 'bar')
//   })
//   t.is('select * where "foo" = ?', builder.toSql())
//   t.deepEqual(['bar'], builder.getBindings())
// })

// test('testPreservedAreAppliedByInsert', async (t) => {
//   const builder = getBuilder()
//   builder.getConnection().shouldReceive('insert').once().with('insert into "users" ("email") values (?)', ['foo'])
//   builder.beforeQuery(function (builder) {
//     builder.from('users')
//   })
//   builder.insert(['email' => 'foo'])
// })

// test('testPreservedAreAppliedByInsertGetId', async (t) => {
//   called = false
//   const builder = getBuilder()
//   builder.getProcessor().shouldReceive('processInsertGetId').once().with(builder, 'insert into "users" ("email") values (?)', ['foo'], 'id')
//   builder.beforeQuery(function (builder) {
//     builder.from('users')
//   })
//   builder.insertGetId(['email' => 'foo'], 'id')
// })

// test('testPreservedAreAppliedByInsertUsing', async (t) => {
//   const builder = getBuilder()
//   builder.getConnection().shouldReceive('affectingStatement').once().with('insert into "users" ("email") select *', [])
//   builder.beforeQuery(function (builder) {
//     builder.from('users')
//   })
//   builder.insertUsing(['email'], getBuilder())
// })

// test('testPreservedAreAppliedByUpsert', async (t) => {
//   const builder = getMySqlBuilder()
//   builder.getConnection()
//     .shouldReceive('getConfig').with('use_upsert_alias').andReturn(false)
//     .shouldReceive('affectingStatement').once().with('insert into `users` (`email`) values (?) on duplicate key update `email` = values(`email`)', ['foo'])
//   builder.beforeQuery(function (builder) {
//     builder.from('users')
//   })
//   builder.upsert(['email' => 'foo'], 'id')

//   const builder = getMySqlBuilder()
//   builder.getConnection()
//     .shouldReceive('getConfig').with('use_upsert_alias').andReturn(true)
//     .shouldReceive('affectingStatement').once().with('insert into `users` (`email`) values (?) as lihtne_upsert_alias on duplicate key update `email` = `lihtne_upsert_alias`.`email`', ['foo'])
//   builder.beforeQuery(function (builder) {
//     builder.from('users')
//   })
//   builder.upsert(['email' => 'foo'], 'id')
// })

// test('testPreservedAreAppliedByUpdate', async (t) => {
//   const builder = getBuilder()
//   builder.getConnection().shouldReceive('update').once().with('update "users" set "email" = ? where "id" = ?', ['foo', 1])
//   builder.from('users').beforeQuery(function (builder) {
//     builder.where('id', 1)
//   })
//   builder.update(['email' => 'foo'])
// })

// test('testPreservedAreAppliedByDelete', async (t) => {
//   const builder = getBuilder()
//   builder.getConnection().shouldReceive('delete').once().with('delete from "users"', [])
//   builder.beforeQuery(function (builder) {
//     builder.from('users')
//   })
//   builder.delete()
// })

// test('testPreservedAreAppliedByTruncate', async (t) => {
//   const builder = getBuilder()
//   builder.getConnection().shouldReceive('statement').once().with('truncate table "users"', [])
//   builder.beforeQuery(function (builder) {
//     builder.from('users')
//   })
//   builder.truncate()
// })

// test('testPreservedAreAppliedByExists', async (t) => {
//   const builder = getBuilder()
//   builder.getConnection().shouldReceive('select').once().with('select exists(select * from "users") as "exists"', [], true)
//   builder.beforeQuery(function (builder) {
//     builder.from('users')
//   })
//   builder.exists()
// })

// test('testPostgresInsertGetId', async (t) => {
//   const builder = getPostgresBuilder()
//   builder.getProcessor().shouldReceive('processInsertGetId').once().with(builder, 'insert into "users" ("email") values (?) returning "id"', ['foo'], 'id').andReturn(1)
//   result = builder.from('users').insertGetId(['email' => 'foo'], 'id')
//   t.deepEqual(1, result)
// })

// test('testMySqlWrapping', async (t) => {
//   const builder = getMySqlBuilder()
//   builder.select('*').from('users')
//   t.is('select * from `users`', builder.toSql())
// })

// test('testMySqlUpdateWrappingJson', async (t) => {
//   const grammar = new MySqlGrammar
//   processor = m.mock(Processor.class)

//   const connection = createMock(ConnectionInterface.class)
//   connection.expects(once())
//     .method('update')
//     .with(
//       'update `users` set `name` = json_set(`name`, \'."first_name"\', ?), `name` = json_set(`name`, \'."last_name"\', ?) where `active` = ?',
//       ['John', 'Doe', 1]
//     )

//   const builder = new Builder(connection, grammar, processor)

//   builder.from('users').where('active', '=', 1).update(['name.first_name' => 'John', 'name.last_name' => 'Doe'])
// })

// test('testMySqlUpdateWrappingNestedJson', async (t) => {
//   const grammar = new MySqlGrammar
//   processor = m.mock(Processor.class)

//   const connection = createMock(ConnectionInterface.class)
//   connection.expects(once())
//     .method('update')
//     .with(
//       'update `users` set `meta` = json_set(`meta`, \'."name"."first_name"\', ?), `meta` = json_set(`meta`, \'."name"."last_name"\', ?) where `active` = ?',
//       ['John', 'Doe', 1]
//     )

//   const builder = new Builder(connection, grammar, processor)

//   builder.from('users').where('active', '=', 1).update(['meta.name.first_name' => 'John', 'meta.name.last_name' => 'Doe'])
// })

// test('testMySqlUpdateWrappingJsonArray', async (t) => {
//   const grammar = new MySqlGrammar
//   processor = m.mock(Processor.class)

//   const connection = createMock(ConnectionInterface.class)
//   connection.expects(once())
//     .method('update')
//     .with(
//       'update `users` set `options` = ?, `meta` = json_set(`meta`, \'."tags"\', cast(? as json)), `group_id` = 45, `created_at` = ? where `active` = ?',
//       [
//         json_encode(['2fa' => false, 'presets' => ['lihtne', 'vue']]),
//         json_encode(['white', 'large']),
//         new DateTime('2019-08-06'),
//         1,
//       ]
//     )

//   const builder = new Builder(connection, grammar, processor)
//   builder.from('users').where('active', 1).update([
//     'options' => ['2fa' => false, 'presets' => ['lihtne', 'vue']],
//     'meta.tags' => ['white', 'large'],
//     'group_id' => new Raw('45'),
//     'created_at' => new DateTime('2019-08-06'),
//   ])
// })

// test('testMySqlUpdateWrappingJsonPathArrayIndex', async (t) => {
//   const grammar = new MySqlGrammar
//   processor = m.mock(Processor.class)

//   const connection = createMock(ConnectionInterface.class)
//   connection.expects(once())
//     .method('update')
//     .with(
//       'update `users` set `options` = json_set(`options`, \'[1]."2fa"\', false), `meta` = json_set(`meta`, \'."tags"[0][2]\', ?) where `active` = ?',
//       [
//         'large',
//         1,
//       ]
//     )

//   const builder = new Builder(connection, grammar, processor)
//   builder.from('users').where('active', 1).update([
//     'options.[1].2fa' => false,
//     'meta.tags[0][2]' => 'large',
//   ])
// })

// test('testMySqlUpdateWithJsonPreparesBindingsCorrectly', async (t) => {
//   const grammar = new MySqlGrammar
//   processor = m.mock(Processor.class)

//   const connection = m.mock(ConnectionInterface.class)
//   connection.shouldReceive('update')
//     .once()
//     .with(
//       'update `users` set `options` = json_set(`options`, \'."enable"\', false), `updated_at` = ? where `id` = ?',
//       ['2015-05-26 22:02:06', 0]
//     )
//   const builder = new Builder(connection, grammar, processor)
//   builder.from('users').where('id', '=', 0).update(['options.enable' => false, 'updated_at' => '2015-05-26 22:02:06'])

//   connection.shouldReceive('update')
//     .once()
//     .with(
//       'update `users` set `options` = json_set(`options`, \'."size"\', ?), `updated_at` = ? where `id` = ?',
//       [45, '2015-05-26 22:02:06', 0]
//     )
//   const builder = new Builder(connection, grammar, processor)
//   builder.from('users').where('id', '=', 0).update(['options.size' => 45, 'updated_at' => '2015-05-26 22:02:06'])

//   const builder = getMySqlBuilder()
//   builder.getConnection().shouldReceive('update').once().with('update `users` set `options` = json_set(`options`, \'."size"\', ?)', [null])
//   builder.from('users').update(['options.size' => null])

//   const builder = getMySqlBuilder()
//   builder.getConnection().shouldReceive('update').once().with('update `users` set `options` = json_set(`options`, \'."size"\', 45)', [])
//   builder.from('users').update(['options.size' => new Raw('45')])
// })

// test('testPostgresUpdateWrappingJson', async (t) => {
//   const builder = getPostgresBuilder()
//   builder.getConnection().shouldReceive('update')
//     .with('update "users" set "options" = jsonb_set("options".jsonb, \'{"name","first_name"}\', ?)', ['"John"'])
//   builder.from('users').update(['users.options.name.first_name' => 'John'])

//   const builder = getPostgresBuilder()
//   builder.getConnection().shouldReceive('update')
//     .with('update "users" set "options" = jsonb_set("options".jsonb, \'{"language"}\', \'null\')', [])
//   builder.from('users').update(['options.language' => new Raw("'null'")])
// })

// test('testPostgresUpdateWrappingJsonArray', async (t) => {
//   const builder = getPostgresBuilder()
//   builder.getConnection().shouldReceive('update')
//     .with('update "users" set "options" = ?, "meta" = jsonb_set("meta".jsonb, \'{"tags"}\', ?), "group_id" = 45, "created_at" = ?', [
//       json_encode(['2fa' => false, 'presets' => ['lihtne', 'vue']]),
//       json_encode(['white', 'large']),
//       new DateTime('2019-08-06'),
//     ])

//   builder.from('users').update([
//     'options' => ['2fa' => false, 'presets' => ['lihtne', 'vue']],
//     'meta.tags' => ['white', 'large'],
//     'group_id' => new Raw('45'),
//     'created_at' => new DateTime('2019-08-06'),
//   ])
// })

// test('testPostgresUpdateWrappingJsonPathArrayIndex', async (t) => {
//   const builder = getPostgresBuilder()
//   builder.getConnection().shouldReceive('update')
//     .with('update "users" set "options" = jsonb_set("options".jsonb, \'{1,"2fa"}\', ?), "meta" = jsonb_set("meta".jsonb, \'{"tags",0,2}\', ?) where ("options".1.\'2fa\').jsonb = \'true\'.jsonb', [
//       'false',
//       '"large"',
//     ])

//   builder.from('users').where('options.[1].2fa', true).update([
//     'options.[1].2fa' => false,
//     'meta.tags[0][2]' => 'large',
//   ])
// })

// test('testSQLiteUpdateWrappingJsonArray', async (t) => {
//   const builder = getSQLiteBuilder()

//   builder.getConnection().shouldReceive('update')
//     .with('update "users" set "options" = ?, "group_id" = 45, "created_at" = ?', [
//       json_encode(['2fa' => false, 'presets' => ['lihtne', 'vue']]),
//       new DateTime('2019-08-06'),
//     ])

//   builder.from('users').update([
//     'options' => ['2fa' => false, 'presets' => ['lihtne', 'vue']],
//     'group_id' => new Raw('45'),
//     'created_at' => new DateTime('2019-08-06'),
//   ])
// })

// test('testSQLiteUpdateWrappingNestedJsonArray', async (t) => {
//   const builder = getSQLiteBuilder()
//   builder.getConnection().shouldReceive('update')
//     .with('update "users" set "group_id" = 45, "created_at" = ?, "options" = json_patch(ifnull("options", json(\'{}\')), json(?))', [
//       new DateTime('2019-08-06'),
//       json_encode(['name' => 'Taylor', 'security' => ['2fa' => false, 'presets' => ['lihtne', 'vue']], 'sharing' => ['twitter' => 'username']]),
//     ])

//   builder.from('users').update([
//     'options.name' => 'Taylor',
//     'group_id' => new Raw('45'),
//     'options.security' => ['2fa' => false, 'presets' => ['lihtne', 'vue']],
//     'options.sharing.twitter' => 'username',
//     'created_at' => new DateTime('2019-08-06'),
//   ])
// })

// test('testSQLiteUpdateWrappingJsonPathArrayIndex', async (t) => {
//   const builder = getSQLiteBuilder()
//   builder.getConnection().shouldReceive('update')
//     .with('update "users" set "options" = json_patch(ifnull("options", json(\'{}\')), json(?)), "meta" = json_patch(ifnull("meta", json(\'{}\')), json(?)) where json_extract("options", \'[1]."2fa"\') = true', [
//       '{"[1]":{"2fa":false}}',
//       '{"tags[0][2]":"large"}',
//     ])

//   builder.from('users').where('options.[1].2fa', true).update([
//     'options.[1].2fa' => false,
//     'meta.tags[0][2]' => 'large',
//   ])
// })

// test('testMySqlWrappingJsonWithString', async (t) => {
//   const builder = getMySqlBuilder()
//   builder.select('*').from('users').where('items.sku', '=', 'foo-bar')
//   t.is('select * from `users` where json_unquote(json_extract(`items`, \'."sku"\')) = ?', builder.toSql())
//   assertCount(1, builder.getRawBindings()['where'])
//   t.is('foo-bar', builder.getRawBindings()['where'][0])
// })

// test('testMySqlWrappingJsonWithInteger', async (t) => {
//   const builder = getMySqlBuilder()
//   builder.select('*').from('users').where('items.price', '=', 1)
//   t.is('select * from `users` where json_unquote(json_extract(`items`, \'."price"\')) = ?', builder.toSql())
// })

// test('testMySqlWrappingJsonWithDouble', async (t) => {
//   const builder = getMySqlBuilder()
//   builder.select('*').from('users').where('items.price', '=', 1.5)
//   t.is('select * from `users` where json_unquote(json_extract(`items`, \'."price"\')) = ?', builder.toSql())
// })

// test('testMySqlWrappingJsonWithBoolean', async (t) => {
//   const builder = getMySqlBuilder()
//   builder.select('*').from('users').where('items.available', '=', true)
//   t.is('select * from `users` where json_extract(`items`, \'."available"\') = true', builder.toSql())

//   const builder = getMySqlBuilder()
//   builder.select('*').from('users').where(new Raw("items.'.available'"), '=', true)
//   t.is("select * from `users` where items.'.available' = true", builder.toSql())
// })

// test('testMySqlWrappingJsonWithBooleanAndIntegerThatLooksLikeOne', async (t) => {
//   const builder = getMySqlBuilder()
//   builder.select('*').from('users').where('items.available', '=', true).where('items.active', '=', false).where('items.number_available', '=', 0)
//   t.is('select * from `users` where json_extract(`items`, \'."available"\') = true and json_extract(`items`, \'."active"\') = false and json_unquote(json_extract(`items`, \'."number_available"\')) = ?', builder.toSql())
// })

// test('testJsonPathEscaping', async (t) => {
//   expectedWithJsonEscaped = <<< 'SQL'
// select json_unquote(json_extract(`json`, '."''))#"'))
//   SQL

//   const builder = getMySqlBuilder()
//   builder.select("json.'))#")
//   t.deepEqual(expectedWithJsonEscaped, builder.toSql())

//   const builder = getMySqlBuilder()
//   builder.select("json.\'))#")
//   t.deepEqual(expectedWithJsonEscaped, builder.toSql())

//   const builder = getMySqlBuilder()
//   builder.select("json.\\'))#")
//   t.deepEqual(expectedWithJsonEscaped, builder.toSql())

//   const builder = getMySqlBuilder()
//   builder.select("json.\\\'))#")
//   t.deepEqual(expectedWithJsonEscaped, builder.toSql())
// })

// test('testMySqlWrappingJson', async (t) => {
//   const builder = getMySqlBuilder()
//   builder.select('*').from('users').whereRaw('items.\'."price"\' = 1')
//   t.is('select * from `users` where items.\'."price"\' = 1', builder.toSql())

//   const builder = getMySqlBuilder()
//   builder.select('items.price').from('users').where('users.items.price', '=', 1).orderBy('items.price')
//   t.is('select json_unquote(json_extract(`items`, \'."price"\')) from `users` where json_unquote(json_extract(`users`.`items`, \'."price"\')) = ? order by json_unquote(json_extract(`items`, \'."price"\')) asc', builder.toSql())

//   const builder = getMySqlBuilder()
//   builder.select('*').from('users').where('items.price.in_usd', '=', 1)
//   t.is('select * from `users` where json_unquote(json_extract(`items`, \'."price"."in_usd"\')) = ?', builder.toSql())

//   const builder = getMySqlBuilder()
//   builder.select('*').from('users').where('items.price.in_usd', '=', 1).where('items.age', '=', 2)
//   t.is('select * from `users` where json_unquote(json_extract(`items`, \'."price"."in_usd"\')) = ? and json_unquote(json_extract(`items`, \'."age"\')) = ?', builder.toSql())
// })

// test('testPostgresWrappingJson', async (t) => {
//   const builder = getPostgresBuilder()
//   builder.select('items.price').from('users').where('users.items.price', '=', 1).orderBy('items.price')
//   t.is('select "items".>\'price\' from "users" where "users"."items".>\'price\' = ? order by "items".>\'price\' asc', builder.toSql())

//   const builder = getPostgresBuilder()
//   builder.select('*').from('users').where('items.price.in_usd', '=', 1)
//   t.is('select * from "users" where "items".\'price\'.>\'in_usd\' = ?', builder.toSql())

//   const builder = getPostgresBuilder()
//   builder.select('*').from('users').where('items.price.in_usd', '=', 1).where('items.age', '=', 2)
//   t.is('select * from "users" where "items".\'price\'.>\'in_usd\' = ? and "items".>\'age\' = ?', builder.toSql())

//   const builder = getPostgresBuilder()
//   builder.select('*').from('users').where('items.prices.0', '=', 1).where('items.age', '=', 2)
//   t.is('select * from "users" where "items".\'prices\'.>0 = ? and "items".>\'age\' = ?', builder.toSql())

//   const builder = getPostgresBuilder()
//   builder.select('*').from('users').where('items.available', '=', true)
//   t.is('select * from "users" where ("items".\'available\').jsonb = \'true\'.jsonb', builder.toSql())
// })

// test('testSqlServerWrappingJson', async (t) => {
//   const builder = getSqlServerBuilder()
//   builder.select('items.price').from('users').where('users.items.price', '=', 1).orderBy('items.price')
//   t.is('select json_value([items], \'."price"\') from [users] where json_value([users].[items], \'."price"\') = ? order by json_value([items], \'."price"\') asc', builder.toSql())

//   const builder = getSqlServerBuilder()
//   builder.select('*').from('users').where('items.price.in_usd', '=', 1)
//   t.is('select * from [users] where json_value([items], \'."price"."in_usd"\') = ?', builder.toSql())

//   const builder = getSqlServerBuilder()
//   builder.select('*').from('users').where('items.price.in_usd', '=', 1).where('items.age', '=', 2)
//   t.is('select * from [users] where json_value([items], \'."price"."in_usd"\') = ? and json_value([items], \'."age"\') = ?', builder.toSql())

//   const builder = getSqlServerBuilder()
//   builder.select('*').from('users').where('items.available', '=', true)
//   t.is('select * from [users] where json_value([items], \'."available"\') = \'true\'', builder.toSql())
// })

// test('testSqliteWrappingJson', async (t) => {
//   const builder = getSQLiteBuilder()
//   builder.select('items.price').from('users').where('users.items.price', '=', 1).orderBy('items.price')
//   t.is('select json_extract("items", \'."price"\') from "users" where json_extract("users"."items", \'."price"\') = ? order by json_extract("items", \'."price"\') asc', builder.toSql())

//   const builder = getSQLiteBuilder()
//   builder.select('*').from('users').where('items.price.in_usd', '=', 1)
//   t.is('select * from "users" where json_extract("items", \'."price"."in_usd"\') = ?', builder.toSql())

//   const builder = getSQLiteBuilder()
//   builder.select('*').from('users').where('items.price.in_usd', '=', 1).where('items.age', '=', 2)
//   t.is('select * from "users" where json_extract("items", \'."price"."in_usd"\') = ? and json_extract("items", \'."age"\') = ?', builder.toSql())

//   const builder = getSQLiteBuilder()
//   builder.select('*').from('users').where('items.available', '=', true)
//   t.is('select * from "users" where json_extract("items", \'."available"\') = true', builder.toSql())
// })

// test('testSQLiteOrderBy', async (t) => {
//   const builder = getSQLiteBuilder()
//   builder.select('*').from('users').orderBy('email', 'desc')
//   t.is('select * from "users" order by "email" desc', builder.toSql())
// })

// test('testSqlServerLimitsAndOffsets', async (t) => {
//   const builder = getSqlServerBuilder()
//   builder.select('*').from('users').take(10)
//   t.is('select top 10 * from [users]', builder.toSql())

//   const builder = getSqlServerBuilder()
//   builder.select('*').from('users').skip(10).orderBy('email', 'desc')
//   t.is('select * from [users] order by [email] desc offset 10 rows', builder.toSql())

//   const builder = getSqlServerBuilder()
//   builder.select('*').from('users').skip(10).take(10)
//   t.is('select * from [users] order by (SELECT 0) offset 10 rows fetch next 10 rows only', builder.toSql())

//   const builder = getSqlServerBuilder()
//   builder.select('*').from('users').skip(11).take(10).orderBy('email', 'desc')
//   t.is('select * from [users] order by [email] desc offset 11 rows fetch next 10 rows only', builder.toSql())

//   const builder = getSqlServerBuilder()
//   subQuery = function (query) {
//     return query.select('created_at').from('logins').where('users.name', 'nameBinding').whereColumn('user_id', 'users.id').limit(1)
//   }
//   builder.select('*').from('users').where('email', 'emailBinding').orderBy(subQuery).skip(10).take(10)
//   t.is('select * from [users] where [email] = ? order by (select top 1 [created_at] from [logins] where [users].[name] = ? and [user_id] = [users].[id]) asc offset 10 rows fetch next 10 rows only', builder.toSql())
//   t.deepEqual(['emailBinding', 'nameBinding'], builder.getBindings())

//   const builder = getSqlServerBuilder()
//   builder.select('*').from('users').take('foo')
//   t.is('select * from [users]', builder.toSql())

//   const builder = getSqlServerBuilder()
//   builder.select('*').from('users').take('foo').offset('bar')
//   t.is('select * from [users]', builder.toSql())

//   const builder = getSqlServerBuilder()
//   builder.select('*').from('users').offset('bar')
//   t.is('select * from [users]', builder.toSql())
// })

// test('testMySqlSoundsLikeOperator', async (t) => {
//   const builder = getMySqlBuilder()
//   builder.select('*').from('users').where('name', 'sounds like', 'John Doe')
//   t.is('select * from `users` where `name` sounds like ?', builder.toSql())
//   t.deepEqual(['John Doe'], builder.getBindings())
// })

// test('testBitwiseOperators', async (t) => {
//   const builder = getBuilder()
//   builder.select('*').from('users').where('bar', '&', 1)
//   t.is('select * from "users" where "bar" & ?', builder.toSql())

//   const builder = getPostgresBuilder()
//   builder.select('*').from('users').where('bar', '#', 1)
//   t.is('select * from "users" where ("bar" # ?).bool', builder.toSql())

//   const builder = getPostgresBuilder()
//   builder.select('*').from('users').where('range', '>>', '[2022-01-08 00:00:00,2022-01-09 00:00:00)')
//   t.is('select * from "users" where ("range" >> ?).bool', builder.toSql())

//   const builder = getSqlServerBuilder()
//   builder.select('*').from('users').where('bar', '&', 1)
//   t.is('select * from [users] where ([bar] & ?) != 0', builder.toSql())

//   const builder = getBuilder()
//   builder.select('*').from('users').having('bar', '&', 1)
//   t.is('select * from "users" having "bar" & ?', builder.toSql())

//   const builder = getPostgresBuilder()
//   builder.select('*').from('users').having('bar', '#', 1)
//   t.is('select * from "users" having ("bar" # ?).bool', builder.toSql())

//   const builder = getPostgresBuilder()
//   builder.select('*').from('users').having('range', '>>', '[2022-01-08 00:00:00,2022-01-09 00:00:00)')
//   t.is('select * from "users" having ("range" >> ?).bool', builder.toSql())

//   const builder = getSqlServerBuilder()
//   builder.select('*').from('users').having('bar', '&', 1)
//   t.is('select * from [users] having ([bar] & ?) != 0', builder.toSql())
// })

// test('testMergeWheresCanMergeWheresAndBindings', async (t) => {
//   const builder = getBuilder()
//   builder.wheres = ['foo']
//   builder.mergeWheres(['wheres'], [12 => 'foo', 13 => 'bar'])
//   t.deepEqual(['foo', 'wheres'], builder.wheres)
//   t.deepEqual(['foo', 'bar'], builder.getBindings())
// })

// test('testPrepareValueAndOperator', async (t) => {
//   const builder = getBuilder()
//   [value, operator] = builder.prepareValueAndOperator('>', '20')
//   t.is('>', value)
//   t.is('20', operator)

//   const builder = getBuilder()
//   [value, operator] = builder.prepareValueAndOperator('>', '20', true)
//   t.is('20', value)
//   t.is('=', operator)
// })

// test('testPrepareValueAndOperatorExpectException', async (t) => {
//   expectException(InvalidArgumentException.class)
//   expectExceptionMessage('Illegal operator and value combination.')

//   const builder = getBuilder()
//   builder.prepareValueAndOperator(null, 'like')
// })

// test('testProvidingNullWithOperatorsBuildsCorrectly', async (t) => {
//   const builder = getBuilder()
//   builder.select('*').from('users').where('foo', null)
//   t.is('select * from "users" where "foo" is null', builder.toSql())

//   const builder = getBuilder()
//   builder.select('*').from('users').where('foo', '=', null)
//   t.is('select * from "users" where "foo" is null', builder.toSql())

//   const builder = getBuilder()
//   builder.select('*').from('users').where('foo', '!=', null)
//   t.is('select * from "users" where "foo" is not null', builder.toSql())

//   const builder = getBuilder()
//   builder.select('*').from('users').where('foo', '<>', null)
//   t.is('select * from "users" where "foo" is not null', builder.toSql())
// })

// test('testDynamicWhere', async (t) => {
//   method = 'whereFooBarAndBazOrQux'
//   parameters = ['corge', 'waldo', 'fred']
//   const builder = m.mock(Builder.class).makePartial()

//   builder.shouldReceive('where').with('foo_bar', '=', parameters[0], 'and').once().andReturnSelf()
//   builder.shouldReceive('where').with('baz', '=', parameters[1], 'and').once().andReturnSelf()
//   builder.shouldReceive('where').with('qux', '=', parameters[2], 'or').once().andReturnSelf()

//   t.deepEqual(builder, builder.dynamicWhere(method, parameters))
// })

// test('testDynamicWhereIsNotGreedy', async (t) => {
//   method = 'whereIosVersionAndAndroidVersionOrOrientation'
//   parameters = ['6.1', '4.2', 'Vertical']
//   const builder = m.mock(Builder.class).makePartial()

//   builder.shouldReceive('where').with('ios_version', '=', '6.1', 'and').once().andReturnSelf()
//   builder.shouldReceive('where').with('android_version', '=', '4.2', 'and').once().andReturnSelf()
//   builder.shouldReceive('where').with('orientation', '=', 'Vertical', 'or').once().andReturnSelf()

//   builder.dynamicWhere(method, parameters)
// })

// test('testCallTriggersDynamicWhere', async (t) => {
//   const builder = getBuilder()

//   t.deepEqual(builder, builder.whereFooAndBar('baz', 'qux'))
//   assertCount(2, builder.wheres)
// })

// test('testBuilderThrowsExpectedExceptionWithUndefinedMethod', async (t) => {
//   expectException(BadMethodCallException.class)

//   const builder = getBuilder()
//   builder.getConnection().shouldReceive('select')
//   builder.getProcessor().shouldReceive('processSelect').andReturn([])

//   builder.noValidMethodHere()
// })

// test('testMySqlLock', async (t) => {
//   const builder = getMySqlBuilder()
//   builder.select('*').from('foo').where('bar', '=', 'baz').lock()
//   t.is('select * from `foo` where `bar` = ? for update', builder.toSql())
//   t.deepEqual(['baz'], builder.getBindings())

//   const builder = getMySqlBuilder()
//   builder.select('*').from('foo').where('bar', '=', 'baz').lock(false)
//   t.is('select * from `foo` where `bar` = ? lock in share mode', builder.toSql())
//   t.deepEqual(['baz'], builder.getBindings())

//   const builder = getMySqlBuilder()
//   builder.select('*').from('foo').where('bar', '=', 'baz').lock('lock in share mode')
//   t.is('select * from `foo` where `bar` = ? lock in share mode', builder.toSql())
//   t.deepEqual(['baz'], builder.getBindings())
// })

// test('testPostgresLock', async (t) => {
//   const builder = getPostgresBuilder()
//   builder.select('*').from('foo').where('bar', '=', 'baz').lock()
//   t.is('select * from "foo" where "bar" = ? for update', builder.toSql())
//   t.deepEqual(['baz'], builder.getBindings())

//   const builder = getPostgresBuilder()
//   builder.select('*').from('foo').where('bar', '=', 'baz').lock(false)
//   t.is('select * from "foo" where "bar" = ? for share', builder.toSql())
//   t.deepEqual(['baz'], builder.getBindings())

//   const builder = getPostgresBuilder()
//   builder.select('*').from('foo').where('bar', '=', 'baz').lock('for key share')
//   t.is('select * from "foo" where "bar" = ? for key share', builder.toSql())
//   t.deepEqual(['baz'], builder.getBindings())
// })

// test('testSqlServerLock', async (t) => {
//   const builder = getSqlServerBuilder()
//   builder.select('*').from('foo').where('bar', '=', 'baz').lock()
//   t.is('select * from [foo] with(rowlock,updlock,holdlock) where [bar] = ?', builder.toSql())
//   t.deepEqual(['baz'], builder.getBindings())

//   const builder = getSqlServerBuilder()
//   builder.select('*').from('foo').where('bar', '=', 'baz').lock(false)
//   t.is('select * from [foo] with(rowlock,holdlock) where [bar] = ?', builder.toSql())
//   t.deepEqual(['baz'], builder.getBindings())

//   const builder = getSqlServerBuilder()
//   builder.select('*').from('foo').where('bar', '=', 'baz').lock('with(holdlock)')
//   t.is('select * from [foo] with(holdlock) where [bar] = ?', builder.toSql())
//   t.deepEqual(['baz'], builder.getBindings())
// })

// test('testSelectWithLockUsesWritePdo', async (t) => {
//   const builder = getMySqlBuilderWithProcessor()
//   builder.getConnection().shouldReceive('select').once()
//     .with(m.any(), m.any(), false)
//   builder.select('*').from('foo').where('bar', '=', 'baz').lock().get()

//   const builder = getMySqlBuilderWithProcessor()
//   builder.getConnection().shouldReceive('select').once()
//     .with(m.any(), m.any(), false)
//   builder.select('*').from('foo').where('bar', '=', 'baz').lock(false).get()
// })

// test('testBindingOrder', async (t) => {
//   expectedSql = 'select * from "users" inner join "othertable" on "bar" = ? where "registered" = ? group by "city" having "population" > ? order by match ("foo") against(?)'
//   expectedBindings = ['foo', 1, 3, 'bar']

//   const builder = getBuilder()
//   builder.select('*').from('users').join('othertable', function (join) {
//     join.where('bar', '=', 'foo')
//   }).where('registered', 1).groupBy('city').having('population', '>', 3).orderByRaw('match ("foo") against(?)', ['bar'])
//   t.deepEqual(expectedSql, builder.toSql())
//   t.deepEqual(expectedBindings, builder.getBindings())

//   // order of statements reversed
//   const builder = getBuilder()
//   builder.select('*').from('users').orderByRaw('match ("foo") against(?)', ['bar']).having('population', '>', 3).groupBy('city').where('registered', 1).join('othertable', function (join) {
//     join.where('bar', '=', 'foo')
//   })
//   t.deepEqual(expectedSql, builder.toSql())
//   t.deepEqual(expectedBindings, builder.getBindings())
// })

// test('testAddBindingWithArrayMergesBindings', async (t) => {
//   const builder = getBuilder()
//   builder.addBinding(['foo', 'bar'])
//   builder.addBinding(['baz'])
//   t.deepEqual(['foo', 'bar', 'baz'], builder.getBindings())
// })

// test('testAddBindingWithArrayMergesBindingsInCorrectOrder', async (t) => {
//   const builder = getBuilder()
//   builder.addBinding(['bar', 'baz'], 'having')
//   builder.addBinding(['foo'], 'where')
//   t.deepEqual(['foo', 'bar', 'baz'], builder.getBindings())
// })

// test('testMergeBuilders', async (t) => {
//   const builder = getBuilder()
//   builder.addBinding(['foo', 'bar'])
//   const otherBuilder = getBuilder()
//   otherBuilder.addBinding(['baz'])
//   builder.mergeBindings(otherBuilder)
//   t.deepEqual(['foo', 'bar', 'baz'], builder.getBindings())
// })

// test('testMergeBuildersBindingOrder', async (t) => {
//   const builder = getBuilder()
//   builder.addBinding('foo', 'where')
//   builder.addBinding('baz', 'having')
//   const otherBuilder = getBuilder()
//   otherBuilder.addBinding('bar', 'where')
//   builder.mergeBindings(otherBuilder)
//   t.deepEqual(['foo', 'bar', 'baz'], builder.getBindings())
// })

// test('testSubSelect', async (t) => {
//   expectedSql = 'select "foo", "bar", (select "baz" from "two" where "subkey" = ?) as "sub" from "one" where "key" = ?'
//   expectedBindings = ['subval', 'val']

//   const builder = getPostgresBuilder()
//   builder.from('one').select(['foo', 'bar']).where('key', '=', 'val')
//   builder.selectSub(function (query) {
//     query.from('two').select('baz').where('subkey', '=', 'subval')
//   }, 'sub')
//   t.deepEqual(expectedSql, builder.toSql())
//   t.deepEqual(expectedBindings, builder.getBindings())

//   const builder = getPostgresBuilder()
//   builder.from('one').select(['foo', 'bar']).where('key', '=', 'val')
//   const subBuilder = getPostgresBuilder()
//   subBuilder.from('two').select('baz').where('subkey', '=', 'subval')
//   builder.selectSub(subBuilder, 'sub')
//   t.deepEqual(expectedSql, builder.toSql())
//   t.deepEqual(expectedBindings, builder.getBindings())

//   expectException(InvalidArgumentException.class)
//   const builder = getPostgresBuilder()
//   builder.selectSub(['foo'], 'sub')
// })

// test('testSubSelectResetBindings', async (t) => {
//   const builder = getPostgresBuilder()
//   builder.from('one').selectSub(function (query) {
//     query.from('two').select('baz').where('subkey', '=', 'subval')
//   }, 'sub')

//   t.is('select (select "baz" from "two" where "subkey" = ?) as "sub" from "one"', builder.toSql())
//   t.deepEqual(['subval'], builder.getBindings())

//   builder.select('*')

//   t.is('select * from "one"', builder.toSql())
//   t.deepEqual([], builder.getBindings())
// })

// test('testSqlServerWhereDate', async (t) => {
//   const builder = getSqlServerBuilder()
//   builder.select('*').from('users').whereDate('created_at', '=', '2015-09-23')
//   t.is('select * from [users] where cast([created_at] as date) = ?', builder.toSql())
//   t.deepEqual([0 => '2015-09-23'], builder.getBindings())
// })

// test('testUppercaseLeadingBooleansAreRemoved', async (t) => {
//   const builder = getBuilder()
//   builder.select('*').from('users').where('name', '=', 'Taylor', 'AND')
//   t.is('select * from "users" where "name" = ?', builder.toSql())
// })

// test('testLowercaseLeadingBooleansAreRemoved', async (t) => {
//   const builder = getBuilder()
//   builder.select('*').from('users').where('name', '=', 'Taylor', 'and')
//   t.is('select * from "users" where "name" = ?', builder.toSql())
// })

// test('testCaseInsensitiveLeadingBooleansAreRemoved', async (t) => {
//   const builder = getBuilder()
//   builder.select('*').from('users').where('name', '=', 'Taylor', 'And')
//   t.is('select * from "users" where "name" = ?', builder.toSql())
// })

// test('testTableValuedFunctionAsTableInSqlServer', async (t) => {
//   const builder = getSqlServerBuilder()
//   builder.select('*').from('users()')
//   t.is('select * from [users]()', builder.toSql())

//   const builder = getSqlServerBuilder()
//   builder.select('*').from('users(1,2)')
//   t.is('select * from [users](1,2)', builder.toSql())
// })

// test('testChunkWithLastChunkComplete', async (t) => {
//   const builder = getMockQueryBuilder()
//   builder.orders[] = ['column' => 'foobar', 'direction' => 'asc']

//   chunk1 = collect(['foo1', 'foo2'])
//   chunk2 = collect(['foo3', 'foo4'])
//   chunk3 = collect([])
//   builder.shouldReceive('forPage').once().with(1, 2).andReturnSelf()
//   builder.shouldReceive('forPage').once().with(2, 2).andReturnSelf()
//   builder.shouldReceive('forPage').once().with(3, 2).andReturnSelf()
//   builder.shouldReceive('get').times(3).andReturn(chunk1, chunk2, chunk3)

//   callbackAssertor = m.mock(stdClass.class)
//   callbackAssertor.shouldReceive('doSomething').once().with(chunk1)
//   callbackAssertor.shouldReceive('doSomething').once().with(chunk2)
//   callbackAssertor.shouldReceive('doSomething').never().with(chunk3)

//   builder.chunk(2, function (results) use(callbackAssertor) {
//     callbackAssertor.doSomething(results)
//   })
// })

// test('testChunkWithLastChunkPartial', async (t) => {
//   const builder = getMockQueryBuilder()
//   builder.orders[] = ['column' => 'foobar', 'direction' => 'asc']

//   chunk1 = collect(['foo1', 'foo2'])
//   chunk2 = collect(['foo3'])
//   builder.shouldReceive('forPage').once().with(1, 2).andReturnSelf()
//   builder.shouldReceive('forPage').once().with(2, 2).andReturnSelf()
//   builder.shouldReceive('get').times(2).andReturn(chunk1, chunk2)

//   callbackAssertor = m.mock(stdClass.class)
//   callbackAssertor.shouldReceive('doSomething').once().with(chunk1)
//   callbackAssertor.shouldReceive('doSomething').once().with(chunk2)

//   builder.chunk(2, function (results) use(callbackAssertor) {
//     callbackAssertor.doSomething(results)
//   })
// })

// test('testChunkCanBeStoppedByReturningFalse', async (t) => {
//   const builder = getMockQueryBuilder()
//   builder.orders[] = ['column' => 'foobar', 'direction' => 'asc']

//   chunk1 = collect(['foo1', 'foo2'])
//   chunk2 = collect(['foo3'])
//   builder.shouldReceive('forPage').once().with(1, 2).andReturnSelf()
//   builder.shouldReceive('forPage').never().with(2, 2)
//   builder.shouldReceive('get').times(1).andReturn(chunk1)

//   callbackAssertor = m.mock(stdClass.class)
//   callbackAssertor.shouldReceive('doSomething').once().with(chunk1)
//   callbackAssertor.shouldReceive('doSomething').never().with(chunk2)

//   builder.chunk(2, function (results) use(callbackAssertor) {
//     callbackAssertor.doSomething(results)

//             return false
//   })
// })

// test('testChunkWithCountZero', async (t) => {
//   const builder = getMockQueryBuilder()
//   builder.orders[] = ['column' => 'foobar', 'direction' => 'asc']

//   chunk = collect([])
//   builder.shouldReceive('forPage').once().with(1, 0).andReturnSelf()
//   builder.shouldReceive('get').times(1).andReturn(chunk)

//   callbackAssertor = m.mock(stdClass.class)
//   callbackAssertor.shouldReceive('doSomething').never()

//   builder.chunk(0, function (results) use(callbackAssertor) {
//     callbackAssertor.doSomething(results)
//   })
// })

// test('testChunkByIdOnArrays', async (t) => {
//   const builder = getMockQueryBuilder()
//   builder.orders[] = ['column' => 'foobar', 'direction' => 'asc']

//   chunk1 = collect([['someIdField' => 1], ['someIdField' => 2]])
//   chunk2 = collect([['someIdField' => 10], ['someIdField' => 11]])
//   chunk3 = collect([])
//   builder.shouldReceive('forPageAfterId').once().with(2, 0, 'someIdField').andReturnSelf()
//   builder.shouldReceive('forPageAfterId').once().with(2, 2, 'someIdField').andReturnSelf()
//   builder.shouldReceive('forPageAfterId').once().with(2, 11, 'someIdField').andReturnSelf()
//   builder.shouldReceive('get').times(3).andReturn(chunk1, chunk2, chunk3)

//   callbackAssertor = m.mock(stdClass.class)
//   callbackAssertor.shouldReceive('doSomething').once().with(chunk1)
//   callbackAssertor.shouldReceive('doSomething').once().with(chunk2)
//   callbackAssertor.shouldReceive('doSomething').never().with(chunk3)

//   builder.chunkById(2, function (results) use(callbackAssertor) {
//     callbackAssertor.doSomething(results)
//   }, 'someIdField')
// })

// test('testChunkPaginatesUsingIdWithLastChunkComplete', async (t) => {
//   const builder = getMockQueryBuilder()
//   builder.orders[] = ['column' => 'foobar', 'direction' => 'asc']

//   chunk1 = collect([(object)['someIdField' => 1], (object)['someIdField' => 2]])
//   chunk2 = collect([(object)['someIdField' => 10], (object)['someIdField' => 11]])
//   chunk3 = collect([])
//   builder.shouldReceive('forPageAfterId').once().with(2, 0, 'someIdField').andReturnSelf()
//   builder.shouldReceive('forPageAfterId').once().with(2, 2, 'someIdField').andReturnSelf()
//   builder.shouldReceive('forPageAfterId').once().with(2, 11, 'someIdField').andReturnSelf()
//   builder.shouldReceive('get').times(3).andReturn(chunk1, chunk2, chunk3)

//   callbackAssertor = m.mock(stdClass.class)
//   callbackAssertor.shouldReceive('doSomething').once().with(chunk1)
//   callbackAssertor.shouldReceive('doSomething').once().with(chunk2)
//   callbackAssertor.shouldReceive('doSomething').never().with(chunk3)

//   builder.chunkById(2, function (results) use(callbackAssertor) {
//     callbackAssertor.doSomething(results)
//   }, 'someIdField')
// })

// test('testChunkPaginatesUsingIdWithLastChunkPartial', async (t) => {
//   const builder = getMockQueryBuilder()
//   builder.orders[] = ['column' => 'foobar', 'direction' => 'asc']

//   chunk1 = collect([(object)['someIdField' => 1], (object)['someIdField' => 2]])
//   chunk2 = collect([(object)['someIdField' => 10]])
//   builder.shouldReceive('forPageAfterId').once().with(2, 0, 'someIdField').andReturnSelf()
//   builder.shouldReceive('forPageAfterId').once().with(2, 2, 'someIdField').andReturnSelf()
//   builder.shouldReceive('get').times(2).andReturn(chunk1, chunk2)

//   callbackAssertor = m.mock(stdClass.class)
//   callbackAssertor.shouldReceive('doSomething').once().with(chunk1)
//   callbackAssertor.shouldReceive('doSomething').once().with(chunk2)

//   builder.chunkById(2, function (results) use(callbackAssertor) {
//     callbackAssertor.doSomething(results)
//   }, 'someIdField')
// })

// test('testChunkPaginatesUsingIdWithCountZero', async (t) => {
//   const builder = getMockQueryBuilder()
//   builder.orders[] = ['column' => 'foobar', 'direction' => 'asc']

//   chunk = collect([])
//   builder.shouldReceive('forPageAfterId').once().with(0, 0, 'someIdField').andReturnSelf()
//   builder.shouldReceive('get').times(1).andReturn(chunk)

//   callbackAssertor = m.mock(stdClass.class)
//   callbackAssertor.shouldReceive('doSomething').never()

//   builder.chunkById(0, function (results) use(callbackAssertor) {
//     callbackAssertor.doSomething(results)
//   }, 'someIdField')
// })

// test('testChunkPaginatesUsingIdWithAlias', async (t) => {
//   const builder = getMockQueryBuilder()
//   builder.orders[] = ['column' => 'foobar', 'direction' => 'asc']

//   chunk1 = collect([(object)['table_id' => 1], (object)['table_id' => 10]])
//   chunk2 = collect([])
//   builder.shouldReceive('forPageAfterId').once().with(2, 0, 'table.id').andReturnSelf()
//   builder.shouldReceive('forPageAfterId').once().with(2, 10, 'table.id').andReturnSelf()
//   builder.shouldReceive('get').times(2).andReturn(chunk1, chunk2)

//   callbackAssertor = m.mock(stdClass.class)
//   callbackAssertor.shouldReceive('doSomething').once().with(chunk1)
//   callbackAssertor.shouldReceive('doSomething').never().with(chunk2)

//   builder.chunkById(2, function (results) use(callbackAssertor) {
//     callbackAssertor.doSomething(results)
//   }, 'table.id', 'table_id')
// })

// test('testChunkPaginatesUsingIdDesc', async (t) => {
//   const builder = getMockQueryBuilder()
//   builder.orders[] = ['column' => 'foobar', 'direction' => 'desc']

//   chunk1 = collect([(object)['someIdField' => 10], (object)['someIdField' => 1]])
//   chunk2 = collect([])
//   builder.shouldReceive('forPageBeforeId').once().with(2, 0, 'someIdField').andReturnSelf()
//   builder.shouldReceive('forPageBeforeId').once().with(2, 1, 'someIdField').andReturnSelf()
//   builder.shouldReceive('get').times(2).andReturn(chunk1, chunk2)

//   callbackAssertor = m.mock(stdClass.class)
//   callbackAssertor.shouldReceive('doSomething').once().with(chunk1)
//   callbackAssertor.shouldReceive('doSomething').never().with(chunk2)

//   builder.chunkByIdDesc(2, function (results) use(callbackAssertor) {
//     callbackAssertor.doSomething(results)
//   }, 'someIdField')
// })

// test('testPaginate', async (t) => {
//   perPage = 16
//   columns = ['test']
//   pageName = 'page-name'
//   page = 1
//   const builder = getMockQueryBuilder()
//   path = 'http://foo.bar?page=3'

//   results = collect([['test' => 'foo'], ['test' => 'bar']])

//   builder.shouldReceive('getCountForPagination').once().andReturn(2)
//   builder.shouldReceive('forPage').once().with(page, perPage).andReturnSelf()
//   builder.shouldReceive('get').once().andReturn(results)

//   Paginator.currentPathResolver(function () use(path) {
//     return path
//   })

//   result = builder.paginate(perPage, columns, pageName, page)

//   t.deepEqual(new LengthAwarePaginator(results, 2, perPage, page, [
//     'path' => path,
//     'pageName' => pageName,
//   ]), result)
// })

// test('testPaginateWithDefaultArguments', async (t) => {
//   perPage = 15
//   pageName = 'page'
//   page = 1
//   const builder = getMockQueryBuilder()
//   path = 'http://foo.bar?page=3'

//   results = collect([['test' => 'foo'], ['test' => 'bar']])

//   builder.shouldReceive('getCountForPagination').once().andReturn(2)
//   builder.shouldReceive('forPage').once().with(page, perPage).andReturnSelf()
//   builder.shouldReceive('get').once().andReturn(results)

//   Paginator.currentPageResolver(function () {
//     return 1
//   })

//   Paginator.currentPathResolver(function () use(path) {
//     return path
//   })

//   result = builder.paginate()

//   t.deepEqual(new LengthAwarePaginator(results, 2, perPage, page, [
//     'path' => path,
//     'pageName' => pageName,
//   ]), result)
// })

// test('testPaginateWhenNoResults', async (t) => {
//   perPage = 15
//   pageName = 'page'
//   page = 1
//   const builder = getMockQueryBuilder()
//   path = 'http://foo.bar?page=3'

//   results = []

//   builder.shouldReceive('getCountForPagination').once().andReturn(0)
//   builder.shouldNotReceive('forPage')
//   builder.shouldNotReceive('get')

//   Paginator.currentPageResolver(function () {
//     return 1
//   })

//   Paginator.currentPathResolver(function () use(path) {
//     return path
//   })

//   result = builder.paginate()

//   t.deepEqual(new LengthAwarePaginator(results, 0, perPage, page, [
//     'path' => path,
//     'pageName' => pageName,
//   ]), result)
// })

// test('testPaginateWithSpecificColumns', async (t) => {
//   perPage = 16
//   columns = ['id', 'name']
//   pageName = 'page-name'
//   page = 1
//   const builder = getMockQueryBuilder()
//   path = 'http://foo.bar?page=3'

//   results = collect([['id' => 3, 'name' => 'Taylor'], ['id' => 5, 'name' => 'Mohamed']])

//   builder.shouldReceive('getCountForPagination').once().andReturn(2)
//   builder.shouldReceive('forPage').once().with(page, perPage).andReturnSelf()
//   builder.shouldReceive('get').once().andReturn(results)

//   Paginator.currentPathResolver(function () use(path) {
//     return path
//   })

//   result = builder.paginate(perPage, columns, pageName, page)

//   t.deepEqual(new LengthAwarePaginator(results, 2, perPage, page, [
//     'path' => path,
//     'pageName' => pageName,
//   ]), result)
// })

// test('testPaginateWithTotalOverride', async (t) => {
//   perPage = 16
//   columns = ['id', 'name']
//   pageName = 'page-name'
//   page = 1
//   const builder = getMockQueryBuilder()
//   path = 'http://foo.bar?page=3'

//   results = collect([['id' => 3, 'name' => 'Taylor'], ['id' => 5, 'name' => 'Mohamed']])

//   builder.shouldReceive('getCountForPagination').never()
//   builder.shouldReceive('forPage').once().with(page, perPage).andReturnSelf()
//   builder.shouldReceive('get').once().andReturn(results)

//   Paginator.currentPathResolver(function () use(path) {
//     return path
//   })

//   result = builder.paginate(perPage, columns, pageName, page, 10)

//   t.deepEqual(10, result.total())
// })

// test('testCursorPaginate', async (t) => {
//   perPage = 16
//   columns = ['test']
//   cursorName = 'cursor-name'
//   cursor = new Cursor(['test' => 'bar'])
//   const builder = getMockQueryBuilder()
//   builder.from('foobar').orderBy('test')
//   builder.shouldReceive('newQuery').andReturnUsing(function () use(builder) {
//     return new Builder(builder.connection, builder.grammar, builder.processor)
//   })

//   path = 'http://foo.bar?cursor='.cursor.encode()

//   results = collect([['test' => 'foo'], ['test' => 'bar']])

//   builder.shouldReceive('get').once().andReturnUsing(function () use(builder, results) {
//     t.deepEqual(
//       'select * from "foobar" where ("test" > ?) order by "test" asc limit 17',
//       builder.toSql())
//             t.deepEqual(['bar'], builder.bindings['where'])

//             return results
//   })

//   Paginator.currentPathResolver(function () use(path) {
//     return path
//   })

//   result = builder.cursorPaginate(perPage, columns, cursorName, cursor)

//   t.deepEqual(new CursorPaginator(results, perPage, cursor, [
//     'path' => path,
//     'cursorName' => cursorName,
//     'parameters' => ['test'],
//   ]), result)
// })

// test('testCursorPaginateMultipleOrderColumns', async (t) => {
//   perPage = 16
//   columns = ['test', 'another']
//   cursorName = 'cursor-name'
//   cursor = new Cursor(['test' => 'bar', 'another' => 'foo'])
//   const builder = getMockQueryBuilder()
//   builder.from('foobar').orderBy('test').orderBy('another')
//   builder.shouldReceive('newQuery').andReturnUsing(function () use(builder) {
//     return new Builder(builder.connection, builder.grammar, builder.processor)
//   })

//   path = 'http://foo.bar?cursor='.cursor.encode()

//   results = collect([['test' => 'foo', 'another' => 1], ['test' => 'bar', 'another' => 2]])

//   builder.shouldReceive('get').once().andReturnUsing(function () use(builder, results) {
//     t.deepEqual(
//       'select * from "foobar" where ("test" > ? or ("test" = ? and ("another" > ?))) order by "test" asc, "another" asc limit 17',
//       builder.toSql()
//     )
//             t.deepEqual(['bar', 'bar', 'foo'], builder.bindings['where'])

//             return results
//   })

//   Paginator.currentPathResolver(function () use(path) {
//     return path
//   })

//   result = builder.cursorPaginate(perPage, columns, cursorName, cursor)

//   t.deepEqual(new CursorPaginator(results, perPage, cursor, [
//     'path' => path,
//     'cursorName' => cursorName,
//     'parameters' => ['test', 'another'],
//   ]), result)
// })

// test('testCursorPaginateWithDefaultArguments', async (t) => {
//   perPage = 15
//   cursorName = 'cursor'
//   cursor = new Cursor(['test' => 'bar'])
//   const builder = getMockQueryBuilder()
//   builder.from('foobar').orderBy('test')
//   builder.shouldReceive('newQuery').andReturnUsing(function () use(builder) {
//     return new Builder(builder.connection, builder.grammar, builder.processor)
//   })

//   path = 'http://foo.bar?cursor='.cursor.encode()

//   results = collect([['test' => 'foo'], ['test' => 'bar']])

//   builder.shouldReceive('get').once().andReturnUsing(function () use(builder, results) {
//     t.deepEqual(
//       'select * from "foobar" where ("test" > ?) order by "test" asc limit 16',
//       builder.toSql())
//             t.deepEqual(['bar'], builder.bindings['where'])

//             return results
//   })

//   CursorPaginator.currentCursorResolver(function () use(cursor) {
//     return cursor
//   })

//   Paginator.currentPathResolver(function () use(path) {
//     return path
//   })

//   result = builder.cursorPaginate()

//   t.deepEqual(new CursorPaginator(results, perPage, cursor, [
//     'path' => path,
//     'cursorName' => cursorName,
//     'parameters' => ['test'],
//   ]), result)
// })

// test('testCursorPaginateWhenNoResults', async (t) => {
//   perPage = 15
//   cursorName = 'cursor'
//   const builder = getMockQueryBuilder().orderBy('test')
//   path = 'http://foo.bar?cursor=3'

//   results = []

//   builder.shouldReceive('get').once().andReturn(results)

//   CursorPaginator.currentCursorResolver(function () {
//     return null
//   })

//   Paginator.currentPathResolver(function () use(path) {
//     return path
//   })

//   result = builder.cursorPaginate()

//   t.deepEqual(new CursorPaginator(results, perPage, null, [
//     'path' => path,
//     'cursorName' => cursorName,
//     'parameters' => ['test'],
//   ]), result)
// })

// test('testCursorPaginateWithSpecificColumns', async (t) => {
//   perPage = 16
//   columns = ['id', 'name']
//   cursorName = 'cursor-name'
//   cursor = new Cursor(['id' => 2])
//   const builder = getMockQueryBuilder()
//   builder.from('foobar').orderBy('id')
//   builder.shouldReceive('newQuery').andReturnUsing(function () use(builder) {
//     return new Builder(builder.connection, builder.grammar, builder.processor)
//   })

//   path = 'http://foo.bar?cursor=3'

//   results = collect([['id' => 3, 'name' => 'Taylor'], ['id' => 5, 'name' => 'Mohamed']])

//   builder.shouldReceive('get').once().andReturnUsing(function () use(builder, results) {
//     t.deepEqual(
//       'select * from "foobar" where ("id" > ?) order by "id" asc limit 17',
//       builder.toSql())
//             t.deepEqual([2], builder.bindings['where'])

//             return results
//   })

//   Paginator.currentPathResolver(function () use(path) {
//     return path
//   })

//   result = builder.cursorPaginate(perPage, columns, cursorName, cursor)

//   t.deepEqual(new CursorPaginator(results, perPage, cursor, [
//     'path' => path,
//     'cursorName' => cursorName,
//     'parameters' => ['id'],
//   ]), result)
// })

// test('testCursorPaginateWithMixedOrders', async (t) => {
//   perPage = 16
//   columns = ['foo', 'bar', 'baz']
//   cursorName = 'cursor-name'
//   cursor = new Cursor(['foo' => 1, 'bar' => 2, 'baz' => 3])
//   const builder = getMockQueryBuilder()
//   builder.from('foobar').orderBy('foo').orderByDesc('bar').orderBy('baz')
//   builder.shouldReceive('newQuery').andReturnUsing(function () use(builder) {
//     return new Builder(builder.connection, builder.grammar, builder.processor)
//   })

//   path = 'http://foo.bar?cursor='.cursor.encode()

//   results = collect([['foo' => 1, 'bar' => 2, 'baz' => 4], ['foo' => 1, 'bar' => 1, 'baz' => 1]])

//   builder.shouldReceive('get').once().andReturnUsing(function () use(builder, results) {
//     t.deepEqual(
//       'select * from "foobar" where ("foo" > ? or ("foo" = ? and ("bar" < ? or ("bar" = ? and ("baz" > ?))))) order by "foo" asc, "bar" desc, "baz" asc limit 17',
//       builder.toSql()
//     )
//             t.deepEqual([1, 1, 2, 2, 3], builder.bindings['where'])

//             return results
//   })

//   Paginator.currentPathResolver(function () use(path) {
//     return path
//   })

//   result = builder.cursorPaginate(perPage, columns, cursorName, cursor)

//   t.deepEqual(new CursorPaginator(results, perPage, cursor, [
//     'path' => path,
//     'cursorName' => cursorName,
//     'parameters' => ['foo', 'bar', 'baz'],
//   ]), result)
// })

// test('testCursorPaginateWithDynamicColumnInSelectRaw', async (t) => {
//   perPage = 15
//   cursorName = 'cursor'
//   cursor = new Cursor(['test' => 'bar'])
//   const builder = getMockQueryBuilder()
//   builder.from('foobar').select('*').selectRaw('(CONCAT(firstname, \' \', lastname)) as test').orderBy('test')
//   builder.shouldReceive('newQuery').andReturnUsing(function () use(builder) {
//     return new Builder(builder.connection, builder.grammar, builder.processor)
//   })

//   path = 'http://foo.bar?cursor='.cursor.encode()

//   results = collect([['test' => 'foo'], ['test' => 'bar']])

//   builder.shouldReceive('get').once().andReturnUsing(function () use(builder, results) {
//     t.deepEqual(
//       'select *, (CONCAT(firstname, \' \', lastname)) as test from "foobar" where ((CONCAT(firstname, \' \', lastname)) > ?) order by "test" asc limit 16',
//       builder.toSql())
//             t.deepEqual(['bar'], builder.bindings['where'])

//             return results
//   })

//   CursorPaginator.currentCursorResolver(function () use(cursor) {
//     return cursor
//   })

//   Paginator.currentPathResolver(function () use(path) {
//     return path
//   })

//   result = builder.cursorPaginate()

//   t.deepEqual(new CursorPaginator(results, perPage, cursor, [
//     'path' => path,
//     'cursorName' => cursorName,
//     'parameters' => ['test'],
//   ]), result)
// })

// test('testCursorPaginateWithDynamicColumnWithCastInSelectRaw', async (t) => {
//   perPage = 15
//   cursorName = 'cursor'
//   cursor = new Cursor(['test' => 'bar'])
//   const builder = getMockQueryBuilder()
//   builder.from('foobar').select('*').selectRaw('(CAST(CONCAT(firstname, \' \', lastname) as VARCHAR)) as test').orderBy('test')
//   builder.shouldReceive('newQuery').andReturnUsing(function () use(builder) {
//     return new Builder(builder.connection, builder.grammar, builder.processor)
//   })

//   path = 'http://foo.bar?cursor='.cursor.encode()

//   results = collect([['test' => 'foo'], ['test' => 'bar']])

//   builder.shouldReceive('get').once().andReturnUsing(function () use(builder, results) {
//     t.deepEqual(
//       'select *, (CAST(CONCAT(firstname, \' \', lastname) as VARCHAR)) as test from "foobar" where ((CAST(CONCAT(firstname, \' \', lastname) as VARCHAR)) > ?) order by "test" asc limit 16',
//       builder.toSql())
//             t.deepEqual(['bar'], builder.bindings['where'])

//             return results
//   })

//   CursorPaginator.currentCursorResolver(function () use(cursor) {
//     return cursor
//   })

//   Paginator.currentPathResolver(function () use(path) {
//     return path
//   })

//   result = builder.cursorPaginate()

//   t.deepEqual(new CursorPaginator(results, perPage, cursor, [
//     'path' => path,
//     'cursorName' => cursorName,
//     'parameters' => ['test'],
//   ]), result)
// })

// test('testCursorPaginateWithDynamicColumnInSelectSub', async (t) => {
//   perPage = 15
//   cursorName = 'cursor'
//   cursor = new Cursor(['test' => 'bar'])
//   const builder = getMockQueryBuilder()
//   builder.from('foobar').select('*').selectSub('CONCAT(firstname, \' \', lastname)', 'test').orderBy('test')
//   builder.shouldReceive('newQuery').andReturnUsing(function () use(builder) {
//     return new Builder(builder.connection, builder.grammar, builder.processor)
//   })

//   path = 'http://foo.bar?cursor='.cursor.encode()

//   results = collect([['test' => 'foo'], ['test' => 'bar']])

//   builder.shouldReceive('get').once().andReturnUsing(function () use(builder, results) {
//     t.deepEqual(
//       'select *, (CONCAT(firstname, \' \', lastname)) as "test" from "foobar" where ((CONCAT(firstname, \' \', lastname)) > ?) order by "test" asc limit 16',
//       builder.toSql())
//             t.deepEqual(['bar'], builder.bindings['where'])

//             return results
//   })

//   CursorPaginator.currentCursorResolver(function () use(cursor) {
//     return cursor
//   })

//   Paginator.currentPathResolver(function () use(path) {
//     return path
//   })

//   result = builder.cursorPaginate()

//   t.deepEqual(new CursorPaginator(results, perPage, cursor, [
//     'path' => path,
//     'cursorName' => cursorName,
//     'parameters' => ['test'],
//   ]), result)
// })

// test('testCursorPaginateWithUnionWheres', async (t) => {
//   ts = now().toDateTimeString()

//   perPage = 16
//   columns = ['test']
//   cursorName = 'cursor-name'
//   cursor = new Cursor(['created_at' => ts])
//   const builder = getMockQueryBuilder()
//   builder.select('id', 'start_time as created_at').selectRaw("'video' as type").from('videos')
//   builder.union(getBuilder().select('id', 'created_at').selectRaw("'news' as type").from('news'))
//   builder.orderBy('created_at')

//   builder.shouldReceive('newQuery').andReturnUsing(function () use(builder) {
//     return new Builder(builder.connection, builder.grammar, builder.processor)
//   })

//   path = 'http://foo.bar?cursor='.cursor.encode()

//   results = collect([
//     ['id' => 1, 'created_at' => now(), 'type' => 'video'],
//     ['id' => 2, 'created_at' => now(), 'type' => 'news'],
//   ])

//   builder.shouldReceive('get').once().andReturnUsing(function () use(builder, results, ts) {
//     t.deepEqual(
//       '(select "id", "start_time" as "created_at", \'video\' as type from "videos" where ("start_time" > ?)) union (select "id", "created_at", \'news\' as type from "news" where ("start_time" > ?)) order by "created_at" asc limit 17',
//       builder.toSql())
//             t.deepEqual([ts], builder.bindings['where'])
//             t.deepEqual([ts], builder.bindings['union'])

//             return results
//   })

//   Paginator.currentPathResolver(function () use(path) {
//     return path
//   })

//   result = builder.cursorPaginate(perPage, columns, cursorName, cursor)

//   t.deepEqual(new CursorPaginator(results, perPage, cursor, [
//     'path' => path,
//     'cursorName' => cursorName,
//     'parameters' => ['created_at'],
//   ]), result)
// })

// test('testCursorPaginateWithUnionWheresWithRawOrderExpression', async (t) => {
//   ts = now().toDateTimeString()

//   perPage = 16
//   columns = ['test']
//   cursorName = 'cursor-name'
//   cursor = new Cursor(['created_at' => ts])
//   const builder = getMockQueryBuilder()
//   builder.select('id', 'is_published', 'start_time as created_at').selectRaw("'video' as type").where('is_published', true).from('videos')
//   builder.union(getBuilder().select('id', 'is_published', 'created_at').selectRaw("'news' as type").where('is_published', true).from('news'))
//   builder.orderByRaw('case when (id = 3 and type="news" then 0 else 1 end)').orderBy('created_at')

//   builder.shouldReceive('newQuery').andReturnUsing(function () use(builder) {
//     return new Builder(builder.connection, builder.grammar, builder.processor)
//   })

//   path = 'http://foo.bar?cursor='.cursor.encode()

//   results = collect([
//     ['id' => 1, 'created_at' => now(), 'type' => 'video', 'is_published' => true],
//     ['id' => 2, 'created_at' => now(), 'type' => 'news', 'is_published' => true],
//   ])

//   builder.shouldReceive('get').once().andReturnUsing(function () use(builder, results, ts) {
//     t.deepEqual(
//       '(select "id", "is_published", "start_time" as "created_at", \'video\' as type from "videos" where "is_published" = ? and ("start_time" > ?)) union (select "id", "is_published", "created_at", \'news\' as type from "news" where "is_published" = ? and ("start_time" > ?)) order by case when (id = 3 and type="news" then 0 else 1 end), "created_at" asc limit 17',
//       builder.toSql())
//             t.deepEqual([true, ts], builder.bindings['where'])
//             t.deepEqual([true, ts], builder.bindings['union'])

//             return results
//   })

//   Paginator.currentPathResolver(function () use(path) {
//     return path
//   })

//   result = builder.cursorPaginate(perPage, columns, cursorName, cursor)

//   t.deepEqual(new CursorPaginator(results, perPage, cursor, [
//     'path' => path,
//     'cursorName' => cursorName,
//     'parameters' => ['created_at'],
//   ]), result)
// })

// test('testCursorPaginateWithUnionWheresReverseOrder', async (t) => {
//   ts = now().toDateTimeString()

//   perPage = 16
//   columns = ['test']
//   cursorName = 'cursor-name'
//   cursor = new Cursor(['created_at' => ts], false)
//   const builder = getMockQueryBuilder()
//   builder.select('id', 'start_time as created_at').selectRaw("'video' as type").from('videos')
//   builder.union(getBuilder().select('id', 'created_at').selectRaw("'news' as type").from('news'))
//   builder.orderBy('created_at')

//   builder.shouldReceive('newQuery').andReturnUsing(function () use(builder) {
//     return new Builder(builder.connection, builder.grammar, builder.processor)
//   })

//   path = 'http://foo.bar?cursor='.cursor.encode()

//   results = collect([
//     ['id' => 1, 'created_at' => now(), 'type' => 'video'],
//     ['id' => 2, 'created_at' => now(), 'type' => 'news'],
//   ])

//   builder.shouldReceive('get').once().andReturnUsing(function () use(builder, results, ts) {
//     t.deepEqual(
//       '(select "id", "start_time" as "created_at", \'video\' as type from "videos" where ("start_time" < ?)) union (select "id", "created_at", \'news\' as type from "news" where ("start_time" < ?)) order by "created_at" desc limit 17',
//       builder.toSql())
//             t.deepEqual([ts], builder.bindings['where'])
//             t.deepEqual([ts], builder.bindings['union'])

//             return results
//   })

//   Paginator.currentPathResolver(function () use(path) {
//     return path
//   })

//   result = builder.cursorPaginate(perPage, columns, cursorName, cursor)

//   t.deepEqual(new CursorPaginator(results, perPage, cursor, [
//     'path' => path,
//     'cursorName' => cursorName,
//     'parameters' => ['created_at'],
//   ]), result)
// })

// test('testCursorPaginateWithUnionWheresMultipleOrders', async (t) => {
//   ts = now().toDateTimeString()

//   perPage = 16
//   columns = ['test']
//   cursorName = 'cursor-name'
//   cursor = new Cursor(['created_at' => ts, 'id' => 1])
//   const builder = getMockQueryBuilder()
//   builder.select('id', 'start_time as created_at').selectRaw("'video' as type").from('videos')
//   builder.union(getBuilder().select('id', 'created_at').selectRaw("'news' as type").from('news'))
//   builder.orderByDesc('created_at').orderBy('id')

//   builder.shouldReceive('newQuery').andReturnUsing(function () use(builder) {
//     return new Builder(builder.connection, builder.grammar, builder.processor)
//   })

//   path = 'http://foo.bar?cursor='.cursor.encode()

//   results = collect([
//     ['id' => 1, 'created_at' => now(), 'type' => 'video'],
//     ['id' => 2, 'created_at' => now(), 'type' => 'news'],
//   ])

//   builder.shouldReceive('get').once().andReturnUsing(function () use(builder, results, ts) {
//     t.deepEqual(
//       '(select "id", "start_time" as "created_at", \'video\' as type from "videos" where ("start_time" < ? or ("start_time" = ? and ("id" > ?)))) union (select "id", "created_at", \'news\' as type from "news" where ("start_time" < ? or ("start_time" = ? and ("id" > ?)))) order by "created_at" desc, "id" asc limit 17',
//       builder.toSql())
//             t.deepEqual([ts, ts, 1], builder.bindings['where'])
//             t.deepEqual([ts, ts, 1], builder.bindings['union'])

//             return results
//   })

//   Paginator.currentPathResolver(function () use(path) {
//     return path
//   })

//   result = builder.cursorPaginate(perPage, columns, cursorName, cursor)

//   t.deepEqual(new CursorPaginator(results, perPage, cursor, [
//     'path' => path,
//     'cursorName' => cursorName,
//     'parameters' => ['created_at', 'id'],
//   ]), result)
// })

// test('testWhereExpression', async (t) => {
//   const builder = getBuilder()
//   builder.select('*').from('orders').where(
//     new class() implements ConditionExpression
//             {
//       public function getValue(\Illuminate\Database\Grammar grammar)
//                 {
//       return '1 = 1'

//     }
//   )
//   t.is('select * from "orders" where 1 = 1', builder.toSql())
//   t.is([], builder.getBindings())

// })

// test('testWhereRowValues', async (t) => {
//   const builder = getBuilder()
//   builder.select('*').from('orders').whereRowValues(['last_update', 'order_number'], '<', [1, 2])
//   t.is('select * from "orders" where ("last_update", "order_number") < (?, ?)', builder.toSql())

//   const builder = getBuilder()
//   builder.select('*').from('orders').where('company_id', 1).orWhereRowValues(['last_update', 'order_number'], '<', [1, 2])
//   t.is('select * from "orders" where "company_id" = ? or ("last_update", "order_number") < (?, ?)', builder.toSql())

//   const builder = getBuilder()
//   builder.select('*').from('orders').whereRowValues(['last_update', 'order_number'], '<', [1, new Raw('2')])
//   t.is('select * from "orders" where ("last_update", "order_number") < (?, 2)', builder.toSql())
//   t.deepEqual([1], builder.getBindings())
// })

// test('testWhereRowValuesArityMismatch', async (t) => {
//   expectException(InvalidArgumentException.class)
//   expectExceptionMessage('The number of columns must match the number of values')

//   const builder = getBuilder()
//   builder.select('*').from('orders').whereRowValues(['last_update'], '<', [1, 2])
// })

// test('testWhereJsonContainsMySql', async (t) => {
//   const builder = getMySqlBuilder()
//   builder.select('*').from('users').whereJsonContains('options', ['en'])
//   t.is('select * from `users` where json_contains(`options`, ?)', builder.toSql())
//   t.deepEqual(['["en"]'], builder.getBindings())

//   const builder = getMySqlBuilder()
//   builder.select('*').from('users').whereJsonContains('users.options.languages', ['en'])
//   t.is('select * from `users` where json_contains(`users`.`options`, ?, \'."languages"\')', builder.toSql())
//   t.deepEqual(['["en"]'], builder.getBindings())

//   const builder = getMySqlBuilder()
//   builder.select('*').from('users').where('id', '=', 1).orWhereJsonContains('options.languages', new Raw("'[\"en\"]'"))
//   t.is('select * from `users` where `id` = ? or json_contains(`options`, \'["en"]\', \'."languages"\')', builder.toSql())
//   t.deepEqual([1], builder.getBindings())
// })

// test('testWhereJsonContainsPostgres', async (t) => {
//   const builder = getPostgresBuilder()
//   builder.select('*').from('users').whereJsonContains('options', ['en'])
//   t.is('select * from "users" where ("options").jsonb @> ?', builder.toSql())
//   t.deepEqual(['["en"]'], builder.getBindings())

//   const builder = getPostgresBuilder()
//   builder.select('*').from('users').whereJsonContains('users.options.languages', ['en'])
//   t.is('select * from "users" where ("users"."options".\'languages\').jsonb @> ?', builder.toSql())
//   t.deepEqual(['["en"]'], builder.getBindings())

//   const builder = getPostgresBuilder()
//   builder.select('*').from('users').where('id', '=', 1).orWhereJsonContains('options.languages', new Raw("'[\"en\"]'"))
//   t.is('select * from "users" where "id" = ? or ("options".\'languages\').jsonb @> \'["en"]\'', builder.toSql())
//   t.deepEqual([1], builder.getBindings())
// })

// test('testWhereJsonContainsSqlite', async (t) => {
//   const builder = getSQLiteBuilder()
//   builder.select('*').from('users').whereJsonContains('options', 'en').toSql()
//   t.is('select * from "users" where exists (select 1 from json_each("options") where "json_each"."value" is ?)', builder.toSql())
//   t.deepEqual(['en'], builder.getBindings())

//   const builder = getSQLiteBuilder()
//   builder.select('*').from('users').whereJsonContains('users.options.language', 'en').toSql()
//   t.is('select * from "users" where exists (select 1 from json_each("users"."options", \'."language"\') where "json_each"."value" is ?)', builder.toSql())
//   t.deepEqual(['en'], builder.getBindings())
// })

// test('testWhereJsonContainsSqlServer', async (t) => {
//   const builder = getSqlServerBuilder()
//   builder.select('*').from('users').whereJsonContains('options', true)
//   t.is('select * from [users] where ? in (select [value] from openjson([options]))', builder.toSql())
//   t.deepEqual(['true'], builder.getBindings())

//   const builder = getSqlServerBuilder()
//   builder.select('*').from('users').whereJsonContains('users.options.languages', 'en')
//   t.is('select * from [users] where ? in (select [value] from openjson([users].[options], \'."languages"\'))', builder.toSql())
//   t.deepEqual(['en'], builder.getBindings())

//   const builder = getSqlServerBuilder()
//   builder.select('*').from('users').where('id', '=', 1).orWhereJsonContains('options.languages', new Raw("'en'"))
//   t.is('select * from [users] where [id] = ? or \'en\' in (select [value] from openjson([options], \'."languages"\'))', builder.toSql())
//   t.deepEqual([1], builder.getBindings())
// })

// test('testWhereJsonDoesntContainMySql', async (t) => {
//   const builder = getMySqlBuilder()
//   builder.select('*').from('users').whereJsonDoesntContain('options.languages', ['en'])
//   t.is('select * from `users` where not json_contains(`options`, ?, \'."languages"\')', builder.toSql())
//   t.deepEqual(['["en"]'], builder.getBindings())

//   const builder = getMySqlBuilder()
//   builder.select('*').from('users').where('id', '=', 1).orWhereJsonDoesntContain('options.languages', new Raw("'[\"en\"]'"))
//   t.is('select * from `users` where `id` = ? or not json_contains(`options`, \'["en"]\', \'."languages"\')', builder.toSql())
//   t.deepEqual([1], builder.getBindings())
// })

// test('testWhereJsonDoesntContainPostgres', async (t) => {
//   const builder = getPostgresBuilder()
//   builder.select('*').from('users').whereJsonDoesntContain('options.languages', ['en'])
//   t.is('select * from "users" where not ("options".\'languages\').jsonb @> ?', builder.toSql())
//   t.deepEqual(['["en"]'], builder.getBindings())

//   const builder = getPostgresBuilder()
//   builder.select('*').from('users').where('id', '=', 1).orWhereJsonDoesntContain('options.languages', new Raw("'[\"en\"]'"))
//   t.is('select * from "users" where "id" = ? or not ("options".\'languages\').jsonb @> \'["en"]\'', builder.toSql())
//   t.deepEqual([1], builder.getBindings())
// })

// test('testWhereJsonDoesntContainSqlite', async (t) => {
//   const builder = getSQLiteBuilder()
//   builder.select('*').from('users').whereJsonDoesntContain('options', 'en').toSql()
//   t.is('select * from "users" where not exists (select 1 from json_each("options") where "json_each"."value" is ?)', builder.toSql())
//   t.deepEqual(['en'], builder.getBindings())

//   const builder = getSQLiteBuilder()
//   builder.select('*').from('users').whereJsonDoesntContain('users.options.language', 'en').toSql()
//   t.is('select * from "users" where not exists (select 1 from json_each("users"."options", \'."language"\') where "json_each"."value" is ?)', builder.toSql())
//   t.deepEqual(['en'], builder.getBindings())
// })

// test('testWhereJsonDoesntContainSqlServer', async (t) => {
//   const builder = getSqlServerBuilder()
//   builder.select('*').from('users').whereJsonDoesntContain('options.languages', 'en')
//   t.is('select * from [users] where not ? in (select [value] from openjson([options], \'."languages"\'))', builder.toSql())
//   t.deepEqual(['en'], builder.getBindings())

//   const builder = getSqlServerBuilder()
//   builder.select('*').from('users').where('id', '=', 1).orWhereJsonDoesntContain('options.languages', new Raw("'en'"))
//   t.is('select * from [users] where [id] = ? or not \'en\' in (select [value] from openjson([options], \'."languages"\'))', builder.toSql())
//   t.deepEqual([1], builder.getBindings())
// })

// test('testWhereJsonContainsKeyMySql', async (t) => {
//   const builder = getMySqlBuilder()
//   builder.select('*').from('users').whereJsonContainsKey('users.options.languages')
//   t.is('select * from `users` where ifnull(json_contains_path(`users`.`options`, \'one\', \'."languages"\'), 0)', builder.toSql())

//   const builder = getMySqlBuilder()
//   builder.select('*').from('users').whereJsonContainsKey('options.language.primary')
//   t.is('select * from `users` where ifnull(json_contains_path(`options`, \'one\', \'."language"."primary"\'), 0)', builder.toSql())

//   const builder = getMySqlBuilder()
//   builder.select('*').from('users').where('id', '=', 1).orWhereJsonContainsKey('options.languages')
//   t.is('select * from `users` where `id` = ? or ifnull(json_contains_path(`options`, \'one\', \'."languages"\'), 0)', builder.toSql())

//   const builder = getMySqlBuilder()
//   builder.select('*').from('users').whereJsonContainsKey('options.languages[0][1]')
//   t.is('select * from `users` where ifnull(json_contains_path(`options`, \'one\', \'."languages"[0][1]\'), 0)', builder.toSql())
// })

// test('testWhereJsonContainsKeyPostgres', async (t) => {
//   const builder = getPostgresBuilder()
//   builder.select('*').from('users').whereJsonContainsKey('users.options.languages')
//   t.is('select * from "users" where coalesce(("users"."options").jsonb ?? \'languages\', false)', builder.toSql())

//   const builder = getPostgresBuilder()
//   builder.select('*').from('users').whereJsonContainsKey('options.language.primary')
//   t.is('select * from "users" where coalesce(("options".\'language\').jsonb ?? \'primary\', false)', builder.toSql())

//   const builder = getPostgresBuilder()
//   builder.select('*').from('users').where('id', '=', 1).orWhereJsonContainsKey('options.languages')
//   t.is('select * from "users" where "id" = ? or coalesce(("options").jsonb ?? \'languages\', false)', builder.toSql())

//   const builder = getPostgresBuilder()
//   builder.select('*').from('users').whereJsonContainsKey('options.languages[0][1]')
//   t.is('select * from "users" where case when jsonb_typeof(("options".\'languages\'.0).jsonb) = \'array\' then jsonb_array_length(("options".\'languages\'.0).jsonb) >= 2 else false end', builder.toSql())

//   const builder = getPostgresBuilder()
//   builder.select('*').from('users').whereJsonContainsKey('options.languages[-1]')
//   t.is('select * from "users" where case when jsonb_typeof(("options".\'languages\').jsonb) = \'array\' then jsonb_array_length(("options".\'languages\').jsonb) >= 1 else false end', builder.toSql())
// })

// test('testWhereJsonContainsKeySqlite', async (t) => {
//   const builder = getSQLiteBuilder()
//   builder.select('*').from('users').whereJsonContainsKey('users.options.languages')
//   t.is('select * from "users" where json_type("users"."options", \'."languages"\') is not null', builder.toSql())

//   const builder = getSQLiteBuilder()
//   builder.select('*').from('users').whereJsonContainsKey('options.language.primary')
//   t.is('select * from "users" where json_type("options", \'."language"."primary"\') is not null', builder.toSql())

//   const builder = getSQLiteBuilder()
//   builder.select('*').from('users').where('id', '=', 1).orWhereJsonContainsKey('options.languages')
//   t.is('select * from "users" where "id" = ? or json_type("options", \'."languages"\') is not null', builder.toSql())

//   const builder = getSQLiteBuilder()
//   builder.select('*').from('users').whereJsonContainsKey('options.languages[0][1]')
//   t.is('select * from "users" where json_type("options", \'."languages"[0][1]\') is not null', builder.toSql())
// })

// test('testWhereJsonContainsKeySqlServer', async (t) => {
//   const builder = getSqlServerBuilder()
//   builder.select('*').from('users').whereJsonContainsKey('users.options.languages')
//   t.is('select * from [users] where \'languages\' in (select [key] from openjson([users].[options]))', builder.toSql())

//   const builder = getSqlServerBuilder()
//   builder.select('*').from('users').whereJsonContainsKey('options.language.primary')
//   t.is('select * from [users] where \'primary\' in (select [key] from openjson([options], \'."language"\'))', builder.toSql())

//   const builder = getSqlServerBuilder()
//   builder.select('*').from('users').where('id', '=', 1).orWhereJsonContainsKey('options.languages')
//   t.is('select * from [users] where [id] = ? or \'languages\' in (select [key] from openjson([options]))', builder.toSql())

//   const builder = getSqlServerBuilder()
//   builder.select('*').from('users').whereJsonContainsKey('options.languages[0][1]')
//   t.is('select * from [users] where 1 in (select [key] from openjson([options], \'."languages"[0]\'))', builder.toSql())
// })

// test('testWhereJsonDoesntContainKeyMySql', async (t) => {
//   const builder = getMySqlBuilder()
//   builder.select('*').from('users').whereJsonDoesntContainKey('options.languages')
//   t.is('select * from `users` where not ifnull(json_contains_path(`options`, \'one\', \'."languages"\'), 0)', builder.toSql())

//   const builder = getMySqlBuilder()
//   builder.select('*').from('users').where('id', '=', 1).orWhereJsonDoesntContainKey('options.languages')
//   t.is('select * from `users` where `id` = ? or not ifnull(json_contains_path(`options`, \'one\', \'."languages"\'), 0)', builder.toSql())

//   const builder = getMySqlBuilder()
//   builder.select('*').from('users').whereJsonDoesntContainKey('options.languages[0][1]')
//   t.is('select * from `users` where not ifnull(json_contains_path(`options`, \'one\', \'."languages"[0][1]\'), 0)', builder.toSql())
// })

// test('testWhereJsonDoesntContainKeyPostgres', async (t) => {
//   const builder = getPostgresBuilder()
//   builder.select('*').from('users').whereJsonDoesntContainKey('options.languages')
//   t.is('select * from "users" where not coalesce(("options").jsonb ?? \'languages\', false)', builder.toSql())

//   const builder = getPostgresBuilder()
//   builder.select('*').from('users').where('id', '=', 1).orWhereJsonDoesntContainKey('options.languages')
//   t.is('select * from "users" where "id" = ? or not coalesce(("options").jsonb ?? \'languages\', false)', builder.toSql())

//   const builder = getPostgresBuilder()
//   builder.select('*').from('users').whereJsonDoesntContainKey('options.languages[0][1]')
//   t.is('select * from "users" where not case when jsonb_typeof(("options".\'languages\'.0).jsonb) = \'array\' then jsonb_array_length(("options".\'languages\'.0).jsonb) >= 2 else false end', builder.toSql())

//   const builder = getPostgresBuilder()
//   builder.select('*').from('users').whereJsonDoesntContainKey('options.languages[-1]')
//   t.is('select * from "users" where not case when jsonb_typeof(("options".\'languages\').jsonb) = \'array\' then jsonb_array_length(("options".\'languages\').jsonb) >= 1 else false end', builder.toSql())
// })

// test('testWhereJsonDoesntContainKeySqlite', async (t) => {
//   const builder = getSQLiteBuilder()
//   builder.select('*').from('users').whereJsonDoesntContainKey('options.languages')
//   t.is('select * from "users" where not json_type("options", \'."languages"\') is not null', builder.toSql())

//   const builder = getSQLiteBuilder()
//   builder.select('*').from('users').where('id', '=', 1).orWhereJsonDoesntContainKey('options.languages')
//   t.is('select * from "users" where "id" = ? or not json_type("options", \'."languages"\') is not null', builder.toSql())

//   const builder = getSQLiteBuilder()
//   builder.select('*').from('users').where('id', '=', 1).orWhereJsonDoesntContainKey('options.languages[0][1]')
//   t.is('select * from "users" where "id" = ? or not json_type("options", \'."languages"[0][1]\') is not null', builder.toSql())
// })

// test('testWhereJsonDoesntContainKeySqlServer', async (t) => {
//   const builder = getSqlServerBuilder()
//   builder.select('*').from('users').whereJsonDoesntContainKey('options.languages')
//   t.is('select * from [users] where not \'languages\' in (select [key] from openjson([options]))', builder.toSql())

//   const builder = getSqlServerBuilder()
//   builder.select('*').from('users').where('id', '=', 1).orWhereJsonDoesntContainKey('options.languages')
//   t.is('select * from [users] where [id] = ? or not \'languages\' in (select [key] from openjson([options]))', builder.toSql())

//   const builder = getSqlServerBuilder()
//   builder.select('*').from('users').where('id', '=', 1).orWhereJsonDoesntContainKey('options.languages[0][1]')
//   t.is('select * from [users] where [id] = ? or not 1 in (select [key] from openjson([options], \'."languages"[0]\'))', builder.toSql())
// })

// test('testWhereJsonLengthMySql', async (t) => {
//   const builder = getMySqlBuilder()
//   builder.select('*').from('users').whereJsonLength('options', 0)
//   t.is('select * from `users` where json_length(`options`) = ?', builder.toSql())
//   t.deepEqual([0], builder.getBindings())

//   const builder = getMySqlBuilder()
//   builder.select('*').from('users').whereJsonLength('users.options.languages', '>', 0)
//   t.is('select * from `users` where json_length(`users`.`options`, \'."languages"\') > ?', builder.toSql())
//   t.deepEqual([0], builder.getBindings())

//   const builder = getMySqlBuilder()
//   builder.select('*').from('users').where('id', '=', 1).orWhereJsonLength('options.languages', new Raw('0'))
//   t.is('select * from `users` where `id` = ? or json_length(`options`, \'."languages"\') = 0', builder.toSql())
//   t.deepEqual([1], builder.getBindings())

//   const builder = getMySqlBuilder()
//   builder.select('*').from('users').where('id', '=', 1).orWhereJsonLength('options.languages', '>', new Raw('0'))
//   t.is('select * from `users` where `id` = ? or json_length(`options`, \'."languages"\') > 0', builder.toSql())
//   t.deepEqual([1], builder.getBindings())
// })

// test('testWhereJsonLengthPostgres', async (t) => {
//   const builder = getPostgresBuilder()
//   builder.select('*').from('users').whereJsonLength('options', 0)
//   t.is('select * from "users" where jsonb_array_length(("options").jsonb) = ?', builder.toSql())
//   t.deepEqual([0], builder.getBindings())

//   const builder = getPostgresBuilder()
//   builder.select('*').from('users').whereJsonLength('users.options.languages', '>', 0)
//   t.is('select * from "users" where jsonb_array_length(("users"."options".\'languages\').jsonb) > ?', builder.toSql())
//   t.deepEqual([0], builder.getBindings())

//   const builder = getPostgresBuilder()
//   builder.select('*').from('users').where('id', '=', 1).orWhereJsonLength('options.languages', new Raw('0'))
//   t.is('select * from "users" where "id" = ? or jsonb_array_length(("options".\'languages\').jsonb) = 0', builder.toSql())
//   t.deepEqual([1], builder.getBindings())

//   const builder = getPostgresBuilder()
//   builder.select('*').from('users').where('id', '=', 1).orWhereJsonLength('options.languages', '>', new Raw('0'))
//   t.is('select * from "users" where "id" = ? or jsonb_array_length(("options".\'languages\').jsonb) > 0', builder.toSql())
//   t.deepEqual([1], builder.getBindings())
// })

// test('testWhereJsonLengthSqlite', async (t) => {
//   const builder = getSQLiteBuilder()
//   builder.select('*').from('users').whereJsonLength('options', 0)
//   t.is('select * from "users" where json_array_length("options") = ?', builder.toSql())
//   t.deepEqual([0], builder.getBindings())

//   const builder = getSQLiteBuilder()
//   builder.select('*').from('users').whereJsonLength('users.options.languages', '>', 0)
//   t.is('select * from "users" where json_array_length("users"."options", \'."languages"\') > ?', builder.toSql())
//   t.deepEqual([0], builder.getBindings())

//   const builder = getSQLiteBuilder()
//   builder.select('*').from('users').where('id', '=', 1).orWhereJsonLength('options.languages', new Raw('0'))
//   t.is('select * from "users" where "id" = ? or json_array_length("options", \'."languages"\') = 0', builder.toSql())
//   t.deepEqual([1], builder.getBindings())

//   const builder = getSQLiteBuilder()
//   builder.select('*').from('users').where('id', '=', 1).orWhereJsonLength('options.languages', '>', new Raw('0'))
//   t.is('select * from "users" where "id" = ? or json_array_length("options", \'."languages"\') > 0', builder.toSql())
//   t.deepEqual([1], builder.getBindings())
// })

// test('testWhereJsonLengthSqlServer', async (t) => {
//   const builder = getSqlServerBuilder()
//   builder.select('*').from('users').whereJsonLength('options', 0)
//   t.is('select * from [users] where (select count(*) from openjson([options])) = ?', builder.toSql())
//   t.deepEqual([0], builder.getBindings())

//   const builder = getSqlServerBuilder()
//   builder.select('*').from('users').whereJsonLength('users.options.languages', '>', 0)
//   t.is('select * from [users] where (select count(*) from openjson([users].[options], \'."languages"\')) > ?', builder.toSql())
//   t.deepEqual([0], builder.getBindings())

//   const builder = getSqlServerBuilder()
//   builder.select('*').from('users').where('id', '=', 1).orWhereJsonLength('options.languages', new Raw('0'))
//   t.is('select * from [users] where [id] = ? or (select count(*) from openjson([options], \'."languages"\')) = 0', builder.toSql())
//   t.deepEqual([1], builder.getBindings())

//   const builder = getSqlServerBuilder()
//   builder.select('*').from('users').where('id', '=', 1).orWhereJsonLength('options.languages', '>', new Raw('0'))
//   t.is('select * from [users] where [id] = ? or (select count(*) from openjson([options], \'."languages"\')) > 0', builder.toSql())
//   t.deepEqual([1], builder.getBindings())
// })

// test('testFrom', async (t) => {
//   const builder = getBuilder()
//   builder.from(getBuilder().from('users'), 'u')
//   t.is('select * from (select * from "users") as "u"', builder.toSql())

//   const builder = getBuilder()
//   const eloquentBuilder = new EloquentBuilder(getBuilder())
//   builder.from(eloquentBuilder.from('users'), 'u')
//   t.is('select * from (select * from "users") as "u"', builder.toSql())
// })

// test('testFromSub', async (t) => {
//   const builder = getBuilder()
//   builder.fromSub(function (query) {
//     query.select(new Raw('max(last_seen_at) as last_seen_at')).from('user_sessions').where('foo', '=', '1')
//   }, 'sessions').where('bar', '<', '10')
//   t.is('select * from (select max(last_seen_at) as last_seen_at from "user_sessions" where "foo" = ?) as "sessions" where "bar" < ?', builder.toSql())
//   t.deepEqual(['1', '10'], builder.getBindings())

//   expectException(InvalidArgumentException.class)
//   const builder = getBuilder()
//   builder.fromSub(['invalid'], 'sessions').where('bar', '<', '10')
// })

// test('testFromSubWithPrefix', async (t) => {
//   const builder = getBuilder()
//   builder.getGrammar().setTablePrefix('prefix_')
//   builder.fromSub(function (query) {
//     query.select(new Raw('max(last_seen_at) as last_seen_at')).from('user_sessions').where('foo', '=', '1')
//   }, 'sessions').where('bar', '<', '10')
//   t.is('select * from (select max(last_seen_at) as last_seen_at from "prefix_user_sessions" where "foo" = ?) as "prefix_sessions" where "bar" < ?', builder.toSql())
//   t.deepEqual(['1', '10'], builder.getBindings())
// })

// test('testFromSubWithoutBindings', async (t) => {
//   const builder = getBuilder()
//   builder.fromSub(function (query) {
//     query.select(new Raw('max(last_seen_at) as last_seen_at')).from('user_sessions')
//   }, 'sessions')
//   t.is('select * from (select max(last_seen_at) as last_seen_at from "user_sessions") as "sessions"', builder.toSql())

//   expectException(InvalidArgumentException.class)
//   const builder = getBuilder()
//   builder.fromSub(['invalid'], 'sessions')
// })

// test('testFromRaw', async (t) => {
//   const builder = getBuilder()
//   builder.fromRaw(new Raw('(select max(last_seen_at) as last_seen_at from "user_sessions") as "sessions"'))
//   t.is('select * from (select max(last_seen_at) as last_seen_at from "user_sessions") as "sessions"', builder.toSql())
// })

// test('testFromRawOnSqlServer', async (t) => {
//   const builder = getSqlServerBuilder()
//   builder.fromRaw('dbo.[SomeNameWithRoundBrackets (test)]')
//   t.is('select * from dbo.[SomeNameWithRoundBrackets (test)]', builder.toSql())
// })

// test('testFromRawWithWhereOnTheMainQuery', async (t) => {
//   const builder = getBuilder()
//   builder.fromRaw(new Raw('(select max(last_seen_at) as last_seen_at from "sessions") as "last_seen_at"')).where('last_seen_at', '>', '1520652582')
//   t.is('select * from (select max(last_seen_at) as last_seen_at from "sessions") as "last_seen_at" where "last_seen_at" > ?', builder.toSql())
//   t.deepEqual(['1520652582'], builder.getBindings())
// })

// test('testFromQuestionMarkOperatorOnPostgres', async (t) => {
//   const builder = getPostgresBuilder()
//   builder.select('*').from('users').where('roles', '?', 'superuser')
//   t.is('select * from "users" where "roles" ?? ?', builder.toSql())

//   const builder = getPostgresBuilder()
//   builder.select('*').from('users').where('roles', '?|', 'superuser')
//   t.is('select * from "users" where "roles" ??| ?', builder.toSql())

//   const builder = getPostgresBuilder()
//   builder.select('*').from('users').where('roles', '?&', 'superuser')
//   t.is('select * from "users" where "roles" ??& ?', builder.toSql())
// })

// test('testUseIndexMySql', async (t) => {
//   const builder = getMySqlBuilder()
//   builder.select('foo').from('users').useIndex('test_index')
//   t.is('select `foo` from `users` use index (test_index)', builder.toSql())
// })

// test('testForceIndexMySql', async (t) => {
//   const builder = getMySqlBuilder()
//   builder.select('foo').from('users').forceIndex('test_index')
//   t.is('select `foo` from `users` force index (test_index)', builder.toSql())
// })

// test('testIgnoreIndexMySql', async (t) => {
//   const builder = getMySqlBuilder()
//   builder.select('foo').from('users').ignoreIndex('test_index')
//   t.is('select `foo` from `users` ignore index (test_index)', builder.toSql())
// })

// test('testUseIndexSqlite', async (t) => {
//   const builder = getSQLiteBuilder()
//   builder.select('foo').from('users').useIndex('test_index')
//   t.is('select "foo" from "users"', builder.toSql())
// })

// test('testForceIndexSqlite', async (t) => {
//   const builder = getSQLiteBuilder()
//   builder.select('foo').from('users').forceIndex('test_index')
//   t.is('select "foo" from "users" indexed by test_index', builder.toSql())
// })

// test('testIgnoreIndexSqlite', async (t) => {
//   const builder = getSQLiteBuilder()
//   builder.select('foo').from('users').ignoreIndex('test_index')
//   t.is('select "foo" from "users"', builder.toSql())
// })

// test('testUseIndexSqlServer', async (t) => {
//   const builder = getSqlServerBuilder()
//   builder.select('foo').from('users').useIndex('test_index')
//   t.is('select [foo] from [users]', builder.toSql())
// })

// test('testForceIndexSqlServer', async (t) => {
//   const builder = getSqlServerBuilder()
//   builder.select('foo').from('users').forceIndex('test_index')
//   t.is('select [foo] from [users] with (index(test_index))', builder.toSql())
// })

// test('testIgnoreIndexSqlServer', async (t) => {
//   const builder = getSqlServerBuilder()
//   builder.select('foo').from('users').ignoreIndex('test_index')
//   t.is('select [foo] from [users]', builder.toSql())
// })

// test('testClone', async (t) => {
//   const builder = getBuilder()
//   builder.select('*').from('users')
//   clone = builder.clone().where('email', 'foo')

//   assertNotSame(builder, clone)
//   t.is('select * from "users"', builder.toSql())
//   t.is('select * from "users" where "email" = ?', clone.toSql())
// })

// test('testCloneWithout', async (t) => {
//   const builder = getBuilder()
//   builder.select('*').from('users').where('email', 'foo').orderBy('email')
//   clone = builder.cloneWithout(['orders'])

//   t.is('select * from "users" where "email" = ? order by "email" asc', builder.toSql())
//   t.is('select * from "users" where "email" = ?', clone.toSql())
// })

// test('testCloneWithoutBindings', async (t) => {
//   const builder = getBuilder()
//   builder.select('*').from('users').where('email', 'foo').orderBy('email')
//   clone = builder.cloneWithout(['wheres']).cloneWithoutBindings(['where'])

//   t.is('select * from "users" where "email" = ? order by "email" asc', builder.toSql())
//   t.deepEqual([0 => 'foo'], builder.getBindings())

//   t.is('select * from "users" order by "email" asc', clone.toSql())
//   t.deepEqual([], clone.getBindings())
// })

// test('testToRawSql', async (t) => {
//   const connection = m.mock(ConnectionInterface.class)
//   connection.shouldReceive('prepareBindings')
//     .with(['foo'])
//     .andReturn(['foo'])

//   const grammar = m.mock(Grammar.class).makePartial()
//   grammar.shouldReceive('substituteBindingsIntoRawSql')
//     .with('select * from "users" where "email" = ?', ['foo'])
//     .andReturn('select * from "users" where "email" = \'foo\'')
//   const builder = new Builder(connection, grammar, m.mock(Processor.class))
//   builder.select('*').from('users').where('email', 'foo')

//   t.is('select * from "users" where "email" = \'foo\'', builder.toRawSql())
// })

import test from 'ava'

import getBuilder from './helpers/getBuilder.js'
import getMySqlBuilderWithProcessor from './helpers/getMySqlBuilderWithProcessor.js'
import getMySqlBuilder from './helpers/getMySqlBuilder.js'
import getPostgresBuilder from './helpers/getPostgresBuilder.js'
import getSQLiteBuilder from './helpers/getSQLiteBuilder.js'
import getSqlServerBuilder from './helpers/getSqlServerBuilder.js'
import EloquentBuilder from '../../src/Illuminate/Database/Eloquent/Builder.js'
import getPostgresBuilderWithProcessor from './helpers/getPostgresBuilderWithProcessor.js'
import Raw from './../../src/Illuminate/Database/Query/Expression.js'

import mock from '../helpers/mock.js'

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

test('testWhereTimeSqlServer', t => {
  let builder = getSqlServerBuilder()
  builder.select('*').from('users').whereTime('created_at', '22:00')
  t.is('select * from [users] where cast([created_at] as time) = ?', builder.toSql())
  t.deepEqual(['22:00'], builder.getBindings())

  builder = getSqlServerBuilder()
  builder.select('*').from('users').whereTime('created_at', new Raw('NOW()'))
  t.is('select * from [users] where cast([created_at] as time) = NOW()', builder.toSql())
  t.deepEqual([], builder.getBindings())
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

test('testBasicOrWheres', t => {
  const builder = getBuilder()
  builder.select('*').from('users').where('id', '=', 1).orWhere('email', '=', 'foo')
  t.is('select * from "users" where "id" = ? or "email" = ?', builder.toSql())
  t.deepEqual([1, 'foo'], builder.getBindings())
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
  t.is('select * from "users" where "id" in (select "id" from "users" where "age" > ? limit 3)', builder.toSql())
  t.deepEqual([25], builder.getBindings())

  builder = getBuilder()
  builder.select('*').from('users').whereNotIn('id', (query) => {
    query.select('id').from('users').where('age', '>', 25).take(3)
  })
  t.is('select * from "users" where "id" not in (select "id" from "users" where "age" > ? limit 3)', builder.toSql())
  t.deepEqual([25], builder.getBindings())
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
  t.deepEqual(['bar', 'baz'], results.all())

  builder = getBuilder()
  createMock(builder.getConnection()).expects('select').once().returns([{ id: 1, foo: 'bar' }, { id: 10, foo: 'baz' }])
  createMock(builder.getProcessor()).expects('processSelect').once().withArgs(builder, [{ id: 1, foo: 'bar' }, { id: 10, foo: 'baz' }]).callsFake((query, results) => {
    return results
  })
  results = await builder.from('users').where('id', '=', 1).pluck('foo', 'id')
  t.deepEqual([{ 1: 'bar', 10: 'baz' }], results.all())

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
  createMock(builder.getConnection()).expects('affectingStatement').once().withArgs('insert ignore into `users` (`email`) values (?)', ['foo']).returns(1)
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

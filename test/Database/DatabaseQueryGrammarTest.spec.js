import test from 'ava'

import getBuilder from './helpers/getBuilder.js'
import Grammar from '../../src/Illuminate/Database/Query/Grammars/Grammar.js'
import Expression from '../../src/Illuminate/Database/Query/Expression.js'

test('testWhereRawReturnsStringWhenExpressionPassed', async t => {
  const grammar = new Grammar()
  const builder = getBuilder()

  const rawQuery = grammar.whereRaw(builder, { sql: new Expression('select * from "users"') })

  t.is(rawQuery, 'select * from "users"')
})

test('testWhereRawReturnsStringWhenStringPassed', async t => {
  const grammar = new Grammar()
  const builder = getBuilder()

  const rawQuery = grammar.whereRaw(builder, { sql: 'select * from "users"' })

  t.is(rawQuery, 'select * from "users"')
})

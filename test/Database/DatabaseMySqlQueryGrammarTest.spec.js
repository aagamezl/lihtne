import test from 'ava'

import mock from '../helpers/mock.js'
import getConnection from './helpers/getConnection.js'
import MySqlGrammar from '../../src/Illuminate/Database/Query/Grammars/MySqlGrammar.js'

test('testToRawSql', async t => {
  const { createMock, verifyMock } = mock()

  const connection = getConnection()

  const connectionMock = createMock(connection)
  connectionMock.expects('escape').withArgs('foo', false).returns("'foo'")

  const grammar = new MySqlGrammar()
  grammar.setConnection(connection)

  const query = grammar.substituteBindingsIntoRawSql(
    'select * from "users" where \'Hello\\\'World?\' IS NOT NULL AND "email" = ?',
    ['foo']
  )

  t.is(query, 'select * from "users" where \'Hello\\\'World?\' IS NOT NULL AND "email" = \'foo\'')

  verifyMock()
})

import { describe, expect, test } from '@jest/globals'

import { getBuilder } from './helpers/getBuilder'

describe('Database Query Builder', () => {
  test('testBasicSelect', () => {
  const builder = getBuilder()
  builder.select('*').from('users')

  expect(builder.toSql()).toBe('select * from "users"')
  })
})
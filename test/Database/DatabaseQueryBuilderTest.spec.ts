import { describe, expect, test } from '@jest/globals'

import { getBuilder } from './helpers/getBuilder'
import { getConnection } from './helpers/getConnection'

describe('Database Query Builder', () => {
  test('testBasicSelect', () => {
    const builder = getBuilder()
    builder.select('*').from('users')

    expect(builder.toSql()).toBe('select * from "users"')
  })

  test('testBasicSelectWithGetColumns', () => {
    const builder = getBuilder();
    builder.getProcessor().shouldReceive('processSelect');
    builder.getConnection().shouldReceive('select').once().andReturnUsing((sql: string) => {
      expect(sql).toBe('select * from "users"');
    });
    builder.getConnection().shouldReceive('select').once().andReturnUsing((sql: string) => {
      expect(sql).toBe('select "foo", "bar" from "users"');
    });
    builder.getConnection().shouldReceive('select').once().andReturnUsing((sql: string) => {
      expect(sql).toBe('select "baz" from "users"');
    });

    builder.from('users').get();
    expect(builder.columns).toBeNull();

    builder.from('users').get(['foo', 'bar']);
    expect(builder.columns).toBeNull();

    builder.from('users').get('baz');
    expect(builder.columns).toBeNull();

    expect(builder.toSql()).toBe('select * from "users"');
    expect(builder.columns).toBeNull();
  })
})
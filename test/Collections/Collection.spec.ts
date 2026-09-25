import { describe, expect, test } from '@jest/globals'

import { Collection } from '../../src/Illuminate/Collections'

describe('CollectionNew', () => {
  test('constructor defaults to an empty list', () => {
    expect(new Collection().all()).toEqual([])
  })

  test('constructor normalizes list and associative inputs', () => {
    expect(new Collection([1, 2, 3]).all()).toEqual([1, 2, 3])
    expect(new Collection({ a: 1, b: 2 }).all()).toEqual({ a: 1, b: 2 })
    expect(new Collection('scalar').all()).toEqual(['scalar'])
  })

  test('first delegates to Arr with callback and default', () => {
    const users = new Collection([
      { id: 1, active: true },
      { id: 2, active: false }
    ])

    expect(users.first()).toEqual({ id: 1, active: true })
    expect(users.first((user) => user.active === false)).toEqual({ id: 2, active: false })
    expect(users.first(() => false, 'none')).toBe('none')
    expect(users.first(() => false, () => 'lazy')).toBe('lazy')
  })

  test('map returns a new collection with transformed values', () => {
    const mapped = new Collection([1, 2, 3]).map((n, key) => `${key}:${n * 2}`)

    expect(mapped.all()).toEqual(['0:2', '1:4', '2:6'])
  })

  test('pluck builds list and keyed collections', () => {
    const brands = new Collection([
      { brand: 'Tesla', color: 'red' },
      { brand: 'Pagani', color: 'white' }
    ])

    expect(brands.pluck('color').all()).toEqual(['red', 'white'])
    expect(brands.pluck('color', 'brand').all()).toEqual({
      Tesla: 'red',
      Pagani: 'white'
    })
  })

  test('pluck supports nested dot paths', () => {
    const events = new Collection([
      { name: 'Laracon', speakers: { first_day: ['Rosa', 'Judith'] } },
      { name: 'VueConf', speakers: { first_day: ['Abigail', 'Joey'] } }
    ])

    expect(events.pluck('speakers.first_day').all()).toEqual([
      ['Rosa', 'Judith'],
      ['Abigail', 'Joey']
    ])
  })

  test('implode with callback glue', () => {
    const joined = new Collection([1, 2, 3]).implode((n) => `#${n}`, '|')

    expect(joined).toBe('#1|#2|#3')
  })

  test('implode plucks plain object rows when first item is array or object', () => {
    const rows = new Collection([
      { email: 'a@example.com' },
      { email: 'b@example.com' }
    ])

    expect(rows.implode('email', ', ')).toBe('a@example.com, b@example.com')

    const nested = new Collection([[1, 2], [3, 4]])
    expect(nested.implode('0', '-')).toBe('1-3')
  })

  test('implode joins scalar lists with glue argument', () => {
    expect(new Collection(['a', 'b', 'c']).implode('-')).toBe('a-b-c')
  })

  test('implode joins mapped strings for class instances without pluck branch', () => {
    class JoinStub {
      public readonly id = 1
    }

    const sqlParts = new Collection([new JoinStub(), new JoinStub()])
      .map(() => 'inner join t')
      .implode(' ')

    expect(sqlParts).toBe('inner join t inner join t')
  })

  test('each stops when callback returns false', () => {
    const seen: number[] = []

    new Collection([1, 2, 3, 4]).each((value) => {
      seen.push(value)

      if (value === 2) {
        return false
      }
    })

    expect(seen).toEqual([1, 2])
  })

  test('all returns dictionary for non-list shapes after map', () => {
    const keyed = new Collection({ x: 1, y: 2 }).map((n) => n + 1)

    expect(keyed.all()).toEqual({ x: 2, y: 3 })
  })

  test('implode treats String objects like scalars', () => {
    const boxed = new Collection([String('a'), String('b')])

    expect(boxed.implode('-')).toBe('a-b')
  })

  test('implode uses empty glue when glue argument omitted', () => {
    expect(new Collection(['x', 'y']).implode((value) => value)).toBe('xy')
  })

  test('implode joins associative dictionaries via joinAll object path', () => {
    expect(new Collection({ a: '1', b: '2' }).implode((value) => value, '')).toBe('12')
  })

  test('implode with undefined glue on pluck branch', () => {
    const rows = new Collection([{ n: 1 }, { n: 2 }])
    expect(rows.implode('n')).toBe('12')
  })

  test('implode with no arguments joins scalar lists with empty glue', () => {
    expect(new Collection(['a', 'b']).implode()).toBe('ab')
  })

  test('newInstance default creates an empty collection', () => {
    class SpawnableCollection extends Collection<number, number> {
      public spawnEmpty (): Collection<number, number> {
        return this.newInstance()
      }
    }

    expect(new SpawnableCollection([1]).spawnEmpty().all()).toEqual([])
  })
})

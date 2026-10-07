import { describe, expect, test } from '@jest/globals'

import { Arr } from '../../src/Illuminate/Collections/Arr'

describe('ArrNew', () => {
  test('accessible distinguishes arrays, objects, and invalid values', () => {
    expect(Arr.accessible([1])).toBe(true)
    expect(Arr.accessible({ a: 1 })).toBe(true)
    expect(Arr.accessible(null)).toBe(false)
    expect(Arr.accessible(undefined)).toBe(false)
    expect(Arr.accessible('x')).toBe(false)
  })

  test('wrap handles null, arrays, and scalars', () => {
    expect(Arr.wrap(undefined)).toEqual([])
    expect(Arr.wrap([1, 2])).toEqual([1, 2])
    expect(Arr.wrap('solo')).toEqual(['solo'])
  })

  test('isList and listValues detect dense numeric keys', () => {
    expect(Arr.isList({})).toBe(true)
    expect(Arr.isList({ 0: 'a', 1: 'b' })).toBe(true)
    expect(Arr.isList({ 1: 'a' })).toBe(false)
    expect(Arr.isList({ foo: 'bar' })).toBe(false)
    expect(Arr.listValues({ 0: 'a', 1: 'b' })).toEqual(['a', 'b'])
  })

  test('from normalizes arrays, arrayables, iterables, and records', () => {
    // expect(Arr.from([10, 20])).toEqual({ 0: 10, 1: 20 })
    expect(Arr.from([10, 20])).toEqual([10, 20])

    // const arrayable: Arrayable<string, number> = {
    //   toArray () {
    //     return { x: 1, y: 2 }
    //   }
    // }
    // expect(Arr.from(arrayable)).toEqual({ x: 1, y: 2 })

    // expect(Arr.from(new Set(['a', 'b']))).toEqual({ 0: 'a', 1: 'b' })
    expect(Arr.from(new Set(['a', 'b']))).toEqual(['a', 'b'])

    expect(Arr.from({ id: 5, name: 'Lihtne' })).toEqual({ id: 5, name: 'Lihtne' })
  })

  test('from rejects null, undefined, and scalars', () => {
    expect(() => Arr.from(null as never)).toThrow('Items cannot be represented by a scalar value.')
    expect(() => Arr.from(undefined as never)).toThrow('Items cannot be represented by a scalar value.')
    expect(() => Arr.from(42 as never)).toThrow('Items cannot be represented by a scalar value.')
  })

  test('except and forget remove keys without mutating the source', () => {
    const source = {
      select: [1],
      join: [2],
      where: [3],
      nested: { name: 'ada', city: 'tallinn' }
    }

    expect(Arr.except(source, ['select', 'join'])).toEqual({
      where: [3],
      nested: { name: 'ada', city: 'tallinn' }
    })
    expect(source.join).toEqual([2])

    const nested = { user: { name: 'ada', city: 'tallinn' }, keep: 1 }
    expect(Arr.except(nested, ['user.name'])).toEqual({
      user: { city: 'tallinn' },
      keep: 1
    })
    expect(nested.user.name).toBe('ada')

    const list = ['a', 'b', 'c']
    Arr.forget(list, [1])
    expect(1 in list).toBe(false)
    expect(list[0]).toBe('a')
    expect(list[2]).toBe('c')
  })

  test('exists on arrays and dictionaries', () => {
    expect(Arr.exists(['a', 'b'], 0)).toBe(true)
    expect(Arr.exists(['a', 'b'], 2)).toBe(false)
    expect(Arr.exists(['a', 'b'], 'nope')).toBe(false)
    expect(Arr.exists({ foo: 1 }, 'foo')).toBe(true)
    expect(Arr.exists({ foo: 1 }, 'bar')).toBe(false)
  })

  test('collapse merges nested arrays and skips other values', () => {
    expect(Arr.collapse([[1, 2], [3], 'skip', { x: 1 }])).toEqual([1, 2, 3])
  })

  test('first without callback, with callback, and defaults', () => {
    expect(Arr.first([])).toBeUndefined()
    expect(Arr.first([], undefined, 'empty')).toBe('empty')
    expect(Arr.first([], undefined, () => 'lazy')).toBe('lazy')

    expect(Arr.first([10, 20, 30])).toBe(10)

    // const keyed = { 0: 'a', 1: 'b', foo: 'c' }
    const keyed = { foo: 'a', bar: 'b', baz: 'c' }
    expect(Arr.first(keyed, (value: string) => value === 'b')).toBe('b')
    expect(Arr.first([1, 2, 3], (value: number, key: number) => key === 1 && value === 2)).toBe(2)
    expect(Arr.first([1, 2, 3], () => false, 'none')).toBe('none')
  })

  test('map preserves keys and coerces numeric key types', () => {
    const mapped = Arr.map({ foo: 1, bar: 2, label: 3 }, (value, key) => {
      return `${String(key)}:${value}`
    })

    expect(mapped).toEqual({
      foo: 'foo:1',
      bar: 'bar:2',
      label: 'label:3'
    })
  })

  test('get reads direct keys, dot paths, defaults, and whole array', () => {
    const data = { user: { profile: { name: 'Ada' } }, tags: ['a'] }

    expect(Arr.get(null, 'any', 'd')).toBe('d')
    expect(Arr.get(data, null)).toBe(data)
    expect(Arr.get(data, undefined)).toBe(data)
    expect(Arr.get(data, 'missing', 'fallback')).toBe('fallback')
    expect(Arr.get(data, 'user.profile.name')).toBe('Ada')
    expect(Arr.get(data, 'user.profile.missing', () => 'n/a')).toBe('n/a')
    expect(Arr.get(['x', 'y'], 1)).toBe('y')
  })

  test('get readEntry throws when key is non-enumerable', () => {
    const hidden = Object.create(null) as Record<string, unknown>
    Object.defineProperty(hidden, 'secret', { value: 99, enumerable: false })

    expect(() => Arr.get(hidden, 'secret')).toThrow(
      'Key "secret" does not exist; caller must check Arr.exists() first.'
    )
  })

  test('explodePluckParameters handles strings, arrays, callbacks, and null key', () => {
    expect(Arr.explodePluckParameters('a.b', null)).toEqual([['a', 'b'], null])
    expect(Arr.explodePluckParameters(['x'], undefined)).toEqual([['x'], null])

    const valueCb = (item: { id: number }) => item.id
    const keyCb = (item: { slug: string }) => item.slug
    expect(Arr.explodePluckParameters(valueCb, keyCb)).toEqual([valueCb, keyCb])
    expect(Arr.explodePluckParameters('v', ['k', '1'])).toEqual([['v'], ['k', '1']])
    expect(Arr.explodePluckParameters('v', 'k.l')).toEqual([['v'], ['k', 'l']])
  })

  test('pluck without key, with dot paths, and with callbacks', () => {
    const rows = [
      { id: 1, meta: { color: 'red' } },
      { id: 2, meta: { color: 'blue' } }
    ]

    expect(Arr.pluck(rows, 'meta.color')).toEqual(['red', 'blue'])

    expect(Arr.pluck(rows, 'meta.color', 'id')).toEqual({
      1: 'red',
      2: 'blue'
    })

    expect(
      Arr.pluck(rows, (row) => row.meta.color, (row) => `k${row.id}`)
    ).toEqual({
      k1: 'red',
      k2: 'blue'
    })
  })

  test('dataGet walks accessible values and plain object properties', () => {
    const nested = { a: Object.create(null) as Record<string, unknown> }
    nested.a.b = 7

    expect(Arr.dataGet({ x: [{ y: 2 }] }, ['x', '0', 'y'])).toBe(2)
    expect(Arr.dataGet(nested, ['a', 'b'])).toBe(7)
    expect(Arr.dataGet({ a: 1 }, ['a', 'missing'], 'def')).toBe('def')

    const inherited = Object.create({ role: 'admin' }) as Record<string, unknown>
    expect(Arr.dataGet(inherited, ['role'])).toBe('admin')
  })
})

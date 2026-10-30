import { beforeEach, describe, expect, test } from '@jest/globals'

import { Collection } from '../../src/Illuminate/Collections/Collection'
import { Repository } from '../../src/Illuminate/Config/Repository'

type ConfigValue =
  | string |
  number |
  boolean |
  undefined |
  null |
  ConfigValue[] |
  { [key: string]: ConfigValue }

type Config = { [key: string]: ConfigValue }

let repository: Repository
let config: Config

beforeEach(() => {
  config = {
    foo: 'bar',
    bar: 'baz',
    baz: 'bat',
    undefined,
    null: null,
    boolean: true,
    integer: 1,
    float: 1.1,
    associate: {
      x: 'xxx',
      y: 'yyy'
    },
    array: [
      'aaa',
      'zzz'
    ],
    x: {
      z: 'zoo'
    },
    'a.b': 'c',
    a: {
      'b.c': 'd'
    }
  }

  repository = new Repository(config/*  as Partial<LihtneConfig> */)
})

describe('Repository', () => {
  test('testGetValueWhenKeyContainDot', () => {
    expect(repository.get('a.b')).toBe('c')
    expect(repository.get('a.b.c')).toBeUndefined()
    expect(repository.get('x.y.z')).toBeUndefined()
    expect(repository.get('.')).toBeUndefined()
  })

  test('testGetBooleanValue', () => {
    expect(repository.get('boolean')).toBe(true)
  })

  test('testGetNullValue', () => {
    expect(repository.get('null')).toBeNull()
  })

  test('testGetUndefinedValue', () => {
    expect(repository.get('undefined')).toBeUndefined()
  })

  test('testConstruct', () => {
    expect(repository).toBeInstanceOf(Repository)
  })

  test('testHasIsTrue', () => {
    expect(repository.has('foo')).toBe(true)
  })

  test('testHasIsFalse', () => {
    expect(repository.has('not-exist')).toBe(false)
  })

  test('testGet', () => {
    expect(repository.get('foo')).toBe('bar')
  })

  test('testGetWithArrayOfKeys', () => {
    expect(repository.get([
      'foo',
      'bar',
      'none'
    ])).toEqual({
      foo: 'bar',
      bar: 'baz',
      none: undefined
    })

    expect(repository.get({
      'x.y': 'default',
      'x.z': 'default',
      bar: 'default',
      0: 'baz'
    })).toEqual({
      'x.y': 'default',
      'x.z': 'zoo',
      bar: 'baz',
      baz: 'bat'
    })
  })

  test('testGetMany', () => {
    expect(repository.getMany([
      'foo',
      'bar',
      'none'
    ])).toEqual({
      foo: 'bar',
      bar: 'baz',
      none: undefined
    })

    expect(repository.getMany({
      'x.y': 'default',
      'x.z': 'default',
      bar: 'default',
      0: 'baz'
    })).toEqual({
      'x.y': 'default',
      'x.z': 'zoo',
      bar: 'baz',
      baz: 'bat'
    })
  })

  test('testGetWithDefault', () => {
    expect(repository.get('not-exist', 'default')).toBe('default')
  })

  test('testSet', () => {
    repository.set('key', 'value')

    expect(repository.get('key')).toBe('value')
  })

  test('testSetArray', () => {
    repository.set({
      key1: 'value1',
      key2: 'value2',
      0: 'key3',
      key4: {
        foo: 'bar',
        bar: {
          foo: 'bar'
        }
      }
    })

    expect(repository.get('key1')).toBe('value1')
    expect(repository.get('key2')).toBe('value2')
    expect(repository.get('key3')).toBeUndefined()
    expect(repository.get('key4.foo')).toBe('bar')
    expect(repository.get('key4.bar.foo')).toBe('bar')
    expect(repository.get('key5')).toBeUndefined()
  })

  test('testPrepend', () => {
    expect(repository.get('array.0')).toBe('aaa')
    expect(repository.get('array.1')).toBe('zzz')

    repository.prepend('array', 'xxx')

    expect(repository.get('array.0')).toBe('xxx')
    expect(repository.get('array.1')).toBe('aaa')
    expect(repository.get('array.2')).toBe('zzz')
    expect(repository.get('array.3')).toBeUndefined()
    expect(repository.get('array')).toHaveLength(3)
  })

  test('testPush', () => {
    expect(repository.get('array.0')).toBe('aaa')
    expect(repository.get('array.1')).toBe('zzz')

    repository.push('array', 'xxx')

    expect(repository.get('array.0')).toBe('aaa')
    expect(repository.get('array.1')).toBe('zzz')
    expect(repository.get('array.2')).toBe('xxx')
    expect(repository.get('array')).toHaveLength(3)
  })

  test('testPrependWithNewKey', () => {
    repository.prepend('new_key', 'xxx')

    expect(repository.get('new_key')).toEqual(['xxx'])
  })

  test('testPushWithNewKey', () => {
    repository.push('new_key', 'xxx')

    expect(repository.get('new_key')).toEqual(['xxx'])
  })

  test('testAll', () => {
    expect(repository.all()).toEqual(config)
  })

  test('testOffsetExists', () => {
    repository.set({
      foo: 'bar',
      null_value: null,
      empty_string: '',
      numeric_value: 123
    })

    expect(repository.offsetExists('foo')).toBe(true)
    expect(repository.offsetExists('not-exist')).toBe(false)
    expect(repository.offsetExists('null_value')).toBe(true)
    expect(repository.offsetExists('empty_string')).toBe(true)
    expect(repository.offsetExists('numeric_value')).toBe(true)
    expect(repository.offsetExists('non_numeric')).toBe(false)
  })

  test('testOffsetGet', () => {
    expect(repository.offsetGet('not-exist')).toBeUndefined()
    expect(repository.offsetGet('foo')).toBe('bar')
    expect(repository.offsetGet('associate')).toEqual({
      x: 'xxx',
      y: 'yyy'
    })
  })

  test('testOffsetSet', () => {
    expect(repository.offsetGet('key')).toBeUndefined()

    repository.offsetSet('key', 'value')

    expect(repository.offsetGet('key')).toBe('value')

    repository.offsetSet('key', 'new_value')

    expect(repository.offsetGet('key')).toBe('new_value')

    repository.offsetSet('new_key', undefined)

    expect(repository.offsetGet('new_key')).toBeUndefined()

    repository.offsetSet('', 'value')

    expect(repository.offsetGet('')).toBe('value')

    repository.offsetSet(123, '123')

    expect(repository.offsetGet(123)).toBe('123')
  })

  test('testOffsetUnset', () => {
    expect(repository.all()).toHaveProperty('associate')
    expect(repository.get('associate')).toEqual(config.associate)

    repository.offsetUnset('associate')

    expect(repository.all()).toHaveProperty('associate')
    expect(repository.get('associate')).toBeUndefined()
  })

  test('testItIsMacroable', () => {
    repository.macro('foo', () => {
      return 'macroable'
    })

    expect(repository.foo()).toBe('macroable')
  })

  test('testItGetsAsString', () => {
    expect(repository.string('a.b')).toBe('c')
  })

  test('testItThrowsAnExceptionWhenTryingToGetNonStringValueAsString', () => {
    expect(() => repository.string('a')).toThrow(/^InvalidArgumentException: Configuration value for key \[a\] must be a string, (.*) given\./)
  })

  test('testItGetsAsArray', () => {
    expect(repository.array('array')).toEqual(['aaa', 'zzz'])
  })

  test('testItThrowsAnExceptionWhenTryingToGetNonArrayValueAsArray', () => {
    expect(() => repository.array('a.b')).toThrow(/Configuration value for key \[a\.b\] must be an array, (.*) given\./)
  })

  test('testItGetsAsCollection', () => {
    const collection = repository.collection('array')

    expect(collection).toBeInstanceOf(Collection)
    expect(collection.all()).toEqual(['aaa', 'zzz'])
  })

  test('testItGetsAsBoolean', () => {
    expect(repository.boolean('boolean')).toBe(true)
  })

  test('testItThrowsAnExceptionWhenTryingToGetNonBooleanValueAsBoolean', () => {
    expect(() => repository.boolean('a.b')).toThrow(/Configuration value for key \[a\.b\] must be a boolean, (.*) given\./)
  })

  test('testItGetsAsInteger', () => {
    expect(repository.integer('integer')).toBe(1)
  })

  test('testItThrowsAnExceptionWhenTryingToGetNonIntegerValueAsInteger', () => {
    expect(() => repository.integer('a.b')).toThrow(/Configuration value for key \[a\.b\] must be an integer, (.*) given\./)
  })

  test('testItGetsAsFloat', () => {
    expect(repository.float('float')).toBe(1.1)
  })

  test('testItThrowsAnExceptionWhenTryingToGetNonFloatValueAsFloat', () => {
    expect(() => repository.float('a.b')).toThrow(/^Configuration value for key \[a\.b\] must be a float, (.*) given\./)
  })
})

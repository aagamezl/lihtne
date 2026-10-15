import { describe, expect, test } from '@jest/globals'

import { HigherOrderWhenProxy } from '../../src/Illuminate/Conditionable/HigherOrderWhenProxy'
import { Conditionable } from '../../src/Illuminate/Conditionable/Traits/Conditionable'

class Example extends Conditionable {
  public readonly tag = 'example'
}

describe('Conditionable', () => {
  test('when applies callback when value is truthy', () => {
    const subject = new Example()
    const result = subject.when(true, (instance, condition) => {
      expect(condition).toBe(true)
      return instance.tag
    })

    expect(result).toBe('example')
  })

  test('when skips callback when value is falsy', () => {
    const subject = new Example()

    expect(subject.when(false, () => 'applied')).toBe(subject)
  })

  test('when supports default callback', () => {
    const subject = new Example()

    expect(subject.when(false, () => 'yes', () => 'no')).toBe('no')
  })

  test('when supports higher-order proxy forms', () => {
    const subject = new Example()

    expect(subject.when()).toBeInstanceOf(HigherOrderWhenProxy)
    expect(subject.when(true)).toBeInstanceOf(HigherOrderWhenProxy)
  })
})

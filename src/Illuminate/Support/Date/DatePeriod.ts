// Mirrors PHP's DatePeriod: https://www.php.net/manual/en/class.dateperiod.php

import { DateInterval, INVERT_PAST } from './DateInterval'

export const EXCLUDE_START_DATE = 1
export const INCLUDE_END_DATE = 2

const RECURRENCE_OFFSET = 1
const FLAG_UNSET = 0
const ISO8601_PERIOD_PATTERN = /^R(\d+)\/(.+)\/(.+)$/

const MONTHS_PER_YEAR = 12

/**
 * Applies a DateInterval to a Date, returning a new Date.
 * Mirrors how PHP's DateTime::add()/sub() advances calendar fields.
 */
function applyInterval (date: Date, interval: DateInterval, invert: boolean): Date {
  const sign = invert ? -1 : 1
  const result = new Date(date.getTime())

  const totalMonths = interval.y * MONTHS_PER_YEAR + interval.m

  if (totalMonths !== 0) {
    result.setMonth(result.getMonth() + sign * totalMonths)
  }

  if (interval.d !== 0) {
    result.setDate(result.getDate() + sign * interval.d)
  }

  if (interval.h !== 0) {
    result.setHours(result.getHours() + sign * interval.h)
  }

  if (interval.i !== 0) {
    result.setMinutes(result.getMinutes() + sign * interval.i)
  }

  if (interval.s !== 0) {
    result.setSeconds(result.getSeconds() + sign * interval.s)
  }

  return result
}

export class DatePeriod implements Iterable<Date> {
  readonly start: Date
  readonly interval: DateInterval
  readonly end: Date | null
  readonly recurrences: number | null
  readonly options: number

  /**
   * Overload 1: new DatePeriod(start, interval, end, options?)
   * Overload 2: new DatePeriod(start, interval, recurrences, options?)
   * Overload 3: new DatePeriod(isoString, options?)
   */
  constructor (
    start: Date | string,
    interval?: DateInterval,
    endOrRecurrences?: Date | number,
    options: number = FLAG_UNSET
  ) {
    if (typeof start === 'string') {
      const parsed = DatePeriod.parseIso8601(start)

      this.start = parsed.start
      this.interval = parsed.interval
      this.end = parsed.end
      this.recurrences = parsed.recurrences
      this.options = typeof interval === 'number' ? interval : FLAG_UNSET

      return
    }

    if (interval === undefined) {
      throw new Error('DatePeriod: an interval is required')
    }

    this.start = start
    this.interval = interval
    this.options = options

    if (endOrRecurrences instanceof Date) {
      this.end = endOrRecurrences
      this.recurrences = null
      return
    }

    if (typeof endOrRecurrences === 'number') {
      this.end = null
      this.recurrences = endOrRecurrences
      return
    }

    throw new Error('DatePeriod: an end date or recurrence count is required')
  }

  private static parseIso8601 (spec: string): {
    start: Date
    interval: DateInterval
    end: Date | null
    recurrences: number | null
  } {
    const match = ISO8601_PERIOD_PATTERN.exec(spec)

    if (match === null) {
      throw new Error(`DatePeriod: Unknown or bad format (${spec})`)
    }

    const [, recurrenceCount, startOrIntervalToken, intervalOrEndToken] = match

    const startCandidate = new Date(startOrIntervalToken)
    const startIsDate = !Number.isNaN(startCandidate.getTime())

    const start = startIsDate ? startCandidate : new Date(intervalOrEndToken)
    const intervalSpec = startIsDate ? intervalOrEndToken : startOrIntervalToken
    const interval = new DateInterval(intervalSpec)

    const endCandidate = new Date(intervalOrEndToken)
    const endIsDate = startIsDate && !Number.isNaN(endCandidate.getTime())

    return {
      start,
      interval,
      end: endIsDate ? endCandidate : null,
      recurrences: endIsDate ? null : parseInt(recurrenceCount, 10)
    }
  }

  private includesStart (): boolean {
    return (this.options & EXCLUDE_START_DATE) === FLAG_UNSET
  }

  private includesEnd (): boolean {
    return (this.options & INCLUDE_END_DATE) !== FLAG_UNSET
  }

  getStartDate (): Date {
    return this.start
  }

  getEndDate (): Date | null {
    return this.end
  }

  getDateInterval (): DateInterval {
    return this.interval
  }

  getRecurrences (): number | null {
    return this.recurrences
  }

  * [Symbol.iterator] (): Iterator<Date> {
    if (this.recurrences !== null) {
      yield * this.iterateByRecurrences(this.recurrences)
      return
    }

    if (this.end !== null) {
      yield * this.iterateByEndDate(this.end)
    }
  }

  /**
   * Recurrence-bounded period: always walks exactly
   * `recurrences + 1` calendar points (start plus N steps),
   * then EXCLUDE_START_DATE simply omits the first of those points.
   */
  private * iterateByRecurrences (recurrences: number): Generator<Date> {
    const invert = this.interval.invert === INVERT_PAST
    const totalPoints = recurrences + RECURRENCE_OFFSET
    let current = this.start

    for (let index = FLAG_UNSET; index < totalPoints; index += 1) {
      const isFirst = index === FLAG_UNSET

      if (!isFirst || this.includesStart()) {
        yield current
      }

      current = applyInterval(current, this.interval, invert)
    }
  }

  /**
   * End-date-bounded period: walks forward while strictly before
   * `end`, then INCLUDE_END_DATE additionally yields `end` itself
   * when the walk lands exactly on it.
   */
  private * iterateByEndDate (end: Date): Generator<Date> {
    const invert = this.interval.invert === INVERT_PAST
    let current = this.start
    let isFirst = true

    while (current.getTime() < end.getTime()) {
      if (!isFirst || this.includesStart()) {
        yield current
      }

      current = applyInterval(current, this.interval, invert)
      isFirst = false
    }

    if (this.includesEnd() && current.getTime() === end.getTime()) {
      yield current
    }
  }

  toArray (): Date[] {
    return [...this]
  }
}

// Mirrors PHP's DateInterval: https://www.php.net/manual/en/class.dateinterval.php

const ISO8601_DURATION_PATTERN =
  /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/

const WEEKS_PER_DAYS_DIVISOR = 7

const SECONDS_PER_MINUTE = 60
const MINUTES_PER_HOUR = 60
const HOURS_PER_DAY = 24

export const MILLISECONDS_PER_SECOND = 1000
export const SECONDS_PER_MILLISECOND_INVERSE = MILLISECONDS_PER_SECOND
export const SECONDS_PER_MINUTE_UNIT = SECONDS_PER_MINUTE
export const SECONDS_PER_HOUR_UNIT = SECONDS_PER_MINUTE * MINUTES_PER_HOUR
export const SECONDS_PER_DAY_UNIT = SECONDS_PER_HOUR_UNIT * HOURS_PER_DAY
export const INVERT_FUTURE = 0
export const INVERT_PAST = 1

const MONTHS_PER_YEAR = 12
const APPROXIMATE_DAYS_PER_MONTH = 30
const APPROXIMATE_DAYS_PER_YEAR = 365

const UNKNOWN_DAYS = false

export interface DateIntervalParts {
  years?: number
  months?: number
  days?: number
  hours?: number
  minutes?: number
  seconds?: number
  invert?: 0 | 1
}

/**
 * Represents a duration of time, mirroring PHP's DateInterval.
 *
 * Supports construction from an ISO 8601 duration spec string
 * (e.g. "P1Y2M3DT4H5M6S") or from an object of component parts.
 */
export class DateInterval {
  y: number
  m: number
  d: number
  h: number
  i: number
  s: number
  f: number
  invert: 0 | 1
  days: number | false

  constructor (spec: string | DateIntervalParts = {}) {
    const parts = typeof spec === 'string'
      ? DateInterval.parseSpec(spec)
      : spec

    this.y = parts.years ?? 0
    this.m = parts.months ?? 0
    this.d = parts.days ?? 0
    this.h = parts.hours ?? 0
    this.i = parts.minutes ?? 0
    this.s = parts.seconds ?? 0
    this.f = 0
    this.invert = parts.invert ?? INVERT_FUTURE
    this.days = UNKNOWN_DAYS
  }

  private static parseSpec (spec: string): DateIntervalParts {
    const match = ISO8601_DURATION_PATTERN.exec(spec)

    if (match === null) {
      throw new Error(`DateInterval: Unknown or bad format (${spec})`)
    }

    const [, years, months, days, hours, minutes, seconds] = match

    if (
      years === undefined &&
      months === undefined &&
      days === undefined &&
      hours === undefined &&
      minutes === undefined &&
      seconds === undefined
    ) {
      throw new Error(`DateInterval: Unknown or bad format (${spec})`)
    }

    return {
      years: years === undefined ? 0 : parseInt(years, 10),
      months: months === undefined ? 0 : parseInt(months, 10),
      days: days === undefined ? 0 : parseInt(days, 10),
      hours: hours === undefined ? 0 : parseInt(hours, 10),
      minutes: minutes === undefined ? 0 : parseInt(minutes, 10),
      seconds: seconds === undefined ? 0 : parseInt(seconds, 10)
    }
  }

  /**
   * Mirrors DateInterval::createFromDateString().
   * Supports a subset of PHP's relative date string grammar.
   */
  static createFromDateString (datetime: string): DateInterval {
    const interval = new DateInterval()
    const unitPattern = /([+-]?\d+)\s*(year|month|week|day|hour|minute|min|second|sec)s?/gi

    let match = unitPattern.exec(datetime)

    if (match === null) {
      return interval
    }

    while (match !== null) {
      const value = parseInt(match[1], 10)
      const unit = match[2].toLowerCase()

      DateInterval.applyUnit(interval, unit, value)

      match = unitPattern.exec(datetime)
    }

    return interval
  }

  private static applyUnit (interval: DateInterval, unit: string, value: number): void {
    if (unit === 'year') {
      interval.y += value
      return
    }

    if (unit === 'month') {
      interval.m += value
      return
    }

    if (unit === 'week') {
      interval.d += value * WEEKS_PER_DAYS_DIVISOR
      return
    }

    if (unit === 'day') {
      interval.d += value
      return
    }

    if (unit === 'hour') {
      interval.h += value
      return
    }

    if (unit === 'minute' || unit === 'min') {
      interval.i += value
      return
    }

    interval.s += value
  }

  /**
   * Mirrors DateInterval::format(). Supported specifiers:
   * %Y %y %M %m %D %d %a %H %h %I %i %S %s %R %r %%
   */
  format (formatStr: string): string {
    const replacements: Record<string, string> = {
      '%%': '%',
      '%Y': String(this.y).padStart(4, '0'),
      '%y': String(this.y),
      '%M': String(this.m).padStart(2, '0'),
      '%m': String(this.m),
      '%D': String(this.d).padStart(2, '0'),
      '%d': String(this.d),
      '%a': this.days === UNKNOWN_DAYS ? '(unknown)' : String(this.days),
      '%H': String(this.h).padStart(2, '0'),
      '%h': String(this.h),
      '%I': String(this.i).padStart(2, '0'),
      '%i': String(this.i),
      '%S': String(this.s).padStart(2, '0'),
      '%s': String(this.s),
      '%R': this.invert === INVERT_PAST ? '-' : '+',
      '%r': this.invert === INVERT_PAST ? '-' : ''
    }

    const specifierPattern = /%[%YyMmDdaHhIiSsRr]/g

    return formatStr.replace(specifierPattern, (token) => replacements[token] ?? token)
  }

  /**
   * Approximate total number of seconds this interval represents,
   * treating months as 30 days and years as 365 days (PHP has no
   * exact equivalent either, since months/years vary in length).
   */
  toApproximateSeconds (): number {
    const totalDays = this.d +
      this.m * APPROXIMATE_DAYS_PER_MONTH +
      this.y * APPROXIMATE_DAYS_PER_YEAR

    const totalSeconds = totalDays * SECONDS_PER_DAY_UNIT +
      this.h * SECONDS_PER_HOUR_UNIT +
      this.i * SECONDS_PER_MINUTE_UNIT +
      this.s

    return this.invert === INVERT_PAST ? -totalSeconds : totalSeconds
  }

  /**
   * Returns a new Date advanced by this interval.
   * Mirrors PHP's DateTime::add().
   */
  addTo (date: Date): Date {
    const sign = this.invert === INVERT_PAST ? -1 : 1
    const result = new Date(date.getTime())
    const totalMonths = this.y * MONTHS_PER_YEAR + this.m

    if (totalMonths !== 0) {
      result.setMonth(result.getMonth() + sign * totalMonths)
    }

    if (this.d !== 0) {
      result.setDate(result.getDate() + sign * this.d)
    }

    if (this.h !== 0) {
      result.setHours(result.getHours() + sign * this.h)
    }

    if (this.i !== 0) {
      result.setMinutes(result.getMinutes() + sign * this.i)
    }

    if (this.s !== 0) {
      result.setSeconds(result.getSeconds() + sign * this.s)
    }

    return result
  }

  clone (): DateInterval {
    const copy = new DateInterval({
      years: this.y,
      months: this.m,
      days: this.d,
      hours: this.h,
      minutes: this.i,
      seconds: this.s,
      invert: this.invert
    })

    copy.days = this.days

    return copy
  }
}

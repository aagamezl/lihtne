// carbon.ts
import dayjs, { type Dayjs, type ManipulateType } from 'dayjs'

const DEFAULT_UNIT: ManipulateType = 'day'

export class Carbon {
  private instance: Dayjs

  private constructor (instance: Dayjs) {
    this.instance = instance
  }

  public static now (): Carbon {
    return new Carbon(dayjs())
  }

  public static today (): Carbon {
    return Carbon.now().startOfDay()
  }

  public static parse (input: string | Date): Carbon {
    return new Carbon(dayjs(input))
  }

  public addDays (amount: number): Carbon {
    return new Carbon(this.instance.add(amount, DEFAULT_UNIT))
  }

  public subDays (amount: number): Carbon {
    return new Carbon(this.instance.subtract(amount, DEFAULT_UNIT))
  }

  public startOfDay (): Carbon {
    return new Carbon(this.instance.startOf(DEFAULT_UNIT))
  }

  public endOfDay (): Carbon {
    return new Carbon(this.instance.endOf(DEFAULT_UNIT))
  }

  public toDate (): Date {
    return this.instance.toDate()
  }

  // Lets `Carbon` instances compare equal to each other and to plain Dates
  // in assertion libraries that call valueOf() / toJSON() under the hood
  public valueOf (): number {
    return this.instance.valueOf()
  }

  public addMonth (amount: number = 1): Carbon {
    return new Carbon(this.instance.add(amount, 'month'))
  }

  public addDay (amount: number = 1): Carbon {
    return new Carbon(this.instance.add(amount, 'day'))
  }

  public addYear (amount: number = 1): Carbon {
    return new Carbon(this.instance.add(amount, 'year'))
  }

  public toJSON (): string {
    return this.instance.toJSON()
  }
}

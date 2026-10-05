import { Driver, type DriverOptions } from './Driver'

export class SQLiteDriver extends Driver {
  constructor (dsn: string, options: DriverOptions) {
    super(dsn, options)

    this.driverTitle = 'sqlite'
  }
}

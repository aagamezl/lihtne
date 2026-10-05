import { Driver, type DriverOptions } from './Driver'

export class SqlServerDriver extends Driver {
  constructor (dsn: string, options: DriverOptions) {
    super(dsn, options)

    this.driverTitle = 'mysql'
  }
}

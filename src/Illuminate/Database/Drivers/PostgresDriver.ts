import { Driver, type DriverOptions } from './Driver'

export class PostgresDriver extends Driver {
  constructor (dsn: string, options: DriverOptions) {
    super(dsn, options)

    this.driverTitle = 'pgsql'
  }
}

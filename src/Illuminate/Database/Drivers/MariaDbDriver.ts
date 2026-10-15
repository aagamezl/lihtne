import { Driver, type DriverOptions } from './Driver'

export class MariaDBDriver extends Driver {
  constructor (dsn: string, options: DriverOptions) {
    super(dsn, options)

    this.driverTitle = 'mariadb'
  }
}

import AbstractPostgreSQLDriver from '../../../Doctrine/Driver/AbstractPostgreSQLDriver.js'
import use from '../../Support/Traits/use.js'
import ConnectsToDatabase from './Concerns/ConnectsToDatabase.js'

export default class PostgresDriver extends AbstractPostgreSQLDriver {
  constructor () {
    super()

    use(this, ConnectsToDatabase)
  }

  /**
   * {@inheritdoc}
   */
  getName () {
    return 'pgsql'
  }
}

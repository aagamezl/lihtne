import AbstractMySQLDriver from '../../../Doctrine/Driver/AbstractMySQLDriver.js'
import use from '../../Support/Traits/use.js'
import ConnectsToDatabase from './Concerns/ConnectsToDatabase.js'

export default class MySqlDriver extends AbstractMySQLDriver {
  constructor () {
    super()

    // use(this.constructor, ConnectsToDatabase)
    use(MySqlDriver, ConnectsToDatabase)
  }

  /**
   * {@inheritdoc}
   */
  getName () {
    return 'mysql'
  }
}

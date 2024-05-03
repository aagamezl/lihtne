import ConnectionFactory from '../../Database/Connectors/ConnectionFactory.js'
import Container from '../../Container/Container.js'
import DatabaseManager from '../../Database/DatabaseManager.js'
import Repository from '../../Config/Repository.js'
import InstanceProxy from '../../Support/Proxies/InstanceProxy.js'

export default class Application extends Container {
  constructor () {
    super()

    this.registerCoreContainerAliases()

    return InstanceProxy(this, {
      get: (target, key, receiver) => {
        if (key in target) {
          return target[key]
        }

        return receiver.make(target.getAlias(key))
      }
    })
  }

  /**
* Register the core class aliases in the container.
*
* @return {void}
*/
  registerCoreContainerAliases () {
    /** @type {import('../../Container/Container.js').Aliases} */
    const aliases = {
      app: { abstract: Application },
      config: { abstract: Repository },
      db: {
        abstract: DatabaseManager,
        dependencies: [this.constructor, ConnectionFactory]
      }
    }

    for (const [alias, { abstract, dependencies }] of Object.entries(aliases)) {
      this.alias(alias, abstract, dependencies)
    }
  }
}

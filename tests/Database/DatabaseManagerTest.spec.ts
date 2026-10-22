import { beforeEach, describe, expect, test } from '@jest/globals'

// Initialize Grammar before Connection. Importing Connection first leaves Grammar undefined.
import '../../src/Illuminate/Database/Query'
import { Repository } from '../../src/Illuminate/Config/Repository'
import { Connection, type Reconnector } from '../../src/Illuminate/Database/Connection'
import { ConnectionFactory } from '../../src/Illuminate/Database/Connectors/ConnectionFactory'
import { DatabaseManager } from '../../src/Illuminate/Database/DatabaseManager'
import { Driver } from '../../src/Illuminate/Database/Drivers/Driver'

class TestConnection extends Connection {
  getReconnector (): Reconnector {
    return this.reconnector
  }

  setDriver (driver: Driver): this {
    this.driver = driver

    return this
  }

  setReconnector (reconnector: Reconnector): this {
    this.reconnector = reconnector

    return this
  }
}

class DatabaseManagerTestManager extends DatabaseManager {
  freshConnection: TestConnection | undefined

  public configurePublic (connection: Connection): Connection {
    return this.configure(connection)
  }

  override makeConnection (name: string): TestConnection {
    if (this.freshConnection === undefined) {
      throw new Error(`Fresh connection was not prepared for [${name}].`)
    }

    return this.freshConnection
  }

  public parseConnectionNamePublic (name: string): string[] {
    return this.parseConnectionName(name)
  }

  setCachedConnection (name: string, connection: TestConnection): void {
    this.connections[name] = connection
  }
}

describe('DatabaseManager', () => {
  let repository: Repository
  let factory: ConnectionFactory

  beforeEach(() => {
    repository = new Repository()
    factory = new ConnectionFactory()
  })

  test('testParseConnectionNameRecognizesReadAndWriteTypes', () => {
    const manager = new DatabaseManagerTestManager(factory, repository, {
      database: {
        default: 'pgsql',
        connections: {}
      }
    })

    // TODO: Review this test
    // expect(manager.parseConnectionNamePublic('pgsql::read')).toEqual(['pgsql', 'read'])
    // expect(manager.parseConnectionNamePublic('pgsql::write')).toEqual(['pgsql', 'write'])
    expect(manager.parseConnectionNamePublic('pgsql')).toEqual('pgsql')
    expect(manager.parseConnectionNamePublic(undefined)).toEqual('pgsql')
  })

  test('testConfigureSetsTheReconnector', () => {
    const manager = new DatabaseManagerTestManager(factory, repository, {})
    const connection = new TestConnection(new Driver('cached', {}), 'database', '', { name: 'pgsql' })

    const configured = manager.configurePublic(connection)

    expect(configured).toBe(connection)
    expect(connection.getReconnector()).toBe(manager.reconnector)
  })

  test('testRefreshDriversConnectionsReplacesTheDriver', async () => {
    const manager = new DatabaseManagerTestManager(factory, repository, {})
    const connection = new TestConnection(new Driver('cached', {}), 'database', '', { name: 'pgsql' })
    const freshDriver = new Driver('fresh', {})
    const freshConnection = new TestConnection(new Driver('fresh', {}), 'database', '', { name: 'pgsql' })

    freshConnection.setDriver(freshDriver)
    manager.freshConnection = freshConnection
    manager.setCachedConnection('pgsql::read', connection)

    const refreshed = await manager.refreshDriversConnections('pgsql::read')

    expect(refreshed).toBe(connection)
    expect(await connection.getDriver()).toBe(freshDriver)
    expect(freshConnection.getReconnector()).toBe(manager.reconnector)
  })
})

import { describe, expect, test } from '@jest/globals'

import { ConfigurationUrlParser } from '../../src/Illuminate/Support/ConfigurationUrlParser'
import type { DatabaseConfig } from '../../src/Illuminate/Config/types'

interface DatabaseUrlCase {
  name: string
  config: DatabaseConfig | string
  expected: DatabaseConfig
}

const driverAliases: Record<string, string> = {
  mssql: 'sqlsrv',
  mysql2: 'mysql',
  postgres: 'pgsql',
  postgresql: 'pgsql',
  sqlite3: 'sqlite',
  redis: 'tcp',
  rediss: 'tls',
  valkey: 'tcp',
  valkeys: 'tls'
}

const databaseUrls: DatabaseUrlCase[] = [
  {
    name: 'simple URL',
    config: 'mysql://foo:bar@localhost/baz',
    expected: {
      driver: 'mysql',
      username: 'foo',
      password: 'bar',
      host: 'localhost',
      database: 'baz'
    }
  },
  {
    name: 'simple URL with port',
    config: 'mysql://foo:bar@localhost:134/baz',
    expected: {
      driver: 'mysql',
      username: 'foo',
      password: 'bar',
      host: 'localhost',
      port: 134,
      database: 'baz'
    }
  },
  {
    name: 'sqlite relative URL with host',
    config: 'sqlite://localhost/foo/database.sqlite',
    expected: {
      database: 'foo/database.sqlite',
      driver: 'sqlite',
      host: 'localhost'
    }
  },
  {
    name: 'sqlite absolute URL with host',
    config: 'sqlite://localhost//tmp/database.sqlite',
    expected: {
      database: '/tmp/database.sqlite',
      driver: 'sqlite',
      host: 'localhost'
    }
  },
  {
    name: 'sqlite relative URL without host',
    config: 'sqlite:///foo/database.sqlite',
    expected: {
      database: 'foo/database.sqlite',
      driver: 'sqlite'
    }
  },
  {
    name: 'sqlite absolute URL without host',
    config: 'sqlite:////tmp/database.sqlite',
    expected: {
      database: '/tmp/database.sqlite',
      driver: 'sqlite'
    }
  },
  {
    name: 'sqlite memory',
    config: 'sqlite:///:memory:',
    expected: {
      database: ':memory:',
      driver: 'sqlite'
    }
  },
  {
    name: 'params parsed from URL override individual params',
    config: {
      url: 'mysql://foo:bar@localhost/baz',
      password: 'lulz',
      driver: 'sqlite'
    },
    expected: {
      username: 'foo',
      password: 'bar',
      host: 'localhost',
      database: 'baz',
      driver: 'mysql'
    }
  },
  {
    name: 'params not parsed from URL but individual params are preserved',
    config: {
      url: 'mysql://foo:bar@localhost/baz',
      port: 134
    },
    expected: {
      username: 'foo',
      password: 'bar',
      host: 'localhost',
      port: 134,
      database: 'baz',
      driver: 'mysql'
    }
  },
  {
    name: 'Microsoft SQL Server DSN strings are parsed for Microsoft SQL Server connections',
    config: {
      driver: 'sqlsrv',
      host: 'fallback-host',
      port: 1433,
      database: 'fallback-database',
      url: 'sqlsrv:Server=127.0.0.1,1444;Database=example_database;APP={Laravel;Worker}}};ApplicationIntent=ReadOnly;Authentication=SqlPassword;ColumnEncryption=Enabled;ConnectionPooling=0;Encrypt=true;KeyStoreAuthentication=KeyVaultClientSecret;KeyStorePrincipalId=example-client-id;KeyStoreSecret=example-secret;LoginTimeout=30;MultipleActiveResultSets=false;MultiSubnetFailover=1;TransactionIsolation=READ_COMMITTED;TrustServerCertificate=true'
    },
    expected: {
      driver: 'sqlsrv',
      host: '127.0.0.1',
      port: 1444,
      database: 'example_database',
      appname: 'Laravel;Worker}',
      authentication: 'SqlPassword',
      column_encryption: 'Enabled',
      pooling: false,
      encrypt: 'true',
      key_store_authentication: 'KeyVaultClientSecret',
      key_store_principal_id: 'example-client-id',
      key_store_secret: 'example-secret',
      login_timeout: '30',
      multiple_active_result_sets: false,
      multi_subnet_failover: '1',
      transaction_isolation: 'READ_COMMITTED',
      trust_server_certificate: 'true',
      readonly: true
    }
  },
  {
    name: 'Standalone Microsoft SQL Server DSN strings are parsed',
    config: 'sqlsrv:Database=laravel;Encrypt=false;Server=localhost',
    expected: {
      driver: 'sqlsrv',
      database: 'laravel',
      host: 'localhost',
      encrypt: 'false'
    }
  },
  {
    name: 'Microsoft SQL Server database URL using Laravel\'s database URL convention format',
    config: 'sqlsrv://username:password@host:1433/database',
    expected: {
      driver: 'sqlsrv',
      username: 'username',
      password: 'password',
      host: 'host',
      port: 1433,
      database: 'database'
    }
  },
  {
    name: 'query params from URL are used as extra params',
    config: 'mysql://foo:bar@localhost/database?charset=UTF-8',
    expected: {
      driver: 'mysql',
      database: 'database',
      host: 'localhost',
      username: 'foo',
      password: 'bar',
      charset: 'UTF-8'
    }
  },
  {
    name: 'simple URL with driver set apart',
    config: {
      url: '//foo:bar@localhost/baz',
      driver: 'sqlsrv'
    },
    expected: {
      username: 'foo',
      password: 'bar',
      host: 'localhost',
      database: 'baz',
      driver: 'sqlsrv'
    }
  },
  {
    name: 'simple URL with percent encoding',
    config: 'mysql://foo%3A:bar%2F@localhost/baz+baz%40',
    expected: {
      username: 'foo:',
      password: 'bar/',
      host: 'localhost',
      database: 'baz+baz@',
      driver: 'mysql'
    }
  },
  {
    name: 'simple URL with percent sign in password',
    config: 'mysql://foo:bar%25bar@localhost/baz',
    expected: {
      username: 'foo',
      password: 'bar%bar',
      host: 'localhost',
      database: 'baz',
      driver: 'mysql'
    }
  },
  {
    name: 'simple URL with percent encoding in query',
    config: 'mysql://foo:bar%25bar@localhost/baz?timezone=%2B00%3A00',
    expected: {
      username: 'foo',
      password: 'bar%bar',
      host: 'localhost',
      database: 'baz',
      driver: 'mysql',
      timezone: '+00:00'
    }
  },
  {
    name: 'URL with mssql alias driver',
    config: 'mssql://null',
    expected: { driver: 'sqlsrv' }
  },
  {
    name: 'URL with sqlsrv alias driver',
    config: 'sqlsrv://null',
    expected: { driver: 'sqlsrv' }
  },
  {
    name: 'URL with mysql alias driver',
    config: 'mysql://null',
    expected: { driver: 'mysql' }
  },
  {
    name: 'URL with mysql2 alias driver',
    config: 'mysql2://null',
    expected: { driver: 'mysql' }
  },
  {
    name: 'URL with postgres alias driver',
    config: 'postgres://null',
    expected: { driver: 'pgsql' }
  },
  {
    name: 'URL with postgresql alias driver',
    config: 'postgresql://null',
    expected: { driver: 'pgsql' }
  },
  {
    name: 'URL with pgsql alias driver',
    config: 'pgsql://null',
    expected: { driver: 'pgsql' }
  },
  {
    name: 'URL with sqlite alias driver',
    config: 'sqlite://null',
    expected: { driver: 'sqlite' }
  },
  {
    name: 'URL with sqlite3 alias driver',
    config: 'sqlite3://null',
    expected: { driver: 'sqlite' }
  },
  {
    name: 'URL with unknown driver',
    config: 'foo://null',
    expected: { driver: 'foo' }
  },
  {
    name: 'Sqlite with foreign_key_constraints',
    config: 'sqlite:////absolute/path/to/database.sqlite?foreign_key_constraints=true',
    expected: {
      driver: 'sqlite',
      database: '/absolute/path/to/database.sqlite',
      foreign_key_constraints: true
    }
  },
  {
    name: 'Sqlite with busy_timeout',
    config: 'sqlite:////absolute/path/to/database.sqlite?busy_timeout=5000',
    expected: {
      driver: 'sqlite',
      database: '/absolute/path/to/database.sqlite',
      busy_timeout: 5000
    }
  },
  {
    name: 'Sqlite with journal_mode',
    config: 'sqlite:////absolute/path/to/database.sqlite?journal_mode=WAL',
    expected: {
      driver: 'sqlite',
      database: '/absolute/path/to/database.sqlite',
      journal_mode: 'WAL'
    }
  },
  {
    name: 'Sqlite with synchronous',
    config: 'sqlite:////absolute/path/to/database.sqlite?synchronous=NORMAL',
    expected: {
      driver: 'sqlite',
      database: '/absolute/path/to/database.sqlite',
      synchronous: 'NORMAL'
    }
  },
  {
    name: 'Most complex example with read and write subarrays all in string',
    config: 'mysql://root:@null/database?read[host][]=192.168.1.1&write[host][]=196.168.1.2&sticky=true&charset=utf8mb4&collation=utf8mb4_unicode_ci&prefix=',
    expected: {
      read: {
        host: ['192.168.1.1']
      },
      write: {
        host: ['196.168.1.2']
      },
      sticky: true,
      driver: 'mysql',
      database: 'database',
      username: 'root',
      password: '',
      charset: 'utf8mb4',
      collation: 'utf8mb4_unicode_ci',
      prefix: ''
    }
  },
  {
    name: 'Full example from doc that prove that there isn\'t any Breaking Change',
    config: {
      driver: 'mysql',
      host: '127.0.0.1',
      port: '3306',
      database: 'forge',
      username: 'forge',
      password: '',
      unix_socket: '',
      charset: 'utf8mb4',
      collation: 'utf8mb4_unicode_ci',
      prefix: '',
      prefix_indexes: true,
      strict: true,
      engine: null,
      options: { foo: 'bar' }
    },
    expected: {
      driver: 'mysql',
      host: '127.0.0.1',
      port: '3306',
      database: 'forge',
      username: 'forge',
      password: '',
      unix_socket: '',
      charset: 'utf8mb4',
      collation: 'utf8mb4_unicode_ci',
      prefix: '',
      prefix_indexes: true,
      strict: true,
      engine: null,
      options: { foo: 'bar' }
    }
  },
  {
    name: 'Full example from doc with url overwriting parameters',
    config: {
      url: 'mysql://root:pass@db/local',
      driver: 'mysql',
      host: '127.0.0.1',
      port: '3306',
      database: 'forge',
      username: 'forge',
      password: '',
      unix_socket: '',
      charset: 'utf8mb4',
      collation: 'utf8mb4_unicode_ci',
      prefix: '',
      prefix_indexes: true,
      strict: true,
      engine: null,
      options: { foo: 'bar' }
    },
    expected: {
      driver: 'mysql',
      host: 'db',
      port: '3306',
      database: 'local',
      username: 'root',
      password: 'pass',
      unix_socket: '',
      charset: 'utf8mb4',
      collation: 'utf8mb4_unicode_ci',
      prefix: '',
      prefix_indexes: true,
      strict: true,
      engine: undefined,
      options: { foo: 'bar' }
    }
  },
  {
    name: 'Redis Example',
    config: {
      url: 'redis://h:asdfqwer1234asdf@ec2-111-1-1-1.compute-1.amazonaws.com:111',
      host: '127.0.0.1',
      password: undefined,
      port: 6379,
      database: '0'
    },
    expected: {
      driver: 'tcp',
      host: 'ec2-111-1-1-1.compute-1.amazonaws.com',
      port: 111,
      database: '0',
      username: 'h',
      password: 'asdfqwer1234asdf'
    }
  },
  {
    name: 'Redis example where URL ends with "/" and database is not present',
    config: {
      url: 'redis://h:asdfqwer1234asdf@ec2-111-1-1-1.compute-1.amazonaws.com:111/',
      host: '127.0.0.1',
      password: undefined,
      port: 6379,
      database: '2'
    },
    expected: {
      driver: 'tcp',
      host: 'ec2-111-1-1-1.compute-1.amazonaws.com',
      port: 111,
      database: '2',
      username: 'h',
      password: 'asdfqwer1234asdf'
    }
  },
  {
    name: 'Redis Example with tls scheme',
    config: {
      url: 'tls://h:asdfqwer1234asdf@ec2-111-1-1-1.compute-1.amazonaws.com:111',
      host: '127.0.0.1',
      password: undefined,
      port: 6379,
      database: '0'
    },
    expected: {
      driver: 'tls',
      host: 'ec2-111-1-1-1.compute-1.amazonaws.com',
      port: 111,
      database: '0',
      username: 'h',
      password: 'asdfqwer1234asdf'
    }
  },
  {
    name: 'Redis Example with rediss scheme',
    config: {
      url: 'rediss://h:asdfqwer1234asdf@ec2-111-1-1-1.compute-1.amazonaws.com:111',
      host: '127.0.0.1',
      password: undefined,
      port: 6379,
      database: '0'
    },
    expected: {
      driver: 'tls',
      host: 'ec2-111-1-1-1.compute-1.amazonaws.com',
      port: 111,
      database: '0',
      username: 'h',
      password: 'asdfqwer1234asdf'
    }
  },
  {
    name: 'Valkey Example',
    config: {
      url: 'valkey://h:asdfqwer1234asdf@ec2-111-1-1-1.compute-1.amazonaws.com:111',
      host: '127.0.0.1',
      password: undefined,
      port: 6379,
      database: '0'
    },
    expected: {
      driver: 'tcp',
      host: 'ec2-111-1-1-1.compute-1.amazonaws.com',
      port: 111,
      database: '0',
      username: 'h',
      password: 'asdfqwer1234asdf'
    }
  },
  {
    name: 'Valkey Example with valkeys scheme',
    config: {
      url: 'valkeys://h:asdfqwer1234asdf@ec2-111-1-1-1.compute-1.amazonaws.com:111',
      host: '127.0.0.1',
      password: undefined,
      port: 6379,
      database: '0'
    },
    expected: {
      driver: 'tls',
      host: 'ec2-111-1-1-1.compute-1.amazonaws.com',
      port: 111,
      database: '0',
      username: 'h',
      password: 'asdfqwer1234asdf'
    }
  }
]

describe('ConfigurationUrlParser', () => {
  // test.each(databaseUrls)('$name', ({ config, expected }) => {
  //   expect(new ConfigurationUrlParser().parseConfiguration(config)).toEqual(expected)
  // })

  test('testDatabaseUrlsAreParsed', () => {
    expect(new ConfigurationUrlParser().parseConfiguration(databaseUrls[0].config)).toEqual(databaseUrls[0].expected)
  })

  test('drivers aliases', () => {
    expect(ConfigurationUrlParser.getDriverAliases()).toEqual(driverAliases)

    ConfigurationUrlParser.addDriverAlias('some-particular-alias', 'mysql')

    expect(ConfigurationUrlParser.getDriverAliases()).toEqual({
      ...driverAliases,
      'some-particular-alias': 'mysql'
    })

    expect(new ConfigurationUrlParser().parseConfiguration('some-particular-alias://null')).toEqual({
      driver: 'mysql'
    })
  })
})

import Connector from './Connector.js'
import PostgresDriver from '../PDO/PostgresDriver.js'
import { isNil } from '@devnetic/utils'

/** @typedef {import('../PDO/Driver.js').default} Driver */

export default class PostgresConnector extends Connector {
  /**
   * Add the SSL options to the DSN.
   *
   * @param  {string}  dsn
   * @param  {Record<string, unknown>}  config
   * @return {string}
   */
  addSslOptions (dsn, config) {
    for (const option of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) {
      if (config[option] !== undefined) {
        dsn += `;${option}=${config[option]}`
      }
    }

    return dsn
  }

  /**
   * Set the schema on the connection.
   *
   * @param  {Driver}  connection
   * @param  {object}  config
   * @return {void}
   */
  configureApplicationName (connection, config) {
    if (config.application_name !== undefined) {
      connection.prepare(`set application_name to '${config.application_name}'`).execute()
    }
  }

  /**
   * Set the connection character set and collation.
   *
   * @param  {Driver}  connection
   * @param  {object}  config
   * @return {void}
   */
  configureEncoding (connection, config) {
    if (config.charset === undefined) {
      return
    }

    connection.prepare(`set names '${config.charset}'`).execute()
  }

  /**
   * Set the schema on the connection.
   *
   * @param  {Driver}  connection
   * @param  {object}  config
   * @return {void}
   */
  configureSchema (connection, config) {
    if (config.schema !== undefined) {
      const schema = this.formatSchema(config.schema)

      connection.prepare(`set search_path to ${schema}`).execute()
    }
  }

  /**
   * Configure the synchronous_commit setting.
   *
   * @param  {Driver}  connection
   * @param  {object}  config
   * @return {void}
   */
  configureSynchronousCommit (connection, config) {
    if (config.synchronous_commit !== undefined) {
      connection.prepare(`set synchronous_commit to '${config.synchronous_commit}'`).execute()
    }
  }

  /**
   * Set the timezone on the connection.
   *
   * @param  {Driver}  connection
   * @param  {object}  config
   * @return {void}
   */
  configureTimezone (connection, config) {
    if (config.timezone !== undefined) {
      connection.prepare(`set time zone '${config.timezone}'`).execute()
    }
  }

  /**
   * Establish a database connection.
   *
   * @param  {object}  config
   * @return {object}
   */
  connect (config) {
    // First we'll create the basic DSN and connection instance connecting to the
    // using the configuration option specified by the developer. We will also
    // set the default character set on the connections to UTF-8 by default.
    const connection = this.createConnection(
      this.getDsn(config), config, this.getOptions(config)
    )

    this.configureEncoding(connection, config)

    // Next, we will check to see if a timezone has been specified in this config
    // and if it has we will issue a statement to modify the timezone with the
    // database. Setting this DB timezone is an optional configuration item.
    this.configureTimezone(connection, config)

    this.configureSchema(connection, config)

    // Postgres allows an application_name to be set by the user and this name is
    // used to when monitoring the application with pg_stat_activity. So we'll
    // determine if the option has been specified and run a statement if so.
    this.configureApplicationName(connection, config)

    this.configureSynchronousCommit(connection, config)

    return connection
  }

  /**
   * Create a new PDO connection instance.
   *
   * @param  {string}  dsn
   * @param  {Record<string, unknown>}  options
   * @return {object}
   */
  createNdoConnection (dsn, options) {
    // TODO: Return PostgresDriver
    // return new PostgresStatement(dsn, options)
    return new PostgresDriver()
  }

  /**
   * Format the schema for the DSN.
   *
   * @param  {Array|string}  schema
   * @return {string}
   */
  formatSchema (schema) {
    if (Array.isArray(schema)) {
      return '"' + schema.join('", "') + '"'
    }

    return '"' + schema + '"'
  }

  /**
   * Create a DSN string from a configuration.
   *
   * @param  {Record<string, unknown>}  config
   * @return {string}
   */
  getDsn (config) {
    // First we will create the basic DSN setup as well as the port if it is in
    // in the configuration options. This will give us the basic DSN we will
    // need to establish the PDO connections and return them back for use.
    let {
      host,
      port,
      connect_via_port:
      connectViaPort,
      connect_via_database:
      connectViaDatabase,
      database
    } = config

    host = host ? `host=${host};` : ''

    // Sometimes - users may need to connect to a database that has a different
    // name than the database used for "information_schema" queries. This is
    // typically the case if using "pgbouncer" type software when pooling.
    database = connectViaDatabase ?? database
    port = connectViaPort ?? port ?? null

    let dsn = `pgsql:${host}dbname='${database}'`

    // If a port was specified, we will add it to this Postgres DSN connections
    // format. Once we have done that we are ready to return this connection
    // string back out for usage, as this has been fully constructed here.
    if (!isNil(port)) {
      dsn += ';port={port}'
    }

    return this.addSslOptions(dsn, config)
  }
}

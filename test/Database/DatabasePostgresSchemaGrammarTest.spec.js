import test from 'ava'

import Blueprint from './../../src/Illuminate/Database/Schema/Blueprint.js'
import getConnection from './helpers/getConnection.js'
import getGrammar from './helpers/getSchemaGrammar.js'

test.only('testBasicCreateTable', async t => {
  let blueprint = new Blueprint('users')
  blueprint.create()
  blueprint.increments('id')
  blueprint.string('email')
  blueprint.string('name').collation('nb_NO.utf8')
  let statements = blueprint.toSql(getConnection(), getGrammar())

  t.is(statements.length, 1)
  t.is(statements[0], 'create table "users" ("id" serial not null primary key, "email" varchar(255) not null, "name" varchar(255) collate "nb_NO.utf8" not null)')

  blueprint = new Blueprint('users')
  blueprint.increments('id')
  blueprint.string('email')
  statements = blueprint.toSql(getConnection(), getGrammar())

  t.is(statements.length, 1)
  t.is(statements[0], 'alter table "users" add column "id" serial not null primary key, add column "email" varchar(255) not null')
})

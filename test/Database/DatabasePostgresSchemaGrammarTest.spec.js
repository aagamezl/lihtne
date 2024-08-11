import test from 'ava'

import Blueprint from './../../src/Illuminate/Database/Schema/Blueprint.js'
import getConnection from './helpers/getConnection.js'
import getGrammar from './helpers/getSchemaGrammar.js'

test('testBasicCreateTable', async t => {
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

  t.is(statements.length, 2)
  t.deepEqual(statements, [
    'alter table "users" add column "id" serial not null primary key',
    'alter table "users" add column "email" varchar(255) not null'
  ])
})

test('testCreateTableWithAutoIncrementStartingValue', async t => {
  const blueprint = new Blueprint('users')
  blueprint.create()
  blueprint.increments('id').startingValue(1000)
  blueprint.string('email')
  blueprint.string('name').collation('nb_NO.utf8')
  const statements = blueprint.toSql(getConnection(), getGrammar())

  t.is(statements.length, 2)
  t.is(statements[0], 'create table "users" ("id" serial not null primary key, "email" varchar(255) not null, "name" varchar(255) collate "nb_NO.utf8" not null)')
  t.is(statements[1], 'alter sequence users_id_seq restart with 1000')
})

test('testAddColumnsWithMultipleAutoIncrementStartingValue', async t => {
  const blueprint = new Blueprint('users')
  blueprint.id().from(100)
  blueprint.increments('code').from(200)
  blueprint.string('name').from(300)
  const statements = blueprint.toSql(getConnection(), getGrammar())

  t.deepEqual(statements, [
    'alter table "users" add column "id" bigserial not null primary key',
    'alter table "users" add column "code" serial not null primary key',
    'alter table "users" add column "name" varchar(255) not null',
    'alter sequence users_id_seq restart with 100',
    'alter sequence users_code_seq restart with 200'
  ])
})

test('testCreateTableAndCommentColumn', async t => {
  const blueprint = new Blueprint('users')
  blueprint.create()
  blueprint.increments('id')
  blueprint.string('email').comment('my first comment')
  const statements = blueprint.toSql(getConnection(), getGrammar())

  t.is(statements.length, 2)
  t.is(statements[0], 'create table "users" ("id" serial not null primary key, "email" varchar(255) not null)')
  t.is(statements[1], 'comment on column "users"."email" is \'my first comment\'')
})

test('testCreateTemporaryTable', async t => {
  const blueprint = new Blueprint('users')
  blueprint.create()
  blueprint.temporary()
  blueprint.increments('id')
  blueprint.string('email')
  const statements = blueprint.toSql(getConnection(), getGrammar())

  t.is(statements.length, 1)
  t.is(statements[0], 'create temporary table "users" ("id" serial not null primary key, "email" varchar(255) not null)')
})

import test from 'ava'

import PostgresProcessor from '../../src/Illuminate/Database/Query/Processors/PostgresProcessor.js'

test.only('testProcessColumns', async t => {
  const processor = new PostgresProcessor()

  const listing = [
    { name: 'id', type_name: 'int4', type: 'integer', collation: '', nullable: true, default: "nextval('employee_id_seq'::regclass)", comment: '' },
    { name: 'name', type_name: 'varchar', type: 'character varying(100)', collation: 'collate', nullable: false, default: '', comment: 'foo' },
    { name: 'balance', type_name: 'numeric', type: 'numeric(8,2)', collation: '', nullable: true, default: '4', comment: 'NULL' },
    { name: 'birth_date', type_name: 'timestamp', type: 'timestamp(6) without time zone', collation: '', nullable: false, default: '', comment: '' }
  ]
  const expected = [
    { name: 'id', type_name: 'int4', type: 'integer', collation: '', nullable: true, default: "nextval('employee_id_seq'::regclass)", auto_increment: true, comment: '', generation: null },
    { name: 'name', type_name: 'varchar', type: 'character varying(100)', collation: 'collate', nullable: false, default: '', auto_increment: false, comment: 'foo', generation: null },
    { name: 'balance', type_name: 'numeric', type: 'numeric(8,2)', collation: '', nullable: true, default: '4', auto_increment: false, comment: 'NULL', generation: null },
    { name: 'birth_date', type_name: 'timestamp', type: 'timestamp(6) without time zone', collation: '', nullable: false, default: '', auto_increment: false, comment: '', generation: null }
  ]

  t.deepEqual(processor.processColumns(listing), expected)
})

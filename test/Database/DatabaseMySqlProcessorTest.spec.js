import test from 'ava'

import MySqlProcessor from '../../src/Illuminate/Database/Query/Processors/MySqlProcessor.js'

test('testProcessColumns', async t => {
  const processor = new MySqlProcessor()

  const listing = [
    { name: 'id', type_name: 'bigint', type: 'bigint', collation: 'collate', nullable: 'YES', default: '', extra: 'auto_increment', comment: 'bar' },
    { name: 'name', type_name: 'varchar', type: 'varchar(100)', collation: 'collate', nullable: 'NO', default: 'foo', extra: '', comment: '' },
    { name: 'email', type_name: 'varchar', type: 'varchar(100)', collation: 'collate', nullable: 'YES', default: 'NULL', extra: 'on update CURRENT_TIMESTAMP', comment: 'NULL' }
  ]
  const expected = [
    { name: 'id', type_name: 'bigint', type: 'bigint', collation: 'collate', nullable: true, default: '', auto_increment: true, comment: 'bar', generation: null },
    { name: 'name', type_name: 'varchar', type: 'varchar(100)', collation: 'collate', nullable: false, default: 'foo', auto_increment: false, comment: null, generation: null },
    { name: 'email', type_name: 'varchar', type: 'varchar(100)', collation: 'collate', nullable: true, default: 'NULL', auto_increment: false, comment: 'NULL', generation: null }
  ]

  t.deepEqual(processor.processColumns(listing), expected)
})

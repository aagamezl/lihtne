import test from 'ava'

import SQLiteProcessor from '../../src/Illuminate/Database/Query/Processors/SQLiteProcessor.js'

test('testProcessColumns', async t => {
  const processor = new SQLiteProcessor()

  const listing = [
    { name: 'id', type: 'INTEGER', nullable: '0', default: '', primary: '1' },
    { name: 'name', type: 'varchar', nullable: '1', default: 'foo', primary: '0' },
    { name: 'is_active', type: 'tinyint(1)', nullable: '0', default: '1', primary: '0' }
  ]
  const expected = [
    { name: 'id', type_name: 'integer', type: 'integer', collation: null, nullable: false, default: '', auto_increment: true, comment: null, generation: null },
    { name: 'name', type_name: 'varchar', type: 'varchar', collation: null, nullable: true, default: 'foo', auto_increment: false, comment: null, generation: null },
    { name: 'is_active', type_name: 'tinyint', type: 'tinyint(1)', collation: null, nullable: false, default: '1', auto_increment: false, comment: null, generation: null }
  ]

  t.deepEqual(processor.processColumns(listing), expected)
})

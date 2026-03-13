import { getBuilder } from '../test/Database/helpers/getBuilder';

const builder = getBuilder()
builder.select('*').from('users')
console.log(builder.toSql())

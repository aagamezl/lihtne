import PostgresGrammar from '../../../src/Illuminate/Database/Query/Grammars/PostgresGrammar.js'

const getGrammar = () => new PostgresGrammar()

export default getGrammar

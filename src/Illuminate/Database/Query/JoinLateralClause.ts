import { registerClass } from '../../Support/class-registry'
import { JoinClause } from './JoinClause'

export class JoinLateralClause extends JoinClause {}

registerClass('JoinLateralClause', JoinLateralClause)

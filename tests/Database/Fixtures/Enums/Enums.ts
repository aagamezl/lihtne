export enum StringStatus {
  draft = 'draft',
  pending = 'pending',
  done = 'done'
}

export enum IntegerStatus {
  draft = 0,
  pending = 1,
  done = 2
}

/** PHP unit enum stand-in for binding tests (casts to case name). */
export const NonBackedStatus = {
  draft: { name: 'draft' },
  pending: { name: 'pending' },
  done: { name: 'done' }
} as const

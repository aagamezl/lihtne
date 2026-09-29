export enum SortDirection {
  Ascending = 'asc',
  Descending = 'desc'
}

export type SortDirectionType = `${SortDirection.Ascending}` | `${SortDirection.Descending}`

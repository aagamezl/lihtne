import { Collection } from '../src/Illuminate/Collections/CollectionNew'

const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const users = [
  { id: 1, name: "Alice Jensen", email: "alice@example.com", active: true, createdAt: "2026-01-12T09:15:00Z" },
  { id: 2, name: "Bruno Sørensen", email: "bruno@example.com", active: false, createdAt: "2026-01-13T11:22:00Z" },
  { id: 3, name: "Carla Madsen", email: "carla@example.com", active: true, createdAt: "2026-01-14T14:05:00Z" },
  { id: 4, name: "David Holm", email: "david@example.com", active: true, createdAt: "2026-01-15T08:47:00Z" },
  { id: 5, name: "Elena Kruse", email: "elena@example.com", active: false, createdAt: "2026-01-16T17:30:00Z" },
  { id: 6, name: "Frederik Poulsen", email: "frederik@example.com", active: true, createdAt: "2026-01-17T10:12:00Z" },
  { id: 7, name: "Greta Lund", email: "greta@example.com", active: true, createdAt: "2026-01-18T13:55:00Z" },
  { id: 8, name: "Hans Mortensen", email: "hans@example.com", active: false, createdAt: "2026-01-19T09:03:00Z" },
  { id: 9, name: "Ingrid Bæk", email: "ingrid@example.com", active: true, createdAt: "2026-01-20T16:41:00Z" },
  { id: 10, name: "Jonas Vester", email: "jonas@example.com", active: true, createdAt: "2026-01-21T12:28:00Z" }
];


let collection = new Collection(numbers)

// for (const item of collection.all()) {
//   console.log(item);
// }

// let first = collection.first((value: number, key: number) => {
//   return value > 2
// }, 33)

// console.log(first);

// first = collection.first()

// console.log(first);

// collection = new Collection(users)

// first = collection.first()
// console.log(first);

// first = collection.first((value: typeof users[0], key: number) => {
//   return value.active === false
// }, 'All users are active')
// console.log(first);

// for (const item of collection.all()) {
//   console.log(item);
// }

// console.log(collection.implode('-'));

collection = new Collection([
  { 'brand': 'Tesla', 'color': 'red' },
  { 'brand': 'Pagani', 'color': 'white' },
  { 'brand': 'Tesla', 'color': 'black' },
  { 'brand': 'Pagani', 'color': 'orange' },
])
let plucked = collection.pluck('color', 'brand');

console.log(plucked.all())

collection = new Collection([
  {
    'name': 'Laracon',
    'speakers': {
      'first_day': ['Rosa', 'Judith'],
    },
  },
  {
    'name': 'VueConf',
    'speakers': {
      'first_day': ['Abigail', 'Joey'],
    },
  },
])

plucked = collection.pluck('speakers.first_day');

console.log(plucked.all())

// Perfectionist sorting rules: https://perfectionist.dev/
// Kept in its own file since it's a separate concern from Standard-style
// linting/formatting — easy to drop or retune independently.
import perfectionist from 'eslint-plugin-perfectionist'

const ONE_BLANK_LINE_BETWEEN_IMPORT_GROUPS = 1

export default {
  plugins: {
    perfectionist
  },
  rules: {
    'perfectionist/sort-imports': [
      'error',
      {
        type: 'natural',
        order: 'asc',
        newlinesBetween: ONE_BLANK_LINE_BETWEEN_IMPORT_GROUPS
      }
    ],
    'perfectionist/sort-named-imports': ['error', { type: 'natural', order: 'asc' }],
    'perfectionist/sort-named-exports': ['error', { type: 'natural', order: 'asc' }],
    'perfectionist/sort-exports': ['error', { type: 'natural', order: 'asc' }]

    // Add more perfectionist rules here as needed, e.g.:
    // 'perfectionist/sort-object-types': ['error', { type: 'natural', order: 'asc' }],
    // 'perfectionist/sort-interfaces': ['error', { type: 'natural', order: 'asc' }],
    // 'perfectionist/sort-enums': ['error', { type: 'natural', order: 'asc' }]
  }
}

// TypeScript-aware equivalents of the base JS rules, plus a small set of
// TS-only checks that eslint-config-standard-with-typescript used to add.
import tseslint from 'typescript-eslint'

const MAX_UNUSED_ARGS_BEFORE_LAST = 'after-used'

export default tseslint.config({
  files: ['**/*.ts', '**/*.tsx'],
  extends: [
    ...tseslint.configs.recommended
  ],
  rules: {
    // Turn off JS versions in favour of the TS-aware ones.
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        args: MAX_UNUSED_ARGS_BEFORE_LAST,
        caughtErrors: 'none',
        ignoreRestSiblings: true,
        vars: 'all'
      }
    ],

    'no-use-before-define': 'off',
    '@typescript-eslint/no-use-before-define': [
      'error',
      { functions: false, classes: false, variables: false }
    ],

    'no-useless-constructor': 'off',
    '@typescript-eslint/no-useless-constructor': 'error',

    'no-redeclare': 'off',
    '@typescript-eslint/no-redeclare': 'error',

    // Standard-with-typescript's opinionated additions, kept intentionally
    // small — extend this file as you need stricter checks.
    // separate-type-imports: `import type` is erased. Inline
    // `import { type X }` is emitted as `import {}`, which still
    // evaluates the module and reintroduces circular-init failures.
    '@typescript-eslint/consistent-type-imports': [
      'error',
      { prefer: 'type-imports', fixStyle: 'separate-type-imports' }
    ],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-non-null-assertion': 'warn'
  }
})

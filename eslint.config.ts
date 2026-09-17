// import js from "@eslint/js";
// import globals from "globals";
// import tseslint from "typescript-eslint";
// import { defineConfig } from "eslint/config";

// export default defineConfig([
//   {
//     files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
//     plugins: { js },
//     extends: ["js/recommended"],
//     languageOptions: {
//       globals: globals.node
//     }
//   },
//   tseslint.configs.recommended,
// ]);

// import eslint from '@eslint/js'
// import importPlugin from 'eslint-plugin-import'
// import n from 'eslint-plugin-n'
// // import perfectionist from 'eslint-plugin-perfectionist'
// import promise from 'eslint-plugin-promise'
// import tseslint from 'typescript-eslint'

// export default tseslint.config(
//   {
//     ignores: [
//       'dist/**',
//       'coverage/**',
//       'node_modules/**'
//     ]
//   },

//   eslint.configs.recommended,

//   {
//     files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],

//     plugins: {
//       import: importPlugin,
//       n,
//     //   perfectionist,
//       promise
//     },

//     languageOptions: {
//       ecmaVersion: 'latest',
//       sourceType: 'module'
//     },

//     rules: {
//       // StandardJS
//       'accessor-pairs': 'error',
//       'array-bracket-spacing': ['error', 'never'],
//       'arrow-spacing': ['error', { before: true, after: true }],
//       'block-spacing': ['error', 'always'],
//       'brace-style': ['error', '1tbs', { allowSingleLine: true }],
//       'camelcase': ['error', { properties: 'never' }],
//       'comma-dangle': ['error', 'never'],
//       'comma-spacing': ['error', { before: false, after: true }],
//       'comma-style': ['error', 'last'],
//       'computed-property-spacing': ['error', 'never'],
//       'constructor-super': 'error',
//       'curly': ['error', 'multi-line'],
//       'dot-location': ['error', 'property'],
//       'eol-last': ['error', 'always'],
//       'eqeqeq': ['error', 'always', { null: 'ignore' }],
//       'func-call-spacing': ['error', 'never'],
//       'generator-star-spacing': ['error', { before: true, after: true }],
//       'handle-callback-err': ['error', '^(err|error)$'],
//       'indent': ['error', 2, { SwitchCase: 1 }],
//       'key-spacing': ['error', { beforeColon: false, afterColon: true }],
//       'keyword-spacing': ['error', { before: true, after: true }],
//       'new-cap': ['error', { newIsCap: true, capIsNew: false }],
//       'new-parens': 'error',
//       'no-array-constructor': 'error',
//       'no-async-promise-executor': 'error',
//       'no-caller': 'error',
//       'no-class-assign': 'error',
//       'no-compare-neg-zero': 'error',
//       'no-cond-assign': ['error', 'except-parens'],
//       'no-const-assign': 'error',
//       'no-constant-condition': ['error', { checkLoops: false }],
//       'no-constant-binary-expression': 'error',
//       'no-control-regex': 'error',
//       'no-debugger': 'error',
//       'no-delete-var': 'error',
//       'no-dupe-args': 'error',
//       'no-dupe-class-members': 'error',
//       'no-dupe-else-if': 'error',
//       'no-dupe-keys': 'error',
//       'no-duplicate-case': 'error',
//       'no-duplicate-imports': 'error',
//       'no-empty-character-class': 'error',
//       'no-empty-pattern': 'error',
//       'no-empty-static-block': 'error',
//       'no-eval': 'error',
//       'no-ex-assign': 'error',
//       'no-extend-native': 'error',
//       'no-extra-bind': 'error',
//       'no-extra-boolean-cast': 'error',
//       'no-extra-parens': ['error', 'functions'],
//       'no-fallthrough': 'error',
//       'no-floating-decimal': 'error',
//       'no-func-assign': 'error',
//       'no-global-assign': 'error',
//       'no-implied-eval': 'error',
//       'no-import-assign': 'error',
//       'no-invalid-regexp': 'error',
//       'no-irregular-whitespace': 'error',
//       'no-iterator': 'error',
//       'no-labels': ['error', { allowLoop: false, allowSwitch: false }],
//       'no-lone-blocks': 'error',
//       'no-loss-of-precision': 'error',
//       'no-misleading-character-class': 'error',
//       'no-multi-spaces': 'error',
//       'no-multi-str': 'error',
//       'no-multiple-empty-lines': ['error', { max: 1, maxBOF: 0, maxEOF: 0 }],
//       'no-new': 'error',
//       'no-new-func': 'error',
//       'no-new-object': 'error',
//       'no-new-symbol': 'error',
//       'no-new-wrappers': 'error',
//       'no-obj-calls': 'error',
//       'no-octal': 'error',
//       'no-octal-escape': 'error',
//       'no-path-concat': 'error',
//       'no-proto': 'error',
//       'no-prototype-builtins': 'error',
//       'no-redeclare': 'error',
//       'no-regex-spaces': 'error',
//       'no-return-assign': ['error', 'except-parens'],
//       'no-self-assign': 'error',
//       'no-self-compare': 'error',
//       'no-sequences': 'error',
//       'no-shadow-restricted-names': 'error',
//       'no-sparse-arrays': 'error',
//       'no-tabs': 'error',
//       'no-template-curly-in-string': 'error',
//       'no-this-before-super': 'error',
//       'no-throw-literal': 'error',
//       'no-trailing-spaces': 'error',
//       'no-undef': 'error',
//       'no-undef-init': 'error',
//       'no-unexpected-multiline': 'error',
//       'no-unmodified-loop-condition': 'error',
//       'no-unneeded-ternary': ['error', { defaultAssignment: false }],
//       'no-unreachable': 'error',
//       'no-unreachable-loop': 'error',
//       'no-unsafe-finally': 'error',
//       'no-unsafe-negation': 'error',
//       'no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true }],
//       'no-unused-vars': 'off',
//       'no-useless-backreference': 'error',
//       'no-useless-call': 'error',
//       'no-useless-catch': 'error',
//       'no-useless-computed-key': 'error',
//       'no-useless-constructor': 'error',
//       'no-useless-escape': 'error',
//       'no-useless-rename': 'error',
//       'no-useless-return': 'error',
//       'no-var': 'error',
//       'no-void': 'error',
//       'no-whitespace-before-property': 'error',
//       'no-with': 'error',
//       'object-curly-spacing': ['error', 'always'],
//       'object-property-newline': ['error', { allowAllPropertiesOnSameLine: true }],
//       'one-var': ['error', { initialized: 'never' }],
//       'operator-linebreak': ['error', 'after', { overrides: { '?': 'before', ':': 'before' } }],
//       'padded-blocks': ['error', 'never'],
//       'quote-props': ['error', 'as-needed'],
//       'quotes': ['error', 'single', { avoidEscape: true }],
//       'rest-spread-spacing': ['error', 'never'],
//       'semi': ['error', 'never'],
//       'semi-spacing': ['error', { before: false, after: true }],
//       'space-before-blocks': ['error', 'always'],
//       'space-before-function-paren': [
//         'error',
//         {
//           anonymous: 'always',
//           asyncArrow: 'always',
//           named: 'never'
//         }
//       ],
//       'space-in-parens': ['error', 'never'],
//       'space-infix-ops': 'error',
//       'space-unary-ops': ['error', { words: true, nonwords: false }],
//       'spaced-comment': ['error', 'always'],
//       'symbol-description': 'error',
//       'template-curly-spacing': ['error', 'never'],
//       'template-tag-spacing': ['error', 'never'],
//       'unicode-bom': ['error', 'never'],
//       'use-isnan': 'error',
//       'valid-typeof': 'error',
//       'wrap-iife': ['error', 'outside'],
//       'yield-star-spacing': ['error', { before: true, after: true }],

//       // Standard's plugin rules
//       'import/export': 'error',
//       'import/first': 'error',
//       'import/no-duplicates': 'error',
//       'import/no-named-default': 'error',
//       'import/no-unresolved': 'error',

//       // 'n/handle-callback-err': ['error', '^(err|error)$'],
//       // 'n/no-callback-literal': 'error',
//       // 'n/no-deprecated-api': 'error',
//       // 'n/no-exports-assign': 'error',
//       // 'n/no-extraneous-import': 'error',
//       // 'n/no-extraneous-require': 'error',
//       // 'n/no-missing-import': 'error',
//       // 'n/no-missing-require': 'error',
//       // 'n/no-new-require': 'error',
//       // 'n/no-path-concat': 'error',
//       // 'n/no-process-exit': 'error',
//       // 'n/no-unpublished-bin': 'error',
//       // 'n/no-unpublished-import': 'error',
//       // 'n/no-unpublished-require': 'error',
//       // 'n/no-unsupported-features/es-builtins': 'error',
//       // 'n/no-unsupported-features/es-syntax': 'error',
//       // 'n/no-unsupported-features/node-builtins': 'error',
//       // 'n/process-exit-as-throw': 'error',
//       // 'n/shebang': 'error',
//       // 'n/exports-style': ['error', 'module.exports'],
//       // 'n/no-callback-literal': 'error',

//       'promise/param-names': 'error',
//       'promise/always-return': 'off',
//       'promise/catch-or-return': 'off',

//       // TypeScript
//       '@typescript-eslint/no-unused-vars': [
//         'error',
//         {
//           argsIgnorePattern: '^_',
//           caughtErrorsIgnorePattern: '^_',
//           varsIgnorePattern: '^_'
//         }
//       ],

//       'no-use-before-define': 'off',
//       '@typescript-eslint/no-use-before-define': 'error',

//       // 'no-useless-constructor': 'off',
//       '@typescript-eslint/no-useless-constructor': 'error',

//       // Perfectionist
//       // 'perfectionist/sort-imports': [
//       //   'error',
//       //   {
//       //     type: 'natural',
//       //     order: 'asc'
//       //   }
//       // ]
//     }
//   },

//   {
//     files: ['**/*.{ts,tsx,mts,cts}'],

//     languageOptions: {
//       parser: tseslint.parser,
//       parserOptions: {
//         projectService: true
//       }
//     },

//     extends: [
//       tseslint.configs.recommended
//     ]
//   }
// )

// @ts-check

// import js from '@eslint/js';
// import { defineConfig } from 'eslint/config';
// import tseslint from 'typescript-eslint';

// export default defineConfig({
//   files: ['src/**/*.{js,ts}'],
//   extends: [
//     js.configs.recommended,
//     tseslint.configs.recommended
//   ],
//   languageOptions: {
//     parser: tseslint.parser,
//     parserOptions: {
//       projectService: true
//     }
//   },
//   rules: {
//     // StandardJS
//     'accessor-pairs': 'error',
//     'array-bracket-spacing': ['error', 'never'],
//     'arrow-spacing': ['error', { before: true, after: true }],
//     'block-spacing': ['error', 'always'],
//     'brace-style': ['error', '1tbs', { allowSingleLine: true }],
//     'camelcase': ['error', { properties: 'never' }],
//     'comma-dangle': ['error', 'never'],
//     'comma-spacing': ['error', { before: false, after: true }],
//     'comma-style': ['error', 'last'],
//     'computed-property-spacing': ['error', 'never'],
//     'constructor-super': 'error',
//     'curly': ['error', 'multi-line'],
//     'dot-location': ['error', 'property'],
//     'eol-last': ['error', 'always'],
//     'eqeqeq': ['error', 'always', { null: 'ignore' }],
//     'func-call-spacing': ['error', 'never'],
//     'generator-star-spacing': ['error', { before: true, after: true }],
//     'handle-callback-err': ['error', '^(err|error)$'],
//     'indent': ['error', 2, { SwitchCase: 1 }],
//     'key-spacing': ['error', { beforeColon: false, afterColon: true }],
//     'keyword-spacing': ['error', { before: true, after: true }],
//     'new-cap': ['error', { newIsCap: true, capIsNew: false }],
//     'new-parens': 'error',
//     'no-array-constructor': 'error',
//     'no-async-promise-executor': 'error',
//     'no-caller': 'error',
//     'no-class-assign': 'error',
//     'no-compare-neg-zero': 'error',
//     'no-cond-assign': ['error', 'except-parens'],
//     'no-const-assign': 'error',
//     'no-constant-condition': ['error', { checkLoops: false }],
//     'no-constant-binary-expression': 'error',
//     'no-control-regex': 'error',
//     'no-debugger': 'error',
//     'no-delete-var': 'error',
//     'no-dupe-args': 'error',
//     'no-dupe-class-members': 'error',
//     'no-dupe-else-if': 'error',
//     'no-dupe-keys': 'error',
//     'no-duplicate-case': 'error',
//     'no-duplicate-imports': 'error',
//     'no-empty-character-class': 'error',
//     'no-empty-pattern': 'error',
//     'no-empty-static-block': 'error',
//     'no-eval': 'error',
//     'no-ex-assign': 'error',
//     'no-extend-native': 'error',
//     'no-extra-bind': 'error',
//     'no-extra-boolean-cast': 'error',
//     'no-extra-parens': ['error', 'functions'],
//     'no-fallthrough': 'error',
//     'no-floating-decimal': 'error',
//     'no-func-assign': 'error',
//     'no-global-assign': 'error',
//     'no-implied-eval': 'error',
//     'no-import-assign': 'error',
//     'no-invalid-regexp': 'error',
//     'no-irregular-whitespace': 'error',
//     'no-iterator': 'error',
//     'no-labels': ['error', { allowLoop: false, allowSwitch: false }],
//     'no-lone-blocks': 'error',
//     'no-loss-of-precision': 'error',
//     'no-misleading-character-class': 'error',
//     'no-multi-spaces': 'error',
//     'no-multi-str': 'error',
//     'no-multiple-empty-lines': ['error', { max: 1, maxBOF: 0, maxEOF: 0 }],
//     'no-new': 'error',
//     'no-new-func': 'error',
//     'no-new-object': 'error',
//     'no-new-symbol': 'error',
//     'no-new-wrappers': 'error',
//     'no-obj-calls': 'error',
//     'no-octal': 'error',
//     'no-octal-escape': 'error',
//     'no-path-concat': 'error',
//     'no-proto': 'error',
//     'no-prototype-builtins': 'error',
//     'no-redeclare': 'error',
//     'no-regex-spaces': 'error',
//     'no-return-assign': ['error', 'except-parens'],
//     'no-self-assign': 'error',
//     'no-self-compare': 'error',
//     'no-sequences': 'error',
//     'no-shadow-restricted-names': 'error',
//     'no-sparse-arrays': 'error',
//     'no-tabs': 'error',
//     'no-template-curly-in-string': 'error',
//     'no-this-before-super': 'error',
//     'no-throw-literal': 'error',
//     'no-trailing-spaces': 'error',
//     'no-undef': 'error',
//     'no-undef-init': 'error',
//     'no-unexpected-multiline': 'error',
//     'no-unmodified-loop-condition': 'error',
//     'no-unneeded-ternary': ['error', { defaultAssignment: false }],
//     'no-unreachable': 'error',
//     'no-unreachable-loop': 'error',
//     'no-unsafe-finally': 'error',
//     'no-unsafe-negation': 'error',
//     'no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true }],
//     'no-unused-vars': 'off',
//     'no-useless-backreference': 'error',
//     'no-useless-call': 'error',
//     'no-useless-catch': 'error',
//     'no-useless-computed-key': 'error',
//     'no-useless-constructor': 'error',
//     'no-useless-escape': 'error',
//     'no-useless-rename': 'error',
//     'no-useless-return': 'error',
//     'no-var': 'error',
//     'no-void': 'error',
//     'no-whitespace-before-property': 'error',
//     'no-with': 'error',
//     'object-curly-spacing': ['error', 'always'],
//     'object-property-newline': ['error', { allowAllPropertiesOnSameLine: true }],
//     'one-var': ['error', { initialized: 'never' }],
//     'operator-linebreak': ['error', 'after', { overrides: { '?': 'before', ':': 'before' } }],
//     'padded-blocks': ['error', 'never'],
//     'quote-props': ['error', 'as-needed'],
//     'quotes': ['error', 'single', { avoidEscape: true }],
//     'rest-spread-spacing': ['error', 'never'],
//     'semi': ['error', 'never'],
//     'semi-spacing': ['error', { before: false, after: true }],
//     'space-before-blocks': ['error', 'always'],
//     'space-before-function-paren': [
//       'error',
//       {
//         anonymous: 'always',
//         asyncArrow: 'always',
//         named: 'never'
//       }
//     ],
//     'space-in-parens': ['error', 'never'],
//     'space-infix-ops': 'error',
//     'space-unary-ops': ['error', { words: true, nonwords: false }],
//     'spaced-comment': ['error', 'always'],
//     'symbol-description': 'error',
//     'template-curly-spacing': ['error', 'never'],
//     'template-tag-spacing': ['error', 'never'],
//     'unicode-bom': ['error', 'never'],
//     'use-isnan': 'error',
//     'valid-typeof': 'error',
//     'wrap-iife': ['error', 'outside'],
//     'yield-star-spacing': ['error', { before: true, after: true }],

//     // Standard's plugin rules
//     // 'import/export': 'error',
//     // 'import/first': 'error',
//     // 'import/no-duplicates': 'error',
//     // 'import/no-named-default': 'error',
//     // 'import/no-unresolved': 'error',

//     // TypeScript
//     '@typescript-eslint/no-unused-vars': [
//       'error',
//       {
//         argsIgnorePattern: '^_',
//         caughtErrorsIgnorePattern: '^_',
//         varsIgnorePattern: '^_'
//       }
//     ],

//     'no-use-before-define': 'off',
//     '@typescript-eslint/no-use-before-define': 'error',
//   }
// });

import js from '@eslint/js'
import globals from 'globals'

import baseConfig from './eslint-config/base.js'
import nodeAndImportsConfig from './eslint-config/node-and-imports.js'
import perfectionistConfig from './eslint-config/perfectionist.js'
import stylisticConfig from './eslint-config/stylistic.js'
import typescriptConfig from './eslint-config/typescript.js'

const IGNORED_PATHS = ['dist/**', 'node_modules/**', 'coverage/**']

export default [
  {
    ignores: IGNORED_PATHS
  },

  js.configs.recommended,

  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node
      }
    }
  },

  // StandardJS-equivalent behaviour, applied to every JS/TS file.
  baseConfig,
  stylisticConfig,
  nodeAndImportsConfig,

  // TypeScript-only rules (scoped internally to **/*.ts, **/*.tsx).
  ...typescriptConfig,

  // Perfectionist sorting — separate, optional layer.
  perfectionistConfig
]

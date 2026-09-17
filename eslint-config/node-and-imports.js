import importPlugin from 'eslint-plugin-import-x'
// StandardJS also enables eslint-plugin-n, eslint-plugin-promise, and
// eslint-plugin-import under the hood. This is the modern equivalent set
// (eslint-plugin-import-x is the actively maintained flat-config fork).
import nodePlugin from 'eslint-plugin-n'
import promisePlugin from 'eslint-plugin-promise'

export default {
  plugins: {
    n: nodePlugin,
    promise: promisePlugin,
    'import-x': importPlugin
  },
  rules: {
    'n/handle-callback-err': ['error', '^(err|error)$'],
    'n/no-callback-literal': 'error',
    'n/no-deprecated-api': 'error',
    'n/no-exports-assign': 'error',
    'n/no-new-require': 'error',
    'n/no-path-concat': 'error',
    'n/process-exit-as-throw': 'error',

    'promise/param-names': 'error',

    'import-x/export': 'error',
    'import-x/first': 'error',
    'import-x/no-absolute-path': 'error',
    'import-x/no-duplicates': 'error',
    'import-x/no-named-default': 'error',
    'import-x/no-webpack-loader-syntax': 'error'
  }
}

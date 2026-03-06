/** @type {import("jest").Config} **/
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testPathIgnorePatterns: ['/build/', '/dist/', '/node_modules/'],
  // testRegex: ['spec\\.[jt]s$'],
  testMatch: ['**/tests/**/*.spec.ts'],
  extensionsToTreatAsEsm: ['.ts'],
  globals: {
    'ts-jest': {
      useESM: true
    }
  },
  transform: {
    '^.+\\.ts?$': ['ts-jest', {
      useESM: true
    }],
  },
};
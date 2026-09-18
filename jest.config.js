/** @type {import("jest").Config} **/
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  testPathIgnorePatterns: ['/build/', '/dist/', '/node_modules/'],
  testMatch: ['**/test/**/*.spec.ts'],
  transform: {
    '^.+\\.m?tsx?$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        esModuleInterop: true
      }
    }]
  }
}

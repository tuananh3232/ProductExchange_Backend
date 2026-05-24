export default {
  testEnvironment: 'node',
  transform: {},
  extensionsToTreatAsEsm: [],
  testMatch: ['**/tests/**/*.test.js'],
  setupFiles: ['<rootDir>/tests/jest.setup.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/jest.setup-after-env.js'],
  testTimeout: 30000,
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['src/**/*.js']
}

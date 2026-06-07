export default {
  testEnvironment: 'node',
  transform: {},
  extensionsToTreatAsEsm: [],
  testMatch: ['**/tests/{integration,unit}/**/*.test.js'],
  testPathIgnorePatterns: ['<rootDir>/tests/_legacy/'],
  setupFiles: ['<rootDir>/tests/setup/jest.setup.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.setup-after-env.js'],
  testTimeout: 30000,
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['src/**/*.js']
}

export default {
  projects: [
    {
      displayName: 'unit',
      testEnvironment: 'node',
      transform: {},
      extensionsToTreatAsEsm: [],
      testMatch: ['<rootDir>/tests/unit/**/*.test.js'],
      testPathIgnorePatterns: ['<rootDir>/tests/_legacy/'],
      setupFiles: ['<rootDir>/tests/setup/jest.setup.js'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.setup-after-env.js'],
      coverageDirectory: 'coverage',
      collectCoverageFrom: ['src/**/*.js']
    },
    {
      displayName: 'integration',
      testEnvironment: 'node',
      transform: {},
      extensionsToTreatAsEsm: [],
      testMatch: ['<rootDir>/tests/integration/**/*.test.js'],
      testPathIgnorePatterns: ['<rootDir>/tests/_legacy/'],
      setupFiles: ['<rootDir>/tests/setup/jest.setup.js'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.setup-after-env.js'],
      coverageDirectory: 'coverage',
      collectCoverageFrom: ['src/**/*.js']
    }
  ]
}

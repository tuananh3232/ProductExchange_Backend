import { jest } from '@jest/globals'
import { connectTestDB, disconnectTestDB, ensureTestDatabase } from './test-db.js'
import { ensureRbacSeedData } from '../../src/services/rbac/rbac-seed.service.js'

const isUnitTest = expect.getState().testPath?.includes(`${process.platform === 'win32' ? '\\' : '/'}unit${process.platform === 'win32' ? '\\' : '/'}`)

jest.setTimeout(isUnitTest ? 15000 : 30000)

if (!isUnitTest) {
  beforeAll(async () => {
    console.time(`[jest-setup] ${expect.getState().testPath} bootstrap`)
    ensureTestDatabase()
    await connectTestDB()

    if (process.env.JEST_RBAC_SEEDED !== 'true') {
      await ensureRbacSeedData()
      process.env.JEST_RBAC_SEEDED = 'true'
    }

    console.timeEnd(`[jest-setup] ${expect.getState().testPath} bootstrap`)
  }, 30000)

  afterAll(async () => {
    await disconnectTestDB()
  }, 30000)
}

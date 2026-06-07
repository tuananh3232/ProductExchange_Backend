import { connectTestDB, disconnectTestDB, ensureTestDatabase } from './test-db.js'
import { ensureRbacSeedData } from '../../src/services/rbac/rbac-seed.service.js'

const isUnitTest = expect.getState().testPath?.includes(`${process.platform === 'win32' ? '\\' : '/'}unit${process.platform === 'win32' ? '\\' : '/'}`)

if (!isUnitTest) {
  beforeAll(async () => {
    ensureTestDatabase()
    await connectTestDB()
    await ensureRbacSeedData()
  }, 30000)

  afterAll(async () => {
    await disconnectTestDB()
  }, 30000)
}

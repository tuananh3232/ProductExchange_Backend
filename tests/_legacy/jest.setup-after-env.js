import { connectDB, disconnectDB } from '../../src/configs/database.config.js'
import { ensureRbacSeedData } from '../../src/services/rbac/rbac-seed.service.js'

const isUnitTest = expect.getState().testPath?.endsWith('.unit.test.js')

if (!isUnitTest) {
  beforeAll(async () => {
    await connectDB()
    await ensureRbacSeedData()
  }, 30000)

  afterAll(async () => {
    await disconnectDB()
  }, 30000)
}


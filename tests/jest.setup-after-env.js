import { connectDB, disconnectDB } from '../src/configs/database.config.js'
import { ensureRbacSeedData } from '../src/services/rbac/rbac-seed.service.js'

beforeAll(async () => {
  await connectDB()
  await ensureRbacSeedData()
}, 30000)

afterAll(async () => {
  await disconnectDB()
}, 30000)

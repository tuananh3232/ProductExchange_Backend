import mongoose from 'mongoose'
import { connectDB, disconnectDB } from '../../src/configs/database.config.js'
import { env } from '../../src/configs/env.config.js'

const TEST_DB_SUFFIX = '_test'

export const getTestDatabaseName = () => env.mongodb.dbName || process.env.DB_NAME

export const ensureTestDatabase = () => {
  const dbName = getTestDatabaseName()

  if (!dbName || !dbName.endsWith(TEST_DB_SUFFIX)) {
    throw new Error(`Refusing to use non-test database: ${dbName || '(empty)'}. Database name must end with ${TEST_DB_SUFFIX}.`)
  }

  return dbName
}

export const connectTestDB = async () => {
  ensureTestDatabase()
  await connectDB()
}

export const disconnectTestDB = async () => {
  await disconnectDB()
}

export const resetTestDatabase = async () => {
  ensureTestDatabase()

  if (!mongoose.connection.db) {
    throw new Error('Cannot reset test database before MongoDB is connected.')
  }

  const collections = await mongoose.connection.db.collections()
  await Promise.all(collections.map((collection) => collection.deleteMany({})))
}

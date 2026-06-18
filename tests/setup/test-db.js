import mongoose from 'mongoose'
import { connectDB, disconnectDB } from '../../src/configs/database.config.js'
import { env } from '../../src/configs/env.config.js'

const TEST_DB_NAME = 'anhdecor_test'
const DEFAULT_PRESERVE_COLLECTIONS = ['permissions', 'roles']

export const getTestDatabaseName = () => (env.mongodb.dbName || process.env.DB_NAME || '').trim()

export const ensureTestDatabase = () => {
  const dbName = getTestDatabaseName()

  if (dbName !== TEST_DB_NAME) {
    throw new Error(`Refusing to use non-test database: ${dbName || '(empty)'}. Database name must be exactly ${TEST_DB_NAME}.`)
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

export const clearTestCollections = async ({ preserveCollections = DEFAULT_PRESERVE_COLLECTIONS } = {}) => {
  ensureTestDatabase()

  if (!mongoose.connection.db) {
    throw new Error('Cannot reset test database before MongoDB is connected.')
  }

  const collections = await mongoose.connection.db.collections()
  const preserveSet = new Set(preserveCollections)

  await Promise.all(
    collections
      .filter((collection) => !preserveSet.has(collection.collectionName))
      .map((collection) => collection.deleteMany({}))
  )
}

export const resetTestDatabase = async () => {
  await clearTestCollections()
}

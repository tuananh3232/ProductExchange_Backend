import dotenv from 'dotenv'
import mongoose from 'mongoose'

dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || '.env' })

const ALLOWED = process.env.ALLOW_COPY_MAIN_TO_TEST === 'true'
const TEST_DB_SUFFIX = '_test'

const COLLECTION_WHITELIST = [
  'categories',
  'permissions',
  'products',
  'roles',
  'shops',
  'shopinvitations',
  'users',
]

const BLOCKED_COLLECTION_PATTERN = /(token|otp|session|log)/i
const BLOCKED_FIELD_PATTERN = /(token|otp|session|log)/i

const getDbNameFromUri = (uri) => {
  if (!uri) return ''

  try {
    return new URL(uri).pathname.replace(/^\/+/, '')
  } catch {
    const withoutQuery = uri.split('?')[0]
    return withoutQuery.slice(withoutQuery.lastIndexOf('/') + 1)
  }
}

const withDatabaseName = (uri, databaseName) => {
  const url = new URL(uri)
  url.pathname = `/${databaseName}`
  return url.toString()
}

const assertSafeConfig = ({ sourceUri, sourceDbName, targetUri, targetDbName }) => {
  if (!ALLOWED) {
    throw new Error('Refusing to copy database. Set ALLOW_COPY_MAIN_TO_TEST=true to continue.')
  }

  if (!sourceUri || !targetUri) {
    throw new Error('MONGODB_URI and MONGODB_URI_TEST, or TEST_DB_NAME, are required.')
  }

  if (!targetDbName.endsWith(TEST_DB_SUFFIX)) {
    throw new Error(`Target database must end with ${TEST_DB_SUFFIX}: ${targetDbName}`)
  }

  if (sourceDbName === targetDbName || sourceUri === targetUri) {
    throw new Error('Source and target database must not be the same.')
  }
}

const copyCollection = async ({ sourceDb, targetDb, collectionName }) => {
  if (BLOCKED_COLLECTION_PATTERN.test(collectionName)) {
    return { collectionName, skipped: true, reason: 'blocked name pattern', copied: 0 }
  }

  const docs = (await sourceDb.collection(collectionName).find({}).toArray()).map(sanitizeDocument)
  await targetDb.collection(collectionName).deleteMany({})

  if (docs.length > 0) {
    await targetDb.collection(collectionName).insertMany(docs, { ordered: false })
  }

  return { collectionName, skipped: false, copied: docs.length }
}

const sanitizeDocument = (value) => {
  if (Array.isArray(value)) return value.map(sanitizeDocument)
  if (!value || typeof value !== 'object') return value
  if (value.constructor?.name !== 'Object') return value

  const sanitized = {}

  for (const [key, item] of Object.entries(value)) {
    if (BLOCKED_FIELD_PATTERN.test(key)) continue
    sanitized[key] = sanitizeDocument(item)
  }

  return sanitized
}

const main = async () => {
  const sourceUri = process.env.MONGODB_URI
  const sourceDbName = process.env.SOURCE_DB_NAME || process.env.DB_NAME || getDbNameFromUri(sourceUri)
  const targetDbName = process.env.TEST_DB_NAME || getDbNameFromUri(process.env.MONGODB_URI_TEST) || `${sourceDbName}${TEST_DB_SUFFIX}`
  const targetUri = process.env.MONGODB_URI_TEST || withDatabaseName(sourceUri, targetDbName)

  assertSafeConfig({ sourceUri, sourceDbName, targetUri, targetDbName })

  const sourceConnection = await mongoose.createConnection(withDatabaseName(sourceUri, sourceDbName)).asPromise()
  const targetConnection = await mongoose.createConnection(withDatabaseName(targetUri, targetDbName)).asPromise()

  try {
    const results = []

    for (const collectionName of COLLECTION_WHITELIST) {
      results.push(await copyCollection({
        sourceDb: sourceConnection.db,
        targetDb: targetConnection.db,
        collectionName,
      }))
    }

    console.log(`Copied data from ${sourceDbName} to ${targetDbName}`)
    for (const result of results) {
      const detail = result.skipped ? `skipped (${result.reason})` : `${result.copied} documents`
      console.log(`- ${result.collectionName}: ${detail}`)
    }
  } finally {
    await sourceConnection.close()
    await targetConnection.close()
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})

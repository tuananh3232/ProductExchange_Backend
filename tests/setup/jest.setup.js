import dotenv from 'dotenv'

dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || '.env' })

const EXPECTED_TEST_DB_NAME = 'anhdecor_test'

const originalMongoUri = process.env.MONGODB_URI_TEST || process.env.MONGODB_URI || ''
const dbName = (process.env.TEST_DB_NAME || EXPECTED_TEST_DB_NAME).trim()

const injectDatabaseName = (uri, databaseName) => {
  if (!uri) return uri

  try {
    const url = new URL(uri)
    url.pathname = `/${databaseName}`
    return url.toString()
  } catch {
    if (uri.endsWith('/')) return `${uri}${databaseName}`
    return uri
  } 
}

if (dbName !== EXPECTED_TEST_DB_NAME) {
  throw new Error(`Refusing to run tests on non-test database: ${dbName}. TEST_DB_NAME must be exactly ${EXPECTED_TEST_DB_NAME}.`)
}

process.env.NODE_ENV = 'test'
process.env.DB_NAME = dbName
process.env.TEST_DB_NAME = dbName

process.env.PAYOS_CLIENT_ID = process.env.PAYOS_CLIENT_ID || 'test-payos-client-id'
process.env.PAYOS_API_KEY = process.env.PAYOS_API_KEY || 'test-payos-api-key'
process.env.PAYOS_CHECKSUM_KEY = process.env.PAYOS_CHECKSUM_KEY || 'test-payos-checksum-key'

if (originalMongoUri) {
  process.env.MONGODB_URI = injectDatabaseName(originalMongoUri, dbName)
}

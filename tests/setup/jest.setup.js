import dotenv from 'dotenv'

dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || '.env' })

const TEST_DB_SUFFIX = '_test'

const originalMongoUri = process.env.MONGODB_URI_TEST || process.env.MONGODB_URI || ''
const dbName = process.env.TEST_DB_NAME || process.env.DB_NAME || 'productexchange_test'

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

if (!dbName.endsWith(TEST_DB_SUFFIX)) {
  throw new Error(`Refusing to run tests on non-test database: ${dbName}. TEST_DB_NAME must end with ${TEST_DB_SUFFIX}.`)
}

process.env.NODE_ENV = 'test'
process.env.DB_NAME = dbName

process.env.PAYOS_CLIENT_ID = process.env.PAYOS_CLIENT_ID || 'test-payos-client-id'
process.env.PAYOS_API_KEY = process.env.PAYOS_API_KEY || 'test-payos-api-key'
process.env.PAYOS_CHECKSUM_KEY = process.env.PAYOS_CHECKSUM_KEY || 'test-payos-checksum-key'

if (originalMongoUri) {
  process.env.MONGODB_URI = injectDatabaseName(originalMongoUri, dbName)
}

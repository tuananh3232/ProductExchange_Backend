import dotenv from 'dotenv';

dotenv.config();

const originalMongoUri = process.env.MONGODB_URI_TEST || process.env.MONGODB_URI || '';
const dbName = process.env.TEST_DB_NAME || 'productexchange_test';

const injectDatabaseName = (uri, databaseName) => {
  if (!uri) return uri;

  try {
    const url = new URL(uri);
    url.pathname = `/${databaseName}`;

    return url.toString();
  } catch {
    if (uri.endsWith('/')) {
      return `${uri}${databaseName}`;
    }

    return uri;
  }
};

process.env.NODE_ENV = 'test';
process.env.DB_NAME = dbName;

// Fake PayOS credentials so getPayosClient() doesn't throw in tests
// (actual API calls are mocked via jest.unstable_mockModule)
process.env.PAYOS_CLIENT_ID = process.env.PAYOS_CLIENT_ID || 'test-payos-client-id';
process.env.PAYOS_API_KEY = process.env.PAYOS_API_KEY || 'test-payos-api-key';
process.env.PAYOS_CHECKSUM_KEY = process.env.PAYOS_CHECKSUM_KEY || 'test-payos-checksum-key';

if (originalMongoUri) {
  process.env.MONGODB_URI = injectDatabaseName(originalMongoUri, dbName);
}

if (dbName === 'productexchange' && process.env.ALLOW_DESTRUCTIVE_PRODUCTEXCHANGE_TESTS !== 'true') {
  throw new Error(
    'Tests are blocked because they delete collections in productexchange. Set ALLOW_DESTRUCTIVE_PRODUCTEXCHANGE_TESTS=true only when you intentionally want to clear test data in this database.'
  );
}


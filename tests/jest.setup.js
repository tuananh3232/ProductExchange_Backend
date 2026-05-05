import dotenv from 'dotenv';

dotenv.config();

const originalMongoUri = process.env.MONGODB_URI || '';
const testDbName = process.env.MONGODB_TEST_DB_NAME || 'productexchange_test';

const injectDatabaseName = (uri, databaseName) => {
  if (!uri) return uri;

  try {
    const url = new URL(uri);
    const hasDatabasePath = url.pathname && url.pathname !== '/';

    if (!hasDatabasePath) {
      url.pathname = `/${databaseName}`;
    }

    return url.toString();
  } catch {
    if (uri.endsWith('/')) {
      return `${uri}${databaseName}`;
    }

    return uri;
  }
};

process.env.NODE_ENV = 'test';

if (originalMongoUri) {
  process.env.MONGODB_URI = process.env.MONGODB_URI_TEST || injectDatabaseName(originalMongoUri, testDbName);
}

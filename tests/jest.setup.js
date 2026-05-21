import dotenv from 'dotenv';

dotenv.config();

const originalMongoUri = process.env.MONGODB_URI || '';
const dbName = process.env.DB_NAME || 'productexchange';

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
  process.env.MONGODB_URI = injectDatabaseName(originalMongoUri, dbName);
}

if (dbName === 'productexchange' && process.env.ALLOW_DESTRUCTIVE_PRODUCTEXCHANGE_TESTS !== 'true') {
  throw new Error(
    'Tests are blocked because they delete collections in productexchange. Set ALLOW_DESTRUCTIVE_PRODUCTEXCHANGE_TESTS=true only when you intentionally want to clear test data in this database.'
  );
}

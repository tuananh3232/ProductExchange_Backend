import dotenv from 'dotenv'
import mongoose from 'mongoose'

dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || '.env' })

const args = new Map(
  process.argv.slice(2).map((argument) => {
    const [key, ...value] = argument.split('=')
    return [key, value.join('=')]
  })
)

const sourceDatabase = args.get('--source') || process.env.SOURCE_DB_NAME
const targetDatabase = args.get('--target') || process.env.TARGET_DB_NAME
const shouldApply = process.argv.includes('--apply')
const isAllowed = process.env.ALLOW_DATABASE_CLONE === 'true'
const uri = process.env.MONGODB_URI

const assertSafeConfiguration = () => {
  if (!uri) throw new Error('MONGODB_URI is required')
  if (!sourceDatabase || !targetDatabase) throw new Error('--source and --target are required')
  if (sourceDatabase === targetDatabase) throw new Error('Source and target databases must be different')
  if (!targetDatabase.endsWith('_test_upgrade')) {
    throw new Error('Target database must end with _test_upgrade')
  }
  if (shouldApply && !isAllowed) {
    throw new Error('Set ALLOW_DATABASE_CLONE=true for the apply command')
  }
}

const comparableIndex = ({ v, ns, background, ...index }) => index

const copyIndexes = async (sourceCollection, targetCollection) => {
  const indexes = (await sourceCollection.listIndexes().toArray())
    .filter((index) => index.name !== '_id_')
    .map(comparableIndex)

  if (indexes.length) await targetCollection.createIndexes(indexes)
  return indexes.length + 1
}

const serializeDocument = (document) => JSON.stringify(document)

const verifyCollection = async (sourceCollection, targetCollection, expectedIndexes) => {
  const [sourceDocuments, targetDocuments, targetIndexes] = await Promise.all([
    sourceCollection.find({}).sort({ _id: 1 }).toArray(),
    targetCollection.find({}).sort({ _id: 1 }).toArray(),
    targetCollection.listIndexes().toArray(),
  ])

  if (sourceDocuments.length !== targetDocuments.length) {
    throw new Error(`${sourceCollection.collectionName}: document count mismatch`)
  }

  for (let index = 0; index < sourceDocuments.length; index += 1) {
    if (serializeDocument(sourceDocuments[index]) !== serializeDocument(targetDocuments[index])) {
      throw new Error(`${sourceCollection.collectionName}: document mismatch at position ${index}`)
    }
  }

  if (targetIndexes.length !== expectedIndexes) {
    throw new Error(`${sourceCollection.collectionName}: index count mismatch`)
  }

  return { documents: sourceDocuments.length, indexes: targetIndexes.length }
}

const main = async () => {
  assertSafeConfiguration()
  const client = new mongoose.mongo.MongoClient(uri)
  await client.connect()

  try {
    const sourceDb = client.db(sourceDatabase)
    const targetDb = client.db(targetDatabase)
    const sourceCollections = await sourceDb.listCollections({ type: 'collection' }).toArray()
    const targetCollections = await targetDb.listCollections({}, { nameOnly: true }).toArray()

    if (!sourceCollections.length) throw new Error(`Source database ${sourceDatabase} has no collections`)
    if (targetCollections.length) throw new Error(`Target database ${targetDatabase} must be empty`)

    const sourceSummary = []
    for (const collection of sourceCollections) {
      const sourceCollection = sourceDb.collection(collection.name)
      sourceSummary.push({
        name: collection.name,
        documents: await sourceCollection.countDocuments({}),
        indexes: (await sourceCollection.listIndexes().toArray()).length,
      })
    }

    if (!shouldApply) {
      console.log(JSON.stringify({
        mode: 'dry-run',
        source: sourceDatabase,
        target: targetDatabase,
        collections: sourceSummary.length,
        documents: sourceSummary.reduce((total, item) => total + item.documents, 0),
        indexes: sourceSummary.reduce((total, item) => total + item.indexes, 0),
      }, null, 2))
      return
    }

    const snapshot = new Map()
    const session = client.startSession()
    try {
      session.startTransaction({ readConcern: { level: 'snapshot' } })
      for (const collection of sourceCollections) {
        snapshot.set(collection.name, await sourceDb.collection(collection.name).find({}, { session }).toArray())
      }
      await session.commitTransaction()
    } catch (error) {
      await session.abortTransaction().catch(() => undefined)
      throw error
    } finally {
      await session.endSession()
    }

    const results = []
    for (const collection of sourceCollections) {
      const options = collection.options || {}
      await targetDb.createCollection(collection.name, options)
      const targetCollection = targetDb.collection(collection.name)
      const documents = snapshot.get(collection.name) || []
      if (documents.length) await targetCollection.insertMany(documents, { ordered: true })
      const expectedIndexes = await copyIndexes(sourceDb.collection(collection.name), targetCollection)
      const verification = await verifyCollection(sourceDb.collection(collection.name), targetCollection, expectedIndexes)
      results.push({ name: collection.name, ...verification })
    }

    console.log(JSON.stringify({
      mode: 'applied-and-verified',
      source: sourceDatabase,
      target: targetDatabase,
      collections: results.length,
      documents: results.reduce((total, item) => total + item.documents, 0),
      indexes: results.reduce((total, item) => total + item.indexes, 0),
    }, null, 2))
  } finally {
    await client.close()
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})

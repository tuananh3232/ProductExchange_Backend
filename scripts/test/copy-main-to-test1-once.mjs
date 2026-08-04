import { MongoClient } from 'mongodb'

const source = new MongoClient('mongodb+srv://anhntse183220_db_user:12345@cluster0.tlye7u0.mongodb.net/anhdecor')
const target = new MongoClient('mongodb+srv://anhntse183220_db_user:12345@cluster0.tlye7u0.mongodb.net/anhdecor_test1')
await source.connect()
await target.connect()
const sourceDb = source.db('anhdecor')
const targetDb = target.db('anhdecor_test1')
const collections = await sourceDb.listCollections({}, { nameOnly: true }).toArray()
for (const { name } of collections) {
  if (name.startsWith('system.')) continue
  const documents = await sourceDb.collection(name).find({}).toArray()
  await targetDb.collection(name).deleteMany({})
  if (documents.length) await targetDb.collection(name).insertMany(documents, { ordered: false })
  console.log(`${name}: ${documents.length}`)
}
await source.close()
await target.close()
console.log('Đã sao chép toàn bộ collection sang anhdecor_test1; nguồn chỉ được đọc.')

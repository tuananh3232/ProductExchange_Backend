import { connectDB, disconnectDB } from '../src/configs/database.config.js'
import { env } from '../src/configs/env.config.js'
import Category from '../src/models/category.model.js'
import Product, { PRODUCT_TRANSACTION_MODES } from '../src/models/product.model.js'

const shouldApply = process.argv.includes('--apply')
const allowProduction = process.argv.includes('--allow-production')

const normalize = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()

const includesAny = (text, values) => values.some((value) => text.includes(value))

const inferDecorRole = (text, categoryName) => {
  if (includesAny(text, ['den ', 'nen ', 'led', 'anh sang'])) return 'lighting'
  if (includesAny(text, ['tham', 'goi', 'rem', 'vo goi', 'sofa'])) return 'textile'
  if (includesAny(text, ['tranh', 'guong', 'poster', 'pegboard', 'khung tranh', 'ke treo'])) return 'wall_decor'
  if (includesAny(text, ['ban', 'ghe', 'tu ', 'ke ', 'tuong dung', 'tu dau'])) return 'main_item'
  if (includesAny(text, ['binh', 'lo hoa', 'chau cay', 'tuong', 'dong ho', 'khay'])) return 'accent_item'

  const categoryRoles = {
    'ban ghe': 'main_item',
    'tu do': 'main_item',
    'ke decor': 'main_item',
    'tranh': 'wall_decor',
    'den': 'lighting',
    'tham': 'textile',
    'binh hoa': 'accent_item',
    'nen thom': 'lighting',
    'do trang tri': 'accent_item',
    'do decor nha cua': 'wall_decor',
    'do luu tru decor': 'main_item',
  }

  return categoryRoles[normalize(categoryName)] || 'accent_item'
}

const inferStyle = (text, categoryName) => {
  if (includesAny(text, ['vintage', 'retro'])) return 'vintage'
  if (includesAny(text, ['luxury', 'cao cap'])) return 'luxury'
  if (includesAny(text, ['han quoc', 'korean'])) return 'korean'
  if (includesAny(text, ['bohemian', 'moc mac'])) return 'bohemian'
  if (includesAny(text, ['bac au', 'scandinavian', 'ikea', 'toi gian', 'minimalist'])) return 'minimalist'
  if (includesAny(text, ['gaming', 'cong thai hoc', 'led', 'hien dai', 'modern'])) return 'modern'
  return normalize(categoryName) === 'ban ghe' ? 'modern' : 'minimalist'
}

const inferRoomType = (text) => {
  if (includesAny(text, ['gaming', 'lam viec', 'van phong', 'hoc tap', 'pegboard'])) return 'workspace'
  if (includesAny(text, ['phong ngu', 'ngu', 'giuong', 'tu quan ao', 'dau giuong'])) return 'bedroom'
  if (includesAny(text, ['bep', 'nha bep'])) return 'kitchen'
  return 'living_room'
}

const inferColorTone = (text) => {
  if (includesAny(text, ['den ', 'black', 'toi'])) return 'dark'
  if (includesAny(text, ['xanh', 'xam', 'cool'])) return 'cool'
  if (includesAny(text, ['go ', 'nau', 'vang', 'cam', 'am'])) return 'warm'
  if (includesAny(text, ['trang', 'be', 'kem', 'neutral'])) return 'neutral'
  return 'neutral'
}

const inferPriority = (decorRole) => ({
  main_item: 10,
  wall_decor: 8,
  lighting: 7,
  textile: 7,
  accent_item: 6,
  fragrance: 5,
}[decorRole] || 5)

const buildProfile = (product) => {
  const categoryName = product.category?.name || ''
  const text = normalize(`${product.title} ${product.description} ${categoryName}`)
  const decorRole = product.decorRole || inferDecorRole(text, categoryName)
  const style = product.style || inferStyle(text, categoryName)
  const roomType = product.roomType || inferRoomType(text)
  const colorTone = product.colorTone || inferColorTone(text)

  return {
    decorRole,
    style,
    roomType,
    colorTone,
    comboPriority: Number(product.comboPriority) > 0 ? product.comboPriority : inferPriority(decorRole),
  }
}

const sellFilter = {
  $or: [
    { transactionMode: PRODUCT_TRANSACTION_MODES.SELL },
    { transactionMode: null },
    { transactionMode: { $exists: false } },
  ],
}

try {
  if (!env.mongodb.dbName.includes('test') && !allowProduction) {
    throw new Error('Script này chỉ được phép cập nhật cơ sở dữ liệu test. Dùng --allow-production khi đã được phê duyệt riêng.')
  }

  await connectDB()
  const products = await Product.find(sellFilter)
    .populate('category', 'name')
    .select('title description category decorRole style roomType colorTone comboPriority')
    .lean()

  const updates = products.map((product) => ({
    updateOne: {
      filter: { _id: product._id },
      update: { $set: buildProfile(product) },
    },
  }))

  if (shouldApply && updates.length) {
    await Product.bulkWrite(updates, { ordered: false })
    await Product.collection.updateMany(sellFilter, { $unset: { comboProfile: '' } })
  }

  const enriched = products.map((product) => buildProfile(product))
  const summary = {
    database: env.mongodb.dbName,
    mode: shouldApply ? 'applied' : 'dry-run',
    saleProducts: products.length,
    decorRoles: Object.fromEntries(Object.entries(enriched.reduce((counts, item) => {
      counts[item.decorRole] = (counts[item.decorRole] || 0) + 1
      return counts
    }, {})).sort()),
    roomTypes: Object.fromEntries(Object.entries(enriched.reduce((counts, item) => {
      counts[item.roomType] = (counts[item.roomType] || 0) + 1
      return counts
    }, {})).sort()),
  }

  console.log(JSON.stringify(summary, null, 2))
} finally {
  await disconnectDB()
}

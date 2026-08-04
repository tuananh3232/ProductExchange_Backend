import { connectDB, disconnectDB } from '../src/configs/database.config.js'
import { env } from '../src/configs/env.config.js'
import Category from '../src/models/category.model.js'
import Product, { PRODUCT_OWNER_TYPES, PRODUCT_TRANSACTION_MODES } from '../src/models/product.model.js'
import RentalListing from '../src/models/rental-listing.model.js'
import Shop from '../src/models/shop.model.js'
import User from '../src/models/user.model.js'

const SEED_MARKER = 'seed-rental-exchange-test-data'

const rentalSeeds = [
  { title: 'Bộ bàn trà gỗ sồi tối giản', categorySlug: 'bn-gh', dailyRate: 180000, depositAmount: 1200000, condition: 'like_new' },
  { title: 'Đèn cây đứng phong cách Bắc Âu', categorySlug: 'den-decor', dailyRate: 90000, depositAmount: 600000, condition: 'good' },
  { title: 'Thảm lông ngắn màu kem 1,6m', categorySlug: 'tham-va-goi-trang-tri', dailyRate: 70000, depositAmount: 450000, condition: 'like_new' },
  { title: 'Tủ đầu giường mây tre đan', categorySlug: 'do-luu-tru-decor', dailyRate: 110000, depositAmount: 800000, condition: 'good' },
  { title: 'Bình gốm dáng cao trang trí phòng khách', categorySlug: 'binh-hoa-va-cay-decor', dailyRate: 65000, depositAmount: 350000, condition: 'like_new' },
  { title: 'Kệ gỗ treo tường 3 tầng', categorySlug: 'ke-va-do-treo-tuong', dailyRate: 85000, depositAmount: 550000, condition: 'good' },
  { title: 'Bộ 3 tranh canvas trừu tượng', categorySlug: 'tranh-va-khung-anh', dailyRate: 75000, depositAmount: 500000, condition: 'like_new' },
  { title: 'Nến thơm gỗ tuyết tùng cao cấp', categorySlug: 'nen-thom-va-phu-kien-ban', dailyRate: 45000, depositAmount: 250000, condition: 'new' },
]

const exchangeSeeds = [
  { title: 'Gương đứng viền gỗ nguyên khối', categorySlug: 'do-decor-nha-cua', estimatedPrice: 1450000, condition: 'good' },
  { title: 'Bộ ghế ăn bọc nỉ 4 chiếc', categorySlug: 'bn-gh', estimatedPrice: 2200000, condition: 'like_new' },
  { title: 'Đèn bàn cổ điển thân đồng', categorySlug: 'den-decor', estimatedPrice: 680000, condition: 'good' },
  { title: 'Kệ sách gỗ thông 5 tầng', categorySlug: 'ke-va-do-treo-tuong', estimatedPrice: 1350000, condition: 'good' },
  { title: 'Bộ khung ảnh gỗ vintage 6 món', categorySlug: 'tranh-va-khung-anh', estimatedPrice: 520000, condition: 'like_new' },
  { title: 'Ghế thư giãn đệm vải bố', categorySlug: 'bn-gh', estimatedPrice: 1850000, condition: 'good' },
  { title: 'Cây bàng Singapore trang trí', categorySlug: 'binh-hoa-va-cay-decor', estimatedPrice: 790000, condition: 'like_new' },
  { title: 'Hộp lưu trữ cói đan thủ công', categorySlug: 'do-luu-tru-decor', estimatedPrice: 420000, condition: 'new' },
]

const resolveLocation = (owner) => ({
  province: owner?.address?.province || 'Hồ Chí Minh',
  district: owner?.address?.district || 'Quận 1',
})

const buildImages = (imageUrl, key) => [{
  url: imageUrl,
  publicId: `${SEED_MARKER}/${key}`,
  isPrimary: true,
}]

const getImageByCategory = async (categoryId, fallbackImageUrl) => {
  const sourceProduct = await Product.findOne({
    category: categoryId,
    'images.0.url': { $type: 'string', $ne: '' },
  })
    .select('images')
    .lean()

  return sourceProduct?.images?.[0]?.url || fallbackImageUrl
}

const upsertRentalProduct = async ({ seed, index, category, imageUrl, shops, sellers }) => {
  const useShop = index < shops.length
  const sourceOwner = useShop ? shops[index] : sellers[index % sellers.length]
  const ownerType = useShop ? PRODUCT_OWNER_TYPES.SHOP : PRODUCT_OWNER_TYPES.SELLER
  const ownerId = useShop ? sourceOwner.owner : sourceOwner._id
  const location = resolveLocation(sourceOwner)
  const product = await Product.findOneAndUpdate(
    { adminNote: SEED_MARKER, title: seed.title },
    {
      $set: {
        title: seed.title,
        description: `Sản phẩm decor chất lượng, phù hợp cho nhu cầu thuê ngắn hạn tại nhà, studio hoặc sự kiện. Dữ liệu dùng để kiểm thử luồng cho thuê.`,
        price: seed.dailyRate * 10,
        stock: 1,
        listingType: 'sell',
        transactionMode: PRODUCT_TRANSACTION_MODES.RENTAL,
        activeRentalListing: null,
        condition: seed.condition,
        images: buildImages(imageUrl, `rental-${index + 1}`),
        category: category._id,
        owner: ownerId,
        ownerType,
        shop: useShop ? sourceOwner._id : null,
        seller: useShop ? null : sourceOwner._id,
        location,
        status: 'available',
        isActive: true,
        rating: { average: 4.5, count: index + 2 },
        adminNote: SEED_MARKER,
      },
    },
    { upsert: true, returnDocument: 'after', runValidators: true },
  )

  const rentalListing = await RentalListing.findOneAndUpdate(
    { product: product._id, isActive: true },
    {
      $set: {
        product: product._id,
        ownerType,
        seller: useShop ? null : sourceOwner._id,
        shop: useShop ? sourceOwner._id : null,
        title: seed.title,
        description: `Giá thuê theo ngày cho ${seed.title.toLocaleLowerCase('vi-VN')}.`,
        dailyRate: seed.dailyRate,
        depositAmount: seed.depositAmount,
        lateFeePerDay: Math.round(seed.dailyRate * 0.5),
        minRentalDays: 1,
        maxRentalDays: 14,
        isActive: true,
        deactivatedAt: null,
      },
      $setOnInsert: { activatedAt: new Date() },
    },
    { upsert: true, returnDocument: 'after', runValidators: true },
  )

  await Product.updateOne(
    { _id: product._id },
    { $set: { activeRentalListing: rentalListing._id, transactionMode: PRODUCT_TRANSACTION_MODES.RENTAL } },
  )
}

const upsertExchangeProduct = async ({ seed, index, category, imageUrl, sellers }) => {
  const seller = sellers[index % sellers.length]
  await Product.findOneAndUpdate(
    { adminNote: SEED_MARKER, title: seed.title },
    {
      $set: {
        title: seed.title,
        description: `Sản phẩm decor còn tốt, sẵn sàng trao đổi với sản phẩm có giá trị tương đương. Dữ liệu dùng để kiểm thử luồng trao đổi.`,
        price: seed.estimatedPrice,
        stock: 1,
        listingType: 'sell',
        transactionMode: PRODUCT_TRANSACTION_MODES.EXCHANGE,
        activeRentalListing: null,
        condition: seed.condition,
        images: buildImages(imageUrl, `exchange-${index + 1}`),
        category: category._id,
        owner: seller._id,
        ownerType: PRODUCT_OWNER_TYPES.SELLER,
        shop: null,
        seller: seller._id,
        location: resolveLocation(seller),
        status: 'available',
        isActive: true,
        rating: { average: 4.4, count: index + 1 },
        adminNote: SEED_MARKER,
      },
    },
    { upsert: true, returnDocument: 'after', runValidators: true },
  )
}

const run = async () => {
  if (env.mongodb.dbName !== 'anhdecor_test') {
    throw new Error(`Chỉ được phép chạy dữ liệu kiểm thử trên anhdecor_test, DB hiện tại: ${env.mongodb.dbName}`)
  }

  await connectDB()

  const categories = await Category.find({}).select('name slug').lean()
  const categoriesBySlug = new Map(categories.map((category) => [category.slug, category]))
  const requiredSlugs = [...new Set([...rentalSeeds, ...exchangeSeeds].map((seed) => seed.categorySlug))]
  const missingCategories = requiredSlugs.filter((slug) => !categoriesBySlug.has(slug))
  if (missingCategories.length) {
    throw new Error(`Thiếu danh mục: ${missingCategories.join(', ')}`)
  }

  const shops = await Shop.find({ isActive: true, status: 'active' }).select('owner address').lean()
  const sellers = await User.find({ isActive: true, roles: 'seller', 'kyc.status': 'approved' }).select('address').lean()
  if (shops.length < 1 || sellers.length < 1) {
    throw new Error('Cần tối thiểu một shop hoạt động và một seller đã xác thực để tạo dữ liệu')
  }

  const fallbackProduct = await Product.findOne({ 'images.0.url': { $type: 'string', $ne: '' } }).select('images').lean()
  const fallbackImageUrl = fallbackProduct?.images?.[0]?.url
  if (!fallbackImageUrl) {
    throw new Error('Không tìm thấy ảnh sản phẩm để dùng làm ảnh minh hoạ')
  }

  for (const [index, seed] of rentalSeeds.entries()) {
    const category = categoriesBySlug.get(seed.categorySlug)
    const imageUrl = await getImageByCategory(category._id, fallbackImageUrl)
    await upsertRentalProduct({ seed, index, category, imageUrl, shops, sellers })
  }

  for (const [index, seed] of exchangeSeeds.entries()) {
    const category = categoriesBySlug.get(seed.categorySlug)
    const imageUrl = await getImageByCategory(category._id, fallbackImageUrl)
    await upsertExchangeProduct({ seed, index, category, imageUrl, sellers })
  }

  const [activeRentalProductIds, exchangeProducts] = await Promise.all([
    RentalListing.distinct('product', { isActive: true }),
    Product.countDocuments({ transactionMode: PRODUCT_TRANSACTION_MODES.EXCHANGE }),
  ])

  console.log(`Đã bổ sung ${rentalSeeds.length} sản phẩm cho thuê và ${exchangeSeeds.length} sản phẩm trao đổi.`)
  console.log(`Tổng hiện tại — cho thuê hiển thị được: ${activeRentalProductIds.length}, trao đổi: ${exchangeProducts}.`)
}

run()
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    await disconnectDB()
  })

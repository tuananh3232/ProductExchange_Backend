import * as productRepo from '../../repositories/product/product.repository.js'
import AppError from '../../utils/app-error.util.js'
import ERRORS from '../../constants/error.constant.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'
import { paginate } from '../../utils/pagination.util.js'
import { assertDataScope, assertShopPermission } from '../../utils/data-scope.util.js'
import Shop from '../../models/shop.model.js'
import PERMISSIONS from '../../constants/permission.constant.js'
import { SHOP_STATUS } from '../../constants/status.constant.js'
import { ROLES } from '../../constants/role.constant.js'
import { PRODUCT_OWNER_TYPES } from '../../models/product.model.js'
import { uploadBuffer, deleteImage } from '../../utils/cloudinary.util.js'
import { notifySafely } from '../notification/notification.service.js'
import { NOTIFICATION_TARGET_TYPES, NOTIFICATION_TYPES } from '../../constants/notification.constant.js'

const PRODUCT_STATUS_TRANSITIONS = {
  available: ['hidden', 'pending', 'sold'],
  hidden: ['available'],
  pending: ['available', 'hidden', 'sold'],
  sold: [],
}

const normalizeImages = (images = []) => {
  const hasPrimary = images.some((image) => image?.isPrimary)
  return images.map((image, index) => ({
    ...image,
    isPrimary: hasPrimary ? Boolean(image.isPrimary) : index === 0,
  }))
}

// Khi có $text, ưu tiên điểm liên quan trước rồi mới sort theo tiêu chí người dùng chọn
const textSearchOptions = (filter, pag) =>
  '$text' in filter ? { sort: { score: { $meta: 'textScore' }, [pag.sortBy]: pag.sortOrder } } : {}


const normalizeProductSort = (pagination) => {
  const sortMap = {
    newest: { sortBy: 'createdAt', sortOrder: -1 },
    oldest: { sortBy: 'createdAt', sortOrder: 1 },
    price_asc: { sortBy: 'price', sortOrder: 1 },
    price_desc: { sortBy: 'price', sortOrder: -1 },
  }

  return sortMap[pagination.sortBy] ? { ...pagination, ...sortMap[pagination.sortBy] } : pagination
}

const normalizeQueryId = (value) => {
  if (!value) return null
  if (typeof value === 'string') return value

  if (typeof value.toString === 'function') {
    const stringValue = value.toString()
    if (stringValue && stringValue !== '[object Object]') {
      return stringValue
    }
  }

  if (value._id && typeof value._id.toString === 'function') {
    return value._id.toString()
  }

  return null
}

const isAdmin = (userContext) => (userContext?.roles || []).includes(ROLES.ADMIN)
const hasSellerRole = (userContext) => (userContext?.roles || []).includes(ROLES.SELLER)
const getIdString = (value) => (value && value._id ? value._id.toString() : value ? value.toString() : null)

const assertPersonalSellerAccess = (product, userContext, message) => {
  if (isAdmin(userContext)) return

  const userId = getIdString(userContext?._id)
  const sellerId = getIdString(product.seller) || getIdString(product.owner)

  if (userId && sellerId === userId && hasSellerRole(userContext)) {
    return
  }

  throw new AppError(message, HTTP_STATUS.FORBIDDEN, ERRORS.PRODUCT.NOT_OWNER)
}

const assertProductAccess = async (product, userContext, permissionKey, message) => {
  if (product.ownerType === PRODUCT_OWNER_TYPES.SHOP || product.shop) {
    await assertShopPermission({
      user: userContext,
      shopId: product.shop?._id || product.shop,
      permissionKey,
      message,
      errorCode: ERRORS.PRODUCT.NOT_OWNER,
    })
    return
  }

  if (product.ownerType === PRODUCT_OWNER_TYPES.SELLER || product.seller) {
    assertPersonalSellerAccess(product, userContext, message)
    return
  }

  assertDataScope({
    user: userContext,
    ownerId: product.owner?._id || product.owner,
    message,
    errorCode: ERRORS.PRODUCT.NOT_OWNER,
  })
}

const ensureShopWritable = async (shopId, userContext) => {
  if (!shopId) {
    throw new AppError('Sản phẩm thuộc shop bắt buộc có shop', HTTP_STATUS.BAD_REQUEST, ERRORS.SHOP.NOT_FOUND)
  }

  const shop = await Shop.findById(shopId).select('_id owner staff isActive status')
  if (!shop || !shop.isActive) {
    throw new AppError('Không tìm thấy shop', HTTP_STATUS.NOT_FOUND, ERRORS.SHOP.NOT_FOUND)
  }
  if (shop.status !== SHOP_STATUS.ACTIVE) {
    throw new AppError('Shop chưa được kích hoạt, không thể thao tác sản phẩm', HTTP_STATUS.BAD_REQUEST, ERRORS.SHOP.NOT_ACTIVE)
  }

  await assertShopPermission({
    user: userContext,
    shopId,
    permissionKey: PERMISSIONS.PRODUCT_CREATE,
    message: 'Bạn không có quyền thao tác sản phẩm của shop này',
    errorCode: ERRORS.AUTH.FORBIDDEN,
  })

  return shop
}

const ensurePersonalSellerWritable = (userContext) => {
  const roles = new Set(userContext?.roles || [])
  if (!roles.has(ROLES.SELLER) && !roles.has(ROLES.ADMIN)) {
    throw new AppError('Bạn cần được duyệt KYC và có role seller để đăng sản phẩm cá nhân', HTTP_STATUS.FORBIDDEN, ERRORS.AUTH.FORBIDDEN)
  }
}

const resolveCreateOwnership = async (productData, userContext) => {
  const requestedOwnerType = productData.ownerType || (productData.shop ? PRODUCT_OWNER_TYPES.SHOP : PRODUCT_OWNER_TYPES.SELLER)

  if (requestedOwnerType === PRODUCT_OWNER_TYPES.SHOP) {
    await ensureShopWritable(productData.shop, userContext)
    return {
      ownerType: PRODUCT_OWNER_TYPES.SHOP,
      shop: productData.shop,
      seller: null,
      owner: userContext._id,
    }
  }

  if (requestedOwnerType === PRODUCT_OWNER_TYPES.SELLER) {
    ensurePersonalSellerWritable(userContext)
    return {
      ownerType: PRODUCT_OWNER_TYPES.SELLER,
      shop: null,
      seller: userContext._id,
      owner: userContext._id,
    }
  }

  throw new AppError('Loại chủ sở hữu sản phẩm không hợp lệ', HTTP_STATUS.BAD_REQUEST, ERRORS.VALIDATION.INVALID_FORMAT)
}

const normalizeUpdateOwnership = async (product, updateData, userContext) => {
  const nextUpdateData = { ...updateData }

  if (Object.prototype.hasOwnProperty.call(nextUpdateData, 'ownerType')) {
    if (nextUpdateData.ownerType !== product.ownerType) {
      throw new AppError('Không thể chuyển sản phẩm giữa shop và seller cá nhân', HTTP_STATUS.BAD_REQUEST, ERRORS.VALIDATION.INVALID_FORMAT)
    }
    delete nextUpdateData.ownerType
  }

  if (product.ownerType === PRODUCT_OWNER_TYPES.SELLER || product.seller) {
    if (Object.prototype.hasOwnProperty.call(nextUpdateData, 'seller')) {
      const nextSellerId = getIdString(nextUpdateData.seller)
      const currentSellerId = getIdString(product.seller)
      if (nextSellerId && nextSellerId !== currentSellerId) {
        throw new AppError('Không thể chuyển sản phẩm seller cá nhân sang seller khác', HTTP_STATUS.BAD_REQUEST, ERRORS.VALIDATION.INVALID_FORMAT)
      }
    }
    if (Object.prototype.hasOwnProperty.call(nextUpdateData, 'shop') && nextUpdateData.shop) {
      throw new AppError('Sản phẩm seller cá nhân không được gắn shop', HTTP_STATUS.BAD_REQUEST, ERRORS.VALIDATION.INVALID_FORMAT)
    }
    delete nextUpdateData.shop
    delete nextUpdateData.seller
    return nextUpdateData
  }

  if (Object.prototype.hasOwnProperty.call(nextUpdateData, 'seller') && nextUpdateData.seller) {
    throw new AppError('Sản phẩm shop không được gắn seller cá nhân', HTTP_STATUS.BAD_REQUEST, ERRORS.VALIDATION.INVALID_FORMAT)
  }
  delete nextUpdateData.seller

  if (Object.prototype.hasOwnProperty.call(nextUpdateData, 'shop')) {
    await ensureShopWritable(nextUpdateData.shop, userContext)
  }

  return nextUpdateData
}

const buildFilter = (query, { publicOnly = true } = {}) => {
  const filter = {}

  if (publicOnly) {
    filter.isActive = true
  } else if (query.isActive !== undefined) {
    filter.isActive = query.isActive === 'true' || query.isActive === true
  }

  if (query.status) filter.status = query.status
  else if (publicOnly) filter.status = 'available' // Mặc định chỉ lấy sản phẩm còn bán

  const categoryId = normalizeQueryId(query.category)
  if (categoryId) filter.category = categoryId

  const shopId = normalizeQueryId(query.shopId || query.shop)
  if (shopId) filter.shop = shopId

  const sellerId = normalizeQueryId(query.sellerId)
  if (sellerId) filter.seller = sellerId

  if (query.ownerType) filter.ownerType = query.ownerType

  if (query.listingType) filter.listingType = query.listingType
  if (query.condition) filter.condition = query.condition
  const ownerId = normalizeQueryId(query.ownerId)
  if (ownerId) filter.owner = ownerId

  // Lọc theo tỉnh thành
  if (query.province) filter['location.province'] = query.province

  // Lọc theo khoảng giá
  if (query.minPrice || query.maxPrice) {
    filter.price = {}
    if (query.minPrice) filter.price.$gte = Number(query.minPrice)
    if (query.maxPrice) filter.price.$lte = Number(query.maxPrice)
  }

  // Tìm kiếm full-text — normalize input trước khi truyền vào MongoDB
  if (query.search) {
    const q = String(query.search).trim().replace(/\s+/g, ' ')
    if (q.length > 0) filter.$text = { $search: q }
  }

  if (query.visualizerReady === true || query.visualizerReady === 'true') {
    filter['visualProfile.isVisualizerReady'] = true
  }

  return filter
}

export const getProducts = async (query, pagination) => {
  const pag = normalizeProductSort(pagination)
  const filter = buildFilter(query)
  const { items: products, meta } = await paginate(productRepo, filter, pag, textSearchOptions(filter, pag))
  return { products, meta }
}

export const getAdminProducts = async (query, pagination) => {
  const filter = buildFilter(query, { publicOnly: false })
  const pag = normalizeProductSort(pagination)
  const { items: products, meta } = await paginate(productRepo, filter, pag, textSearchOptions(filter, pag))
  return { products, meta }
}

export const getShopProducts = async (shopId, userContext, query, pagination) => {
  await assertShopPermission({
    user: userContext,
    shopId,
    permissionKey: PERMISSIONS.PRODUCT_READ,
    message: 'Bạn không có quyền xem sản phẩm của shop này',
    errorCode: ERRORS.AUTH.FORBIDDEN,
  })

  const filter = buildFilter({ ...query, shopId }, { publicOnly: false })
  if (query.isActive === undefined) {
    filter.isActive = true
  }

  const pag = normalizeProductSort(pagination)
  const { items: products, meta } = await paginate(productRepo, filter, pag, textSearchOptions(filter, pag))
  return { products, meta }
}

export const getSellerProducts = async (userContext, query, pagination) => {
  if (!hasSellerRole(userContext)) {
    throw new AppError('Bạn cần có role seller để xem sản phẩm cá nhân', HTTP_STATUS.FORBIDDEN, ERRORS.AUTH.FORBIDDEN)
  }

  const filter = buildFilter(query, { publicOnly: false })
  filter.ownerType = PRODUCT_OWNER_TYPES.SELLER
  filter.seller = userContext._id
  filter.isActive = true

  delete filter.shop
  delete filter.owner

  const pag = normalizeProductSort(pagination)
  const { items: products, meta } = await paginate(productRepo, filter, pag, textSearchOptions(filter, pag))
  return { products, meta }
}

export const getProductById = async (id) => {
  const product = await productRepo.findById(id)
  if (!product || !product.isActive) {
    throw new AppError('Không tìm thấy sản phẩm', HTTP_STATUS.NOT_FOUND, ERRORS.PRODUCT.NOT_FOUND)
  }
  return product
}

export const createProduct = async (userContext, productData, files = []) => {
  const ownership = await resolveCreateOwnership(productData, userContext)
  const safeProductData = { ...productData }
  delete safeProductData.ownerType

  const uploadedImages = files.length ? await Promise.all(files.map((f) => uploadBuffer(f.buffer, 'products'))) : []
  const images = normalizeImages(uploadedImages)

  return productRepo.create({
    ...safeProductData,
    ...ownership,
    images,
  })
}

export const updateProduct = async (productId, userContext, updateData) => {
  const product = await productRepo.findById(productId)
  if (!product) {
    throw new AppError('Không tìm thấy sản phẩm', HTTP_STATUS.NOT_FOUND, ERRORS.PRODUCT.NOT_FOUND)
  }

  await assertProductAccess(product, userContext, PERMISSIONS.PRODUCT_UPDATE, 'Bạn không có quyền chỉnh sửa sản phẩm này')

  const nextUpdateData = await normalizeUpdateOwnership(product, updateData, userContext)
  if (Object.prototype.hasOwnProperty.call(updateData, 'location') && updateData.location) {
    nextUpdateData.location = {
      ...(product.location || {}),
      ...updateData.location,
    }
  }
  if (Object.prototype.hasOwnProperty.call(updateData, 'images')) {
    nextUpdateData.images = normalizeImages(updateData.images || [])
  }

  return productRepo.updateById(productId, nextUpdateData)
}

export const deleteProduct = async (productId, userContext) => {
  const product = await productRepo.findById(productId)
  if (!product) {
    throw new AppError('Không tìm thấy sản phẩm', HTTP_STATUS.NOT_FOUND, ERRORS.PRODUCT.NOT_FOUND)
  }

  await assertProductAccess(product, userContext, PERMISSIONS.PRODUCT_DELETE, 'Bạn không có quyền xóa sản phẩm này')

  // Soft delete thay vì xóa thật
  await productRepo.updateById(productId, { isActive: false })
}

export const updateProductStatus = async (productId, userContext, nextStatus) => {
  const product = await productRepo.findById(productId)
  if (!product || !product.isActive) {
    throw new AppError('Không tìm thấy sản phẩm', HTTP_STATUS.NOT_FOUND, ERRORS.PRODUCT.NOT_FOUND)
  }

  await assertProductAccess(product, userContext, PERMISSIONS.PRODUCT_UPDATE, 'Bạn không có quyền cập nhật trạng thái sản phẩm này')

  if (product.status === nextStatus) {
    return product
  }

  const allowedStatuses = PRODUCT_STATUS_TRANSITIONS[product.status] || []
  if (!allowedStatuses.includes(nextStatus)) {
    throw new AppError(
      'Không thể chuyển trạng thái sản phẩm theo vòng đời hiện tại',
      HTTP_STATUS.BAD_REQUEST,
      ERRORS.PRODUCT.INVALID_STATUS_TRANSITION
    )
  }

  const updatedProduct = await productRepo.updateById(productId, { status: nextStatus })
  const typeByStatus = {
    hidden: NOTIFICATION_TYPES.PRODUCT_BLOCKED,
    available: product.status === 'hidden' ? NOTIFICATION_TYPES.PRODUCT_UNBLOCKED : NOTIFICATION_TYPES.PRODUCT_APPROVED,
  }
  if (typeByStatus[nextStatus]) {
    await notifySafely({
      recipient: product.owner?._id || product.owner,
      sender: userContext._id,
      type: typeByStatus[nextStatus],
      title: 'Cập nhật sản phẩm',
      message: `Trang thai san pham da cap nhat: ${nextStatus}`,
      targetType: NOTIFICATION_TARGET_TYPES.PRODUCT,
      targetId: product._id,
      actionUrl: `/products/${product._id}`,
      data: { productId: product._id },
    })
  }
  return updatedProduct
}

export const addProductImages = async (productId, userContext, files = []) => {
  const product = await productRepo.findById(productId)
  if (!product || !product.isActive) {
    throw new AppError('Không tìm thấy sản phẩm', HTTP_STATUS.NOT_FOUND, ERRORS.PRODUCT.NOT_FOUND)
  }

  await assertProductAccess(product, userContext, PERMISSIONS.PRODUCT_UPDATE, 'Bạn không có quyền cập nhật ảnh sản phẩm này')

  if (!files.length) {
    throw new AppError('Vui lòng cung cấp ít nhất một ảnh sản phẩm', HTTP_STATUS.BAD_REQUEST, ERRORS.PRODUCT.IMAGE_REQUIRED)
  }

  const hasPrimary = (product.images || []).some((image) => image.isPrimary)
  const uploaded = (await Promise.all(files.map((file) => uploadBuffer(file.buffer, 'products')))).map((image, index) => ({
    ...image,
    isPrimary: !hasPrimary && index === 0,
  }))

  return productRepo.updateById(productId, {
    $push: { images: { $each: uploaded } },
  })
}

export const removeProductImage = async (productId, userContext, publicId) => {
  const product = await productRepo.findById(productId)
  if (!product || !product.isActive) {
    throw new AppError('Không tìm thấy sản phẩm', HTTP_STATUS.NOT_FOUND, ERRORS.PRODUCT.NOT_FOUND)
  }

  await assertProductAccess(product, userContext, PERMISSIONS.PRODUCT_UPDATE, 'Bạn không có quyền cập nhật ảnh sản phẩm này')

  const existed = (product.images || []).some((image) => image.publicId === publicId)
  if (!existed) {
    throw new AppError('Không tìm thấy ảnh sản phẩm', HTTP_STATUS.NOT_FOUND, ERRORS.PRODUCT.IMAGE_NOT_FOUND)
  }

  await deleteImage(publicId)

  const nextImages = normalizeImages((product.images || [])
    .filter((image) => image.publicId !== publicId)
    .map((image) => ({
      url: image.url,
      publicId: image.publicId,
      isPrimary: image.isPrimary,
    })))

  return productRepo.updateById(productId, { images: nextImages })
}

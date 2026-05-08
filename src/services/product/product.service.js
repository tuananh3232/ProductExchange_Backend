import * as productRepo from '../../repositories/product/product.repository.js'
import AppError from '../../utils/app-error.util.js'
import ERRORS from '../../constants/error.constant.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'
import { paginate } from '../../utils/pagination.util.js'
import { assertDataScope, assertShopPermission } from '../../utils/data-scope.util.js'
import Shop from '../../models/shop.model.js'
import PERMISSIONS from '../../constants/permission.constant.js'
import { SHOP_STATUS } from '../../constants/status.constant.js'

const PRODUCT_STATUS_TRANSITIONS = {
  available: ['hidden', 'pending', 'sold'],
  hidden: ['available'],
  pending: ['available', 'hidden', 'sold'],
  sold: [],
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

const assertProductAccess = async (product, userContext, permissionKey, message) => {
  if (product.shop) {
    await assertShopPermission({
      user: userContext,
      shopId: product.shop?._id || product.shop,
      permissionKey,
      message,
      errorCode: ERRORS.PRODUCT.NOT_OWNER,
    })
  } else {
    assertDataScope({
      user: userContext,
      ownerId: product.owner?._id,
      message,
      errorCode: ERRORS.PRODUCT.NOT_OWNER,
    })
  }
}

const ensureShopWritable = async (shopId, userContext) => {
  if (!shopId) return null

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

const buildFilter = (query) => {
  const filter = { isActive: true }

  if (query.status) filter.status = query.status
  else filter.status = 'available' // Mặc định chỉ lấy sản phẩm còn bán

  const categoryId = normalizeQueryId(query.category)
  if (categoryId) filter.category = categoryId

  const shopId = normalizeQueryId(query.shopId)
  if (shopId) filter.shop = shopId

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

  // Tìm kiếm full-text
  if (query.search) {
    filter.$text = { $search: query.search }
  }

  return filter
}

export const getProducts = async (query, pagination) => {
  const filter = buildFilter(query)
  const { items: products, meta } = await paginate(productRepo, filter, pagination)
  return { products, meta }
}

export const getProductById = async (id) => {
  const product = await productRepo.findById(id)
  if (!product || !product.isActive) {
    throw new AppError('Không tìm thấy sản phẩm', HTTP_STATUS.NOT_FOUND, ERRORS.PRODUCT.NOT_FOUND)
  }
  // Tăng lượt xem bất đồng bộ (không chờ)
  productRepo.incrementViews(id)
  return product
}

export const createProduct = async (userContext, productData) => {
  await ensureShopWritable(productData.shop, userContext)

  return productRepo.create({
    ...productData,
    owner: userContext._id,
    shop: productData.shop || null,
  })
}

export const updateProduct = async (productId, userContext, updateData) => {
  const product = await productRepo.findById(productId)
  if (!product) {
    throw new AppError('Không tìm thấy sản phẩm', HTTP_STATUS.NOT_FOUND, ERRORS.PRODUCT.NOT_FOUND)
  }

  await assertProductAccess(product, userContext, PERMISSIONS.PRODUCT_UPDATE, 'Bạn không có quyền chỉnh sửa sản phẩm này')

  if (Object.prototype.hasOwnProperty.call(updateData, 'shop')) {
    await ensureShopWritable(updateData.shop, userContext)
  }

  const nextUpdateData = { ...updateData }
  if (Object.prototype.hasOwnProperty.call(updateData, 'location') && updateData.location) {
    nextUpdateData.location = {
      ...(product.location || {}),
      ...updateData.location,
    }
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

  return productRepo.updateById(productId, { status: nextStatus })
}

export const addProductImages = async (productId, userContext, images = []) => {
  const product = await productRepo.findById(productId)
  if (!product || !product.isActive) {
    throw new AppError('Không tìm thấy sản phẩm', HTTP_STATUS.NOT_FOUND, ERRORS.PRODUCT.NOT_FOUND)
  }

  await assertProductAccess(product, userContext, PERMISSIONS.PRODUCT_UPDATE, 'Bạn không có quyền cập nhật ảnh sản phẩm này')

  const existingIds = new Set((product.images || []).map((image) => image.publicId))
  const normalized = images.filter((image) => !existingIds.has(image.publicId))

  if (!normalized.length) {
    return product
  }

  return productRepo.updateById(productId, {
    $push: { images: { $each: normalized } },
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

  return productRepo.updateById(productId, {
    $pull: { images: { publicId } },
  })
}

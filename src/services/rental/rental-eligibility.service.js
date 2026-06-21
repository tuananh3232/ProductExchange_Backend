import Product, { PRODUCT_OWNER_TYPES } from '../../models/product.model.js'
import Shop from '../../models/shop.model.js'
import AppError from '../../utils/app-error.util.js'
import ERRORS from '../../constants/error.constant.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'

const BLOCKED_PRODUCT_STATUSES = new Set(['sold', 'hidden', 'pending', 'disputed'])

export const assertRentalProductEligibility = async (productId) => {
  const product = await Product.findById(productId)
    .populate('seller', 'name email kyc')
    .populate('shop', 'name owner staff staffPermissions status isActive')
    .populate('category', 'name slug')

  if (!product || !product.isActive) {
    throw new AppError('Không tìm thấy sản phẩm cho thuê', HTTP_STATUS.NOT_FOUND, ERRORS.PRODUCT.NOT_FOUND)
  }

  if (BLOCKED_PRODUCT_STATUSES.has(product.status)) {
    throw new AppError('Sản phẩm không đủ điều kiện cho thuê', HTTP_STATUS.BAD_REQUEST, ERRORS.RENTAL.PRODUCT_NOT_ELIGIBLE)
  }

  return product
}

export const assertRentalListingOwnerContext = async (product, payload, userId) => {
  if (payload.ownerType === 'SHOP') {
    if (product.ownerType !== PRODUCT_OWNER_TYPES.SHOP || !product.shop) {
      throw new AppError('Sản phẩm này không thuộc shop', HTTP_STATUS.BAD_REQUEST, ERRORS.RENTAL.INVALID_OWNER_CONTEXT)
    }

    if (!payload.shopId || String(product.shop._id || product.shop) !== String(payload.shopId)) {
      throw new AppError('Ngữ cảnh shop không khớp với sản phẩm', HTTP_STATUS.BAD_REQUEST, ERRORS.RENTAL.INVALID_OWNER_CONTEXT)
    }

    const shop = typeof product.shop?.toObject === 'function' ? product.shop : await Shop.findById(payload.shopId)
    if (!shop || !shop.isActive || shop.status !== 'active') {
      throw new AppError('Shop không khả dụng để tạo tin cho thuê', HTTP_STATUS.BAD_REQUEST, ERRORS.SHOP.NOT_ACTIVE)
    }

    const isOwner = String(shop.owner) === String(userId)
    const isStaff = (shop.staff || []).some((item) => String(item) === String(userId))

    if (!isOwner && !isStaff) {
      throw new AppError('Bạn không có quyền tạo tin cho thuê cho shop này', HTTP_STATUS.FORBIDDEN, ERRORS.AUTH.FORBIDDEN)
    }

    return {
      ownerType: 'SHOP',
      seller: null,
      shop: shop._id,
    }
  }

  if (product.ownerType !== PRODUCT_OWNER_TYPES.SELLER || !product.seller || String(product.seller._id || product.seller) !== String(userId)) {
    throw new AppError('Bạn không phải chủ sản phẩm cá nhân này', HTTP_STATUS.FORBIDDEN, ERRORS.PRODUCT.NOT_OWNER)
  }

  if (product.seller?.kyc?.status !== 'approved') {
    throw new AppError('Seller cần KYC đã duyệt để bật cho thuê', HTTP_STATUS.BAD_REQUEST, ERRORS.KYC.APPROVAL_REQUIRED)
  }

  return {
    ownerType: 'SELLER',
    seller: product.seller._id || product.seller,
    shop: null,
  }
}

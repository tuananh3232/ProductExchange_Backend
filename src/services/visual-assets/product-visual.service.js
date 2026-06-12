import Product from '../../models/product.model.js'
import Shop from '../../models/shop.model.js'
import { uploadBuffer, deleteImage } from '../../utils/cloudinary.util.js'
import { removeBackground } from './background-removal.service.js'
import AppError from '../../utils/app-error.util.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'
import PERMISSIONS from '../../constants/permission.constant.js'
import { assertShopPermission } from '../../utils/data-scope.util.js'

const _assertShopVisualAssetAccess = async (productId, requestingUser) => {
  const product = await Product.findById(productId)
  if (!product) {
    throw new AppError('San pham khong ton tai', HTTP_STATUS.NOT_FOUND, 'PRODUCT_NOT_FOUND')
  }

  if (!product.shop) {
    throw new AppError('San pham khong thuoc shop nao', HTTP_STATUS.BAD_REQUEST, 'PRODUCT_NO_SHOP')
  }

  const shop = await Shop.findById(product.shop)
  if (!shop) {
    throw new AppError('Khong tim thay shop', HTTP_STATUS.NOT_FOUND, 'SHOP_NOT_FOUND')
  }

  await assertShopPermission({
    user: requestingUser,
    shopId: shop._id,
    permissionKey: PERMISSIONS.SHOP_PRODUCT_VISUAL_ASSET_MANAGE,
    message: 'Ban khong co quyen quan ly visual asset san pham nay',
    errorCode: 'SHOP_PRODUCT_VISUAL_ASSET_FORBIDDEN',
  })

  return product
}

const _computeIsReady = (product) => {
  const { widthCm, heightCm } = product.dimensions || {}
  const cutouts = product.visualAssets?.cutouts || []
  const hasFrontReady = cutouts.some((c) => c.view === 'front' && c.status === 'ready')
  return widthCm > 0 && heightCm > 0 && hasFrontReady
}

export const uploadSourceImage = async (productId, buffer, requestingUser) => {
  const product = await _assertShopVisualAssetAccess(productId, requestingUser)

  if (product.visualAssets?.sourceImage?.publicId) {
    await deleteImage(product.visualAssets.sourceImage.publicId)
  }

  const result = await uploadBuffer(buffer, 'products/source', { format: 'jpg' })

  product.visualAssets.sourceImage = { url: result.url, publicId: result.publicId }
  return product.save()
}

export const previewCutout = async (productId, buffer, { provider = 'remove_bg' } = {}, requestingUser) => {
  const product = await _assertShopVisualAssetAccess(productId, requestingUser)

  const bgResult = await removeBackground({ buffer, provider })

  if (product.visualAssets?.cutoutPreview?.publicId) {
    await deleteImage(product.visualAssets.cutoutPreview.publicId)
  }

  const result = await uploadBuffer(bgResult.buffer, 'products/cutouts-preview', { format: 'png' })

  product.visualAssets.cutoutPreview = { url: result.url, publicId: result.publicId, widthPx: result.width, heightPx: result.height, provider }
  await product.save()

  return { previewUrl: result.url, tempPublicId: result.publicId, widthPx: result.width, heightPx: result.height }
}

export const confirmCutout = async (productId, { tempPublicId, view = 'front', widthCm, heightCm, depthCm } = {}, requestingUser) => {
  const product = await _assertShopVisualAssetAccess(productId, requestingUser)

  const preview = product.visualAssets?.cutoutPreview
  if (!preview?.publicId || preview.publicId !== tempPublicId) {
    throw new AppError('tempPublicId khong khop voi preview hien tai cua san pham', HTTP_STATUS.BAD_REQUEST, 'INVALID_TEMP_PUBLIC_ID')
  }

  product.visualAssets.cutouts.push({
    view,
    url: preview.url,
    publicId: preview.publicId,
    widthPx: preview.widthPx,
    heightPx: preview.heightPx,
    status: 'ready',
    provider: preview.provider,
  })

  product.visualAssets.cutoutPreview = { url: null, publicId: null, widthPx: null, heightPx: null, provider: null }

  if (widthCm) product.dimensions.widthCm = widthCm
  if (heightCm) product.dimensions.heightCm = heightCm
  if (depthCm !== undefined) product.dimensions.depthCm = depthCm

  product.visualProfile.isVisualizerReady = _computeIsReady(product)
  return product.save()
}

export const deleteCutout = async (productId, cutoutPublicId, requestingUser) => {
  const product = await _assertShopVisualAssetAccess(productId, requestingUser)

  const cutout = product.visualAssets.cutouts.find((c) => c.publicId === cutoutPublicId)
  if (!cutout) {
    throw new AppError('Cutout khong ton tai', HTTP_STATUS.NOT_FOUND, 'CUTOUT_NOT_FOUND')
  }

  await deleteImage(cutoutPublicId)

  product.visualAssets.cutouts.pull({ publicId: cutoutPublicId })

  product.visualProfile.isVisualizerReady = _computeIsReady(product)
  return product.save()
}

export const updateVisualProfile = async (productId, { dimensions, visualProfile } = {}, requestingUser) => {
  const product = await _assertShopVisualAssetAccess(productId, requestingUser)

  if (dimensions) Object.assign(product.dimensions, dimensions)
  if (visualProfile) Object.assign(product.visualProfile, visualProfile)

  product.visualProfile.isVisualizerReady = _computeIsReady(product)
  return product.save()
}

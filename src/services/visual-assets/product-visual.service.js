import Product from '../../models/product.model.js'
import Shop from '../../models/shop.model.js'
import { uploadBuffer, deleteImage } from '../../utils/cloudinary.util.js'
import { removeBackground } from './background-removal.service.js'
import AppError from '../../utils/app-error.util.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'

const _assertShopOwner = async (productId, requestingUser) => {
  const product = await Product.findById(productId)
  if (!product) {
    throw new AppError('Sản phẩm không tồn tại', HTTP_STATUS.NOT_FOUND, 'PRODUCT_NOT_FOUND')
  }

  if (!product.shop) {
    throw new AppError('Sản phẩm không thuộc shop nào', HTTP_STATUS.BAD_REQUEST, 'PRODUCT_NO_SHOP')
  }

  const shop = await Shop.findById(product.shop)
  if (!shop || shop.owner.toString() !== requestingUser._id.toString()) {
    throw new AppError('Bạn không có quyền quản lý sản phẩm này', HTTP_STATUS.FORBIDDEN, 'SHOP_OWNER_REQUIRED')
  }

  return product
}

const _computeIsReady = (product) => {
  const { widthCm, heightCm } = product.dimensions || {}
  const cutouts = product.visualAssets?.cutouts || []
  const hasFrontReady = cutouts.some((c) => c.view === 'front' && c.status === 'ready')
  return widthCm > 0 && heightCm > 0 && hasFrontReady
}

export const uploadSourceImage = async (productId, buffer, requestingUser) => {
  const product = await _assertShopOwner(productId, requestingUser)

  if (product.visualAssets?.sourceImage?.publicId) {
    await deleteImage(product.visualAssets.sourceImage.publicId)
  }

  const result = await uploadBuffer(buffer, 'products/source', { format: 'jpg' })

  product.visualAssets.sourceImage = { url: result.url, publicId: result.publicId }
  return product.save()
}

export const uploadCutout = async (productId, buffer, { view = 'front', provider = 'manual' } = {}, requestingUser) => {
  const product = await _assertShopOwner(productId, requestingUser)

  let cutoutBuffer = buffer
  if (provider !== 'manual') {
    const bgResult = await removeBackground({ buffer, provider })
    cutoutBuffer = bgResult.buffer
  }

  const result = await uploadBuffer(cutoutBuffer, 'products/cutouts', { format: 'png' })

  product.visualAssets.cutouts.push({
    view,
    url: result.url,
    publicId: result.publicId,
    widthPx: result.width,
    heightPx: result.height,
    status: 'ready',
    provider,
  })

  product.visualProfile.isVisualizerReady = _computeIsReady(product)
  return product.save()
}

export const deleteCutout = async (productId, cutoutPublicId, requestingUser) => {
  const product = await _assertShopOwner(productId, requestingUser)

  const cutout = product.visualAssets.cutouts.find((c) => c.publicId === cutoutPublicId)
  if (!cutout) {
    throw new AppError('Cutout không tồn tại', HTTP_STATUS.NOT_FOUND, 'CUTOUT_NOT_FOUND')
  }

  await deleteImage(cutoutPublicId)

  product.visualAssets.cutouts.pull({ publicId: cutoutPublicId })

  product.visualProfile.isVisualizerReady = _computeIsReady(product)
  return product.save()
}

export const updateVisualProfile = async (productId, { dimensions, visualProfile } = {}, requestingUser) => {
  const product = await _assertShopOwner(productId, requestingUser)

  if (dimensions) Object.assign(product.dimensions, dimensions)
  if (visualProfile) Object.assign(product.visualProfile, visualProfile)

  product.visualProfile.isVisualizerReady = _computeIsReady(product)
  return product.save()
}

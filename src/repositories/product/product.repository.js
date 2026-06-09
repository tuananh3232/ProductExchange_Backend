import Product from '../../models/product.model.js'

export const normalizeProductImages = (product) => {
  if (!product) return product

  const target = typeof product.toObject === 'function' ? product : { ...product }
  const images = Array.isArray(target.images) ? target.images : []
  const hasPrimary = images.some((image) => image?.isPrimary)

  target.images = images.map((image, index) => {
    const imageObject = typeof image?.toObject === 'function' ? image.toObject() : { ...image }
    return {
      ...imageObject,
      isPrimary: hasPrimary ? Boolean(imageObject.isPrimary) : index === 0,
    }
  })

  if (typeof product.toObject === 'function') {
    product.images = target.images
    return product
  }

  return target
}

const normalizeProducts = (products) => products.map((product) => normalizeProductImages(product))

export const create = (data) => Product.create(data).then(normalizeProductImages)

export const findById = (id) =>
  Product.findById(id)
    .populate('owner', 'name avatar rating phone')
    .populate('seller', 'name avatar rating phone')
    .populate('category', 'name slug')
    .populate('shop', 'name slug owner staff')
    .then(normalizeProductImages)

export const findMany = ({ filter = {}, skip = 0, limit = 10, sortBy = 'createdAt', sortOrder = -1, sort = null }) =>
  Product.find(filter)
    .populate('owner', 'name avatar rating')
    .populate('seller', 'name avatar rating')
    .populate('category', 'name slug')
    .populate('shop', 'name slug')
    .sort(sort || { [sortBy]: sortOrder })
    .skip(skip)
    .limit(limit)
    .lean()
    .then(normalizeProducts)

export const countMany = (filter = {}) => Product.countDocuments(filter)

export const updateById = (id, data) =>
  Product.findByIdAndUpdate(id, data, { returnDocument: 'after', runValidators: true })
    .then(normalizeProductImages)

export const deleteById = (id) => Product.findByIdAndDelete(id)

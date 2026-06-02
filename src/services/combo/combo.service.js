import mongoose from 'mongoose'
import Product from '../../models/product.model.js'
import { COMBO_TYPES, DECOR_ROLES } from '../../constants/combo.constant.js'

const getId = (product) => product._id.toString()

export const getAvailabilityStatus = (product) => {
  if (!product.isActive || product.status !== 'available') return 'inactive'
  if (product.stock <= 0) return 'out_of_stock'
  if (product.stock <= 5) return 'low_stock'
  return 'available'
}

const formatProduct = (product, { canReplace = false } = {}) => ({
  _id: product._id,
  title: product.title,
  price: product.price,
  category: product.category,
  decorRole: product.decorRole,
  style: product.style,
  roomType: product.roomType,
  colorTone: product.colorTone,
  stock: product.stock,
  availabilityStatus: getAvailabilityStatus(product),
  ...(canReplace ? { canReplace: true } : {}),
  images: product.images || [],
})

const getMatchScore = (product, criteria) => {
  let score = Number(product.comboPriority || 0)
  if (criteria.style && product.style === criteria.style) score += 3
  if (criteria.roomType && product.roomType === criteria.roomType) score += 2
  if (criteria.colorTone && product.colorTone === criteria.colorTone) score += 2
  return score
}

const sortProducts = (products, criteria) =>
  [...products].sort((left, right) => {
    const scoreDifference = getMatchScore(right, criteria) - getMatchScore(left, criteria)
    if (scoreDifference) return scoreDifference
    return left.price - right.price
  })

export const groupProductsByDecorRole = (products) =>
  products.reduce((groups, product) => {
    groups[product.decorRole] = [...(groups[product.decorRole] || []), product]
    return groups
  }, {})

const pickProduct = (products, selectedIds, usedProductIds, remainingBudget) => {
  const affordableProducts = products.filter(
    (product) => !selectedIds.has(getId(product)) && product.price <= remainingBudget
  )
  return affordableProducts.find((product) => !usedProductIds.has(getId(product))) || affordableProducts[0]
}

export const buildCombo = ({ productsByRole, targetBudget, maxItems, usedProductIds }) => {
  const selectedProducts = []
  const selectedIds = new Set()
  let totalPrice = 0

  for (const role of DECOR_ROLES) {
    if (selectedProducts.length >= maxItems) break
    const product = pickProduct(productsByRole[role] || [], selectedIds, usedProductIds, targetBudget - totalPrice)
    if (!product) continue
    selectedProducts.push(product)
    selectedIds.add(getId(product))
    totalPrice += product.price
  }

  for (const role of DECOR_ROLES) {
    if (selectedProducts.length >= maxItems) break
    const product = pickProduct(productsByRole[role] || [], selectedIds, usedProductIds, targetBudget - totalPrice)
    if (!product) continue
    selectedProducts.push(product)
    selectedIds.add(getId(product))
    totalPrice += product.price
  }

  selectedProducts.forEach((product) => usedProductIds.add(getId(product)))
  return { products: selectedProducts, totalPrice }
}

export const calculateComboTotal = (products) =>
  products.reduce((total, product) => total + product.price, 0)

export const buildComboReason = (combo, criteria) => {
  const details = [
    criteria.style && `style ${criteria.style}`,
    criteria.roomType && `room ${criteria.roomType}`,
    criteria.colorTone && `tone ${criteria.colorTone}`,
  ].filter(Boolean)
  return `${combo.comboType} combo matches ${details.join(', ') || 'your selected criteria'} without exceeding the budget.`
}

const buildCriteriaFilter = (criteria) => {
  const filter = {
    isActive: true,
    status: 'available',
    stock: { $gt: 0 },
    price: { $lte: criteria.budget },
    decorRole: { $in: DECOR_ROLES },
  }

  for (const field of ['style', 'roomType', 'colorTone']) {
    if (criteria[field]) filter[field] = { $in: [criteria[field], null] }
  }
  return filter
}

export const generateCombos = async (criteria) => {
  const products = await Product.find(buildCriteriaFilter(criteria)).populate('category', 'name slug').lean()
  const sortedProducts = sortProducts(products, criteria)
  const productsByRole = groupProductsByDecorRole(sortedProducts)
  const usedProductIds = new Set()

  return COMBO_TYPES.map(({ comboType, budgetRatio, itemReduction }) => {
    const targetBudget = Math.floor(criteria.budget * budgetRatio)
    const maxItems = Math.max(2, criteria.maxItems - itemReduction)
    const combo = buildCombo({ productsByRole, targetBudget, maxItems, usedProductIds })
    if (!combo.products.length) return null

    const responseCombo = {
      comboType,
      comboName: `${comboType} ${criteria.style || ''} ${criteria.roomType || ''} Combo`.replace(/\s+/g, ' ').trim(),
      style: criteria.style || null,
      roomType: criteria.roomType || null,
      colorTone: criteria.colorTone || null,
      budget: criteria.budget,
      targetBudget,
      totalPrice: calculateComboTotal(combo.products),
      products: combo.products.map((product) => formatProduct(product, { canReplace: true })),
    }
    return { ...responseCombo, reason: buildComboReason(responseCombo, criteria) }
  }).filter(Boolean)
}

export const getAlternatives = async (query) => {
  const excludeProductIds = (query.excludeProductIds || '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => mongoose.isValidObjectId(id))

  const filter = {
    isActive: true,
    status: 'available',
    stock: { $gt: 0 },
    decorRole: query.decorRole,
  }
  if (query.maxPrice) filter.price = { $lte: query.maxPrice }
  if (excludeProductIds.length) filter._id = { $nin: excludeProductIds }

  const products = await Product.find(filter).populate('category', 'name slug').lean()
  return sortProducts(products, query)
    .slice(0, query.limit)
    .map((product) => formatProduct(product))
}

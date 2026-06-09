import mongoose from 'mongoose'
import Product from '../../models/product.model.js'
import { COMBO_TYPES, DECOR_ROLES } from '../../constants/combo.constant.js'
import { createPrng } from '../../utils/seeded-random.util.js'

const MAX_COMBO_ROUNDS = 5 // tối đa 5 vòng × 3 loại = 15 combo

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

// Bản seeded: tie-break cuối bằng random từ seed → thứ tự ổn định cho cùng seed
const sortProductsWithSeed = (products, criteria, seed) => {
  const rand = createPrng(seed)
  const tagged = products.map((p) => ({ p, r: rand() }))
  return tagged
    .sort((a, b) => {
      const sd = getMatchScore(b.p, criteria) - getMatchScore(a.p, criteria)
      if (sd !== 0) return sd
      const pd = a.p.price - b.p.price
      if (pd !== 0) return pd
      return a.r - b.r // seeded tiebreak: chỉ áp dụng khi score và giá bằng nhau
    })
    .map(({ p }) => p)
}

export const groupProductsByDecorRole = (products) =>
  products.reduce((groups, product) => {
    groups[product.decorRole] = [...(groups[product.decorRole] || []), product]
    return groups
  }, {})

// Fix 3: tính tone màu chiếm ưu thế trong combo đang build (để dùng làm tiebreaker)
const getDominantTone = (products) => {
  const counts = {}
  for (const p of products) {
    if (p.colorTone) counts[p.colorTone] = (counts[p.colorTone] || 0) + 1
  }
  const entries = Object.entries(counts)
  return entries.length ? entries.sort((a, b) => b[1] - a[1])[0][0] : null
}

const pickProduct = (products, selectedIds, usedProductIds, remainingBudget, dominantTone = null) => {
  const affordableProducts = products.filter(
    (product) => !selectedIds.has(getId(product)) && product.price <= remainingBudget
  )
  // Soft preference: ưu tiên sản phẩm cùng tone màu với các món đã chọn (chỉ là tiebreaker)
  if (dominantTone) {
    const toneMatch = affordableProducts.find(
      (product) => !usedProductIds.has(getId(product)) && product.colorTone === dominantTone
    )
    if (toneMatch) return toneMatch
  }
  return affordableProducts.find((product) => !usedProductIds.has(getId(product))) || affordableProducts[0]
}

export const buildCombo = ({ productsByRole, targetBudget, maxItems, usedProductIds, rotationOffset = 0 }) => {
  // Fix 2: xoay thứ tự role theo offset — tránh main_item luôn được ưu tiên khi budget hẹp
  const roleOrder = [...DECOR_ROLES.slice(rotationOffset), ...DECOR_ROLES.slice(0, rotationOffset)]
  const selectedProducts = []
  const selectedIds = new Set()
  let totalPrice = 0

  for (const role of roleOrder) {
    if (selectedProducts.length >= maxItems) break
    const dominantTone = getDominantTone(selectedProducts)
    const product = pickProduct(productsByRole[role] || [], selectedIds, usedProductIds, targetBudget - totalPrice, dominantTone)
    if (!product) continue
    selectedProducts.push(product)
    selectedIds.add(getId(product))
    totalPrice += product.price
  }

  for (const role of roleOrder) {
    if (selectedProducts.length >= maxItems) break
    const dominantTone = getDominantTone(selectedProducts)
    const product = pickProduct(productsByRole[role] || [], selectedIds, usedProductIds, targetBudget - totalPrice, dominantTone)
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

export const generateCombos = async (criteria, { seed: inputSeed, page = 1, pageSize = 3 } = {}) => {
  const seed = inputSeed || Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  // Fix 2: tính starting role offset từ seed — đảm bảo cùng seed cho cùng rotation
  const seedOffset = Math.floor(createPrng(seed)() * DECOR_ROLES.length)

  const products = await Product.find(buildCriteriaFilter(criteria)).populate('category', 'name slug').lean()
  const sortedProducts = sortProductsWithSeed(products, criteria, seed)
  const productsByRole = groupProductsByDecorRole(sortedProducts)

  // Sinh nhiều vòng combo cho đến khi hết sản phẩm hoặc đạt giới hạn
  const allCombos = []
  const usedProductIds = new Set()

  while (allCombos.length < MAX_COMBO_ROUNDS * COMBO_TYPES.length) {
    const roundIndex = Math.floor(allCombos.length / COMBO_TYPES.length)
    const rotationOffset = (seedOffset + roundIndex) % DECOR_ROLES.length
    const roundCombos = COMBO_TYPES.map(({ comboType, budgetRatio, itemReduction }) => {
      const targetBudget = Math.floor(criteria.budget * budgetRatio)
      const maxItems = Math.max(2, criteria.maxItems - itemReduction)
      const combo = buildCombo({ productsByRole, targetBudget, maxItems, usedProductIds, rotationOffset })
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

    if (!roundCombos.length) break // sản phẩm cạn, không tạo thêm được
    allCombos.push(...roundCombos)
  }

  const skip = (page - 1) * pageSize
  return {
    combos: allCombos.slice(skip, skip + pageSize),
    total: allCombos.length,
    hasMore: skip + pageSize < allCombos.length,
    seed,
    page,
    pageSize,
  }
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

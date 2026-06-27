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

// Dùng cho getAlternatives: ưu tiên khớp criteria cao, sau đó rẻ hơn trước
const sortProducts = (products, criteria) =>
  [...products].sort((left, right) => {
    const scoreDifference = getMatchScore(right, criteria) - getMatchScore(left, criteria)
    if (scoreDifference) return scoreDifference
    const priceDifference = left.price - right.price
    if (priceDifference) return priceDifference
    return getId(left).localeCompare(getId(right))
  })

// [FIX 2] Sort GIẢM dần theo giá (đắt nhất trước) trong cùng score tier
// → pickProduct sẽ lấy sản phẩm đắt nhất vừa túi → tận dụng ngân sách tối đa
const sortProductsWithSeed = (products, criteria, seed) => {
  const rand = createPrng(seed)
  const tagged = products.map((p) => ({ p, r: rand() }))
  return tagged
    .sort((a, b) => {
      const sd = getMatchScore(b.p, criteria) - getMatchScore(a.p, criteria)
      if (sd !== 0) return sd
      const pd = b.p.price - a.p.price // FIX: descending → đắt nhất trước
      if (pd !== 0) return pd
      return a.r - b.r // seeded tiebreak
    })
    .map(({ p }) => p)
}

export const groupProductsByDecorRole = (products) =>
  products.reduce((groups, product) => {
    groups[product.decorRole] = [...(groups[product.decorRole] || []), product]
    return groups
  }, {})

const getDominantTone = (products) => {
  const counts = {}
  for (const p of products) {
    if (p.colorTone) counts[p.colorTone] = (counts[p.colorTone] || 0) + 1
  }
  const entries = Object.entries(counts)
  return entries.length ? entries.sort((a, b) => b[1] - a[1])[0][0] : null
}

// [FIX 2] perSlotBudget thay vì toàn bộ remainingBudget
// → phân bổ ngân sách đều cho mỗi slot còn lại
const pickProduct = (products, selectedIds, usedProductIds, perSlotBudget, dominantTone = null) => {
  const affordableProducts = products.filter(
    (product) => !selectedIds.has(getId(product)) && product.price <= perSlotBudget
  )
  if (dominantTone) {
    const toneMatch = affordableProducts.find(
      (product) => !usedProductIds.has(getId(product)) && product.colorTone === dominantTone
    )
    if (toneMatch) return toneMatch
  }
  return affordableProducts.find((product) => !usedProductIds.has(getId(product))) || affordableProducts[0]
}

export const buildCombo = ({ productsByRole, targetBudget, maxItems, usedProductIds, rotationOffset = 0 }) => {
  const roleOrder = [...DECOR_ROLES.slice(rotationOffset), ...DECOR_ROLES.slice(0, rotationOffset)]
  const selectedProducts = []
  const selectedIds = new Set()
  let totalPrice = 0

  // [FIX 2] Tính perSlotBudget động: chia ngân sách còn lại cho số slot còn lại
  // → tránh việc slot đầu tiên "chiếm" hết ngân sách bằng sản phẩm đắt
  const pickForRole = (role) => {
    const remainingSlots = maxItems - selectedProducts.length
    if (remainingSlots <= 0) return
    const perSlotBudget = (targetBudget - totalPrice) / remainingSlots
    const dominantTone = getDominantTone(selectedProducts)
    const product = pickProduct(
      productsByRole[role] || [],
      selectedIds,
      usedProductIds,
      perSlotBudget,
      dominantTone,
    )
    if (!product) return
    selectedProducts.push(product)
    selectedIds.add(getId(product))
    totalPrice += product.price
  }

  // Pass 1: mỗi role lấy 1 sản phẩm
  for (const role of roleOrder) {
    if (selectedProducts.length >= maxItems) break
    pickForRole(role)
  }

  // Pass 2: lặp lại role để fill đủ maxItems khi pass 1 thiếu slot
  for (const role of roleOrder) {
    if (selectedProducts.length >= maxItems) break
    pickForRole(role)
  }

  selectedProducts.forEach((product) => usedProductIds.add(getId(product)))
  return { products: selectedProducts, totalPrice }
}

export const calculateComboTotal = (products) =>
  products.reduce((total, product) => total + product.price, 0)

export const buildComboReason = (combo, criteria) => {
  const details = [
    criteria.style && `phong cách ${criteria.style}`,
    criteria.roomType && `không gian ${criteria.roomType}`,
    criteria.colorTone && `tông màu ${criteria.colorTone}`,
  ].filter(Boolean)
  return `Combo ${combo.comboType} phù hợp ${details.join(', ') || 'tiêu chí đã chọn'} trong ngân sách dự kiến.`
}

const buildBaseFilter = (criteria) => ({
  isActive: true,
  status: 'available',
  stock: { $gt: 0 },
  price: { $lte: criteria.budget },
  decorRole: { $in: DECOR_ROLES },
})

const COMBO_CRITERIA_FIELDS = ['style', 'roomType', 'colorTone']

const buildCriteriaFilter = (criteria, fields = COMBO_CRITERIA_FIELDS) => {
  const filter = {}
  for (const field of fields) {
    if (criteria[field]) filter[field] = { $in: [criteria[field], null] }
  }
  return filter
}

// [FIX 3] Fallback query khi pool sản phẩm quá ít:
// - Lần 1: lọc strict (style + roomType + colorTone, cho phép null)
// - Lần 2: bỏ colorTone nếu pool vẫn nhỏ
// - Lần 3: bỏ thêm style nếu vẫn nhỏ (giữ roomType vì quan trọng nhất với người dùng)
const fetchProductPool = async (criteria) => {
  const minPoolSize = Math.max((criteria.maxItems || 5) * COMBO_TYPES.length * 2, 20)

  // Strict filter
  const strictFilter = { ...buildBaseFilter(criteria), ...buildCriteriaFilter(criteria) }
  const products = await Product.find(strictFilter).populate('category', 'name slug').lean()
  if (products.length >= minPoolSize) return products

  // Fallback 1: thả lỏng colorTone
  const seen = new Set(products.map((p) => p._id.toString()))
  if (criteria.colorTone) {
    const f1 = buildBaseFilter(criteria)
    Object.assign(f1, buildCriteriaFilter(criteria, ['style', 'roomType']))
    const extras1 = await Product.find(f1).populate('category', 'name slug').lean()
    for (const p of extras1) {
      if (!seen.has(p._id.toString())) {
        seen.add(p._id.toString())
        products.push(p)
      }
    }
    if (products.length >= minPoolSize) return products
  }

  // Fallback 2: thả lỏng thêm style (giữ roomType)
  if (criteria.style) {
    const f2 = buildBaseFilter(criteria)
    Object.assign(f2, buildCriteriaFilter(criteria, ['roomType']))
    const extras2 = await Product.find(f2).populate('category', 'name slug').lean()
    for (const p of extras2) {
      if (!seen.has(p._id.toString())) {
        seen.add(p._id.toString())
        products.push(p)
      }
    }
  }

  return products
}

const parseExcludeProductIds = (rawExcludeProductIds) => {
  if (!rawExcludeProductIds) return []

  return [...new Set(
    String(rawExcludeProductIds)
      .split(',')
      .map((id) => id.trim())
      .filter((id) => mongoose.isValidObjectId(id))
  )]
}

const buildAlternativesBaseFilter = (query, excludeProductIds) => {
  const filter = {
    isActive: true,
    status: 'available',
    stock: { $gt: 0 },
    decorRole: query.decorRole,
  }

  if (query.maxPrice) filter.price = { $lte: query.maxPrice }
  if (excludeProductIds.length) filter._id = { $nin: excludeProductIds }

  return filter
}

const fetchAlternativePool = async (query, excludeProductIds) => {
  const limit = Number(query.limit) || 10
  const minPoolSize = Math.max(limit * 2, 10)
  const baseFilter = buildAlternativesBaseFilter(query, excludeProductIds)
  const products = []
  const seen = new Set()

  const mergeQuery = async (criteriaFields, fallbackLevel) => {
    const filter = { ...baseFilter, ...buildCriteriaFilter(query, criteriaFields) }
    const matches = await Product.find(filter).populate('category', 'name slug').lean()
    for (const product of matches) {
      const id = getId(product)
      if (seen.has(id)) continue
      seen.add(id)
      products.push({ product, fallbackLevel })
    }
  }

  await mergeQuery(COMBO_CRITERIA_FIELDS, 0)
  if (products.length >= minPoolSize) return products

  if (query.colorTone) {
    await mergeQuery(['style', 'roomType'], 1)
    if (products.length >= minPoolSize) return products
  }

  if (query.style) {
    await mergeQuery(['roomType'], 2)
    if (products.length >= minPoolSize) return products
  }

  await mergeQuery([], 3)
  return products
}

const sortAlternativeCandidates = (candidates, criteria) =>
  [...candidates].sort((left, right) => {
    const leftPriorityBucket = Math.min(left.fallbackLevel, 2)
    const rightPriorityBucket = Math.min(right.fallbackLevel, 2)
    const fallbackDifference = leftPriorityBucket - rightPriorityBucket
    if (fallbackDifference) return fallbackDifference

    const scoreDifference = getMatchScore(right.product, criteria) - getMatchScore(left.product, criteria)
    if (scoreDifference) return scoreDifference

    const priceDifference = left.product.price - right.product.price
    if (priceDifference) return priceDifference

    return getId(left.product).localeCompare(getId(right.product))
  })

export const generateCombos = async (criteria, { seed: inputSeed, page = 1, pageSize = 3 } = {}) => {
  const seed = inputSeed || Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  const seedOffset = Math.floor(createPrng(seed)() * DECOR_ROLES.length)

  // [FIX 3] Dùng pool có fallback thay vì query cứng
  const products = await fetchProductPool(criteria)
  const sortedProducts = sortProductsWithSeed(products, criteria, seed)
  const productsByRole = groupProductsByDecorRole(sortedProducts)

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

      const styleLabel = criteria.style || ''
      const roomLabel = criteria.roomType || ''
      const responseCombo = {
        comboType,
        // [FIX 1] Thêm số thứ tự vòng → tên duy nhất qua các trang → tránh trùng key ở FE
        comboName: `${comboType} ${styleLabel} ${roomLabel} Combo #${roundIndex + 1}`.replace(/\s+/g, ' ').trim(),
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

    if (!roundCombos.length) break
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
  const excludeProductIds = parseExcludeProductIds(query.excludeProductIds)
  const candidates = await fetchAlternativePool(query, excludeProductIds)

  return sortAlternativeCandidates(candidates, query)
    .slice(0, query.limit)
    .map(({ product }) => formatProduct(product))
}

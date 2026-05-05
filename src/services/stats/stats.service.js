import mongoose from 'mongoose'
import Order from '../../models/order.model.js'
import Product from '../../models/product.model.js'
import Shop from '../../models/shop.model.js'
import Payment from '../../models/payment.model.js'
import User from '../../models/user.model.js'
import AppError from '../../utils/app-error.util.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'
import ERRORS from '../../constants/error.constant.js'
import { PERMISSIONS } from '../../constants/permission.constant.js'
import { assertShopPermission } from '../../utils/data-scope.util.js'
import { ORDER_STATUS, PAYMENT_STATUS, PRODUCT_STATUS } from '../../constants/status.constant.js'

const TIMEZONE = 'Asia/Ho_Chi_Minh'

const toObjectId = (value) => new mongoose.Types.ObjectId(value.toString())

const getIdString = (value) => {
  if (!value) return null
  if (value._id) return value._id.toString()
  return value.toString()
}

const parseDateInput = (value) => {
  if (!value) return null

  const ddmmyyyyMatch = /^([0-3]?\d)\/([01]?\d)\/(\d{4})$/u.exec(value)
  if (ddmmyyyyMatch) {
    const day = Number(ddmmyyyyMatch[1])
    const month = Number(ddmmyyyyMatch[2])
    const year = Number(ddmmyyyyMatch[3])
    const parsed = new Date(year, month - 1, day)

    if (
      parsed.getFullYear() !== year ||
      parsed.getMonth() !== month - 1 ||
      parsed.getDate() !== day
    ) {
      return new Date('invalid')
    }

    return parsed
  }

  return new Date(value)
}

const parseDateFilter = (query, field) => {
  const match = {}
  const { startDate, endDate } = query || {}

  if (!startDate && !endDate) {
    return match
  }

  const range = {}

  if (startDate) {
    const start = parseDateInput(startDate)
    if (Number.isNaN(start.getTime())) {
      throw new AppError('Ngày bắt đầu không hợp lệ', HTTP_STATUS.BAD_REQUEST, ERRORS.VALIDATION.INVALID_FORMAT)
    }
    range.$gte = start
  }

  if (endDate) {
    const end = parseDateInput(endDate)
    if (Number.isNaN(end.getTime())) {
      throw new AppError('Ngày kết thúc không hợp lệ', HTTP_STATUS.BAD_REQUEST, ERRORS.VALIDATION.INVALID_FORMAT)
    }
    range.$lte = end
  }

  match[field] = range
  return match
}

const normalizePeriod = (period) => (period === 'month' ? 'month' : 'day')

const fillStatusSummary = (allStatuses, rows = []) => {
  const summary = Object.fromEntries(allStatuses.map((status) => [status, 0]))

  for (const row of rows) {
    if (row && row._id in summary) {
      summary[row._id] = row.count
    }
  }

  return summary
}

const aggregateStatusSummary = async (Model, match = {}) => {
  const rows = await Model.aggregate([
    { $match: match },
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ])

  return rows
}

const getRevenueSeries = async ({ match = {}, shopId = null, period = 'day' }) => {
  const dateFormat = normalizePeriod(period) === 'month' ? '%Y-%m' : '%Y-%m-%d'
  const pipeline = [
    { $match: { status: PAYMENT_STATUS.PAID, ...match } },
    {
      $lookup: {
        from: 'orders',
        localField: 'order',
        foreignField: '_id',
        as: 'order',
      },
    },
    { $unwind: '$order' },
  ]

  if (shopId) {
    pipeline.push({ $match: { 'order.shop': toObjectId(shopId) } })
  }

  pipeline.push(
    {
      $group: {
        _id: {
          $dateToString: {
            format: dateFormat,
            date: '$paidAt',
            timezone: TIMEZONE,
          },
        },
        revenue: { $sum: '$amount' },
        orderCount: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } }
  )

  return Payment.aggregate(pipeline)
}

const getRevenueSummary = async ({ match = {}, shopId = null }) => {
  const pipeline = [
    { $match: { status: PAYMENT_STATUS.PAID, ...match } },
    {
      $lookup: {
        from: 'orders',
        localField: 'order',
        foreignField: '_id',
        as: 'order',
      },
    },
    { $unwind: '$order' },
  ]

  if (shopId) {
    pipeline.push({ $match: { 'order.shop': toObjectId(shopId) } })
  }

  pipeline.push({
    $group: {
      _id: null,
      totalRevenue: { $sum: '$amount' },
      paidOrders: { $sum: 1 },
    },
  })

  const [summary = { totalRevenue: 0, paidOrders: 0 }] = await Payment.aggregate(pipeline)
  return summary
}

const getTopShops = async ({ match = {}, limit = 5 }) => {
  const rows = await Payment.aggregate([
    { $match: { status: PAYMENT_STATUS.PAID, ...match } },
    {
      $lookup: {
        from: 'orders',
        localField: 'order',
        foreignField: '_id',
        as: 'order',
      },
    },
    { $unwind: '$order' },
    {
      $group: {
        _id: '$order.shop',
        revenue: { $sum: '$amount' },
        paidOrders: { $sum: 1 },
      },
    },
    { $sort: { revenue: -1, paidOrders: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'shops',
        localField: '_id',
        foreignField: '_id',
        as: 'shop',
      },
    },
    { $unwind: '$shop' },
    {
      $project: {
        _id: 0,
        shopId: '$_id',
        shopName: '$shop.name',
        slug: '$shop.slug',
        revenue: 1,
        paidOrders: 1,
      },
    },
  ])

  return rows
}

const getTopProducts = async ({ match = {}, shopId = null, limit = 5 }) => {
  const pipeline = [
    { $match: { status: PAYMENT_STATUS.PAID, ...match } },
    {
      $lookup: {
        from: 'orders',
        localField: 'order',
        foreignField: '_id',
        as: 'order',
      },
    },
    { $unwind: '$order' },
  ]

  if (shopId) {
    pipeline.push({ $match: { 'order.shop': toObjectId(shopId) } })
  }

  pipeline.push(
    {
      $group: {
        _id: '$order.product',
        revenue: { $sum: '$amount' },
        paidOrders: { $sum: 1 },
        totalQuantity: { $sum: '$order.quantity' },
      },
    },
    { $sort: { revenue: -1, paidOrders: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'products',
        localField: '_id',
        foreignField: '_id',
        as: 'product',
      },
    },
    { $unwind: '$product' },
    {
      $project: {
        _id: 0,
        productId: '$_id',
        productName: '$product.title',
        status: '$product.status',
        shop: '$product.shop',
        revenue: 1,
        paidOrders: 1,
        totalQuantity: 1,
        views: '$product.views',
      },
    }
  )

  return Payment.aggregate(pipeline)
}

const buildAdminOverview = async (query = {}) => {
  const createdAtMatch = parseDateFilter(query, 'createdAt')
  const paidAtMatch = parseDateFilter(query, 'paidAt')

  const [
    revenueSummary,
    orderRows,
    productRows,
    totalShops,
    totalUsers,
  ] = await Promise.all([
    getRevenueSummary({ match: paidAtMatch }),
    aggregateStatusSummary(Order, createdAtMatch),
    aggregateStatusSummary(Product, createdAtMatch),
    Shop.countDocuments({ ...createdAtMatch, isActive: true }),
    User.countDocuments({ ...createdAtMatch, isActive: true }),
  ])

  return {
    revenue: revenueSummary,
    totals: {
      shops: totalShops,
      users: totalUsers,
      orders: await Order.countDocuments({ ...createdAtMatch, isActive: true }),
      products: await Product.countDocuments({ ...createdAtMatch, isActive: true }),
    },
    orders: fillStatusSummary(Object.values(ORDER_STATUS), orderRows),
    products: fillStatusSummary(Object.values(PRODUCT_STATUS), productRows),
  }
}

const buildShopOverview = async (shopId, userContext, query = {}) => {
  await assertShopPermission({
    user: userContext,
    shopId,
    permissionKey: PERMISSIONS.SHOP_VIEW_STATS,
    message: 'Bạn không có quyền xem thống kê của shop này',
    errorCode: ERRORS.AUTH.FORBIDDEN,
  })

  const shop = await Shop.findById(shopId)
    .populate('owner', 'name email role roles')
    .populate('staff', 'name email role roles')
    .populate('staffPermissions.staffUser', 'name email role roles')

  if (!shop || !shop.isActive) {
    throw new AppError('Không tìm thấy shop', HTTP_STATUS.NOT_FOUND, ERRORS.STATS.SHOP_NOT_FOUND)
  }

  const createdAtMatch = parseDateFilter(query, 'createdAt')
  const paidAtMatch = parseDateFilter(query, 'paidAt')
  const shopObjectId = toObjectId(shopId)

  const [revenueSummary, orderRows, productRows, topProducts, revenueSeries] = await Promise.all([
    getRevenueSummary({ match: paidAtMatch, shopId }),
    aggregateStatusSummary(Order, { ...createdAtMatch, shop: shopObjectId }),
    aggregateStatusSummary(Product, { ...createdAtMatch, shop: shopObjectId }),
    getTopProducts({ match: paidAtMatch, shopId }),
    getRevenueSeries({ match: paidAtMatch, shopId, period: query.period }),
  ])

  const staffPermissions = (shop.staffPermissions || []).map((entry) => ({
    staffUser: entry.staffUser,
    permissions: entry.permissions || [],
    updatedBy: entry.updatedBy,
    updatedAt: entry.updatedAt,
  }))

  const permissionByStaffId = new Map((shop.staffPermissions || []).map((entry) => [getIdString(entry.staffUser), entry]))

  const staff = (shop.staff || []).map((member) => {
    const entry = permissionByStaffId.get(getIdString(member))
    return {
      _id: member._id,
      name: member.name,
      email: member.email,
      role: member.role,
      roles: member.roles,
      permissions: entry ? entry.permissions || [] : [],
      updatedAt: entry ? entry.updatedAt || null : null,
    }
  })

  return {
    shop: {
      _id: shop._id,
      name: shop.name,
      slug: shop.slug,
      owner: shop.owner,
      staffCount: (shop.staff || []).length,
      staffPermissions,
    },
    revenue: revenueSummary,
    revenueSeries,
    totals: {
      orders: await Order.countDocuments({ ...createdAtMatch, shop: shopObjectId, isActive: true }),
      products: await Product.countDocuments({ ...createdAtMatch, shop: shopObjectId, isActive: true }),
      staff: (shop.staff || []).length,
    },
    orders: fillStatusSummary(Object.values(ORDER_STATUS), orderRows),
    products: fillStatusSummary(Object.values(PRODUCT_STATUS), productRows),
    staff,
    topProducts,
  }
}

const buildShopProducts = async (shopId, userContext, query = {}) => {
  await assertShopPermission({
    user: userContext,
    shopId,
    permissionKey: PERMISSIONS.SHOP_VIEW_STATS,
    message: 'Bạn không có quyền xem thống kê của shop này',
    errorCode: ERRORS.AUTH.FORBIDDEN,
  })

  const createdAtMatch = parseDateFilter(query, 'createdAt')
  const shopObjectId = toObjectId(shopId)
  const [statusRows, topProducts] = await Promise.all([
    aggregateStatusSummary(Product, { ...createdAtMatch, shop: shopObjectId }),
    getTopProducts({ shopId, limit: 5 }),
  ])

  return {
    summary: fillStatusSummary(Object.values(PRODUCT_STATUS), statusRows),
    topProducts,
  }
}

const buildShopOrders = async (shopId, userContext, query = {}) => {
  await assertShopPermission({
    user: userContext,
    shopId,
    permissionKey: PERMISSIONS.SHOP_VIEW_STATS,
    message: 'Bạn không có quyền xem thống kê của shop này',
    errorCode: ERRORS.AUTH.FORBIDDEN,
  })

  const createdAtMatch = parseDateFilter(query, 'createdAt')
  const shopObjectId = toObjectId(shopId)
  const statusRows = await aggregateStatusSummary(Order, { ...createdAtMatch, shop: shopObjectId })

  return {
    summary: fillStatusSummary(Object.values(ORDER_STATUS), statusRows),
  }
}

const buildShopStaff = async (shopId, userContext) => {
  await assertShopPermission({
    user: userContext,
    shopId,
    permissionKey: PERMISSIONS.SHOP_VIEW_STATS,
    message: 'Bạn không có quyền xem thống kê của shop này',
    errorCode: ERRORS.AUTH.FORBIDDEN,
  })

  const shop = await Shop.findById(shopId)
    .populate('staff', 'name email role roles')
    .populate('staffPermissions.staffUser', 'name email role roles')

  if (!shop || !shop.isActive) {
    throw new AppError('Không tìm thấy shop', HTTP_STATUS.NOT_FOUND, ERRORS.STATS.SHOP_NOT_FOUND)
  }

  const permissionByStaffId = new Map((shop.staffPermissions || []).map((entry) => [getIdString(entry.staffUser), entry]))

  return {
    totalStaff: (shop.staff || []).length,
    staff: (shop.staff || []).map((member) => {
      const entry = permissionByStaffId.get(getIdString(member))
      return {
        _id: member._id,
        name: member.name,
        email: member.email,
        role: member.role,
        roles: member.roles,
        permissions: entry ? entry.permissions || [] : [],
        updatedAt: entry ? entry.updatedAt || null : null,
      }
    }),
  }
}

export const getAdminRevenue = async (query = {}) => {
  const paidAtMatch = parseDateFilter(query, 'paidAt')
  return {
    summary: await getRevenueSummary({ match: paidAtMatch }),
    series: await getRevenueSeries({ match: paidAtMatch, period: query.period }),
  }
}

export const getAdminTopShops = async (query = {}) => {
  const paidAtMatch = parseDateFilter(query, 'paidAt')
  return { shops: await getTopShops({ match: paidAtMatch, limit: Number(query.limit) || 5 }) }
}

export const getAdminTopProducts = async (query = {}) => {
  const paidAtMatch = parseDateFilter(query, 'paidAt')
  return { products: await getTopProducts({ match: paidAtMatch, limit: Number(query.limit) || 5 }) }
}

export {
  buildAdminOverview as getAdminOverview,
  buildShopOverview as getShopOverview,
  buildShopProducts as getShopProducts,
  buildShopOrders as getShopOrders,
  buildShopStaff as getShopStaff,
}
import MESSAGES from '../../constants/message.constant.js'
import { sendSuccess } from '../../utils/response.util.js'
import { asyncHandler } from '../../utils/async-handler.util.js'
import {
  getAdminOverview,
  getAdminRevenue,
  getAdminTopProducts,
  getAdminTopShops,
  getShopOrders,
  getShopOverview,
  getShopProducts,
  getShopStaff,
} from '../../services/stats/stats.service.js'

export const adminOverview = asyncHandler(async (req, res) => {
  const data = await getAdminOverview(req.query)
  sendSuccess(res, { message: MESSAGES.STATS.ADMIN_OVERVIEW_FETCHED, data })
})

export const adminRevenue = asyncHandler(async (req, res) => {
  const data = await getAdminRevenue(req.query)
  sendSuccess(res, { message: MESSAGES.STATS.ADMIN_REVENUE_FETCHED, data })
})

export const adminTopShops = asyncHandler(async (req, res) => {
  const data = await getAdminTopShops(req.query)
  sendSuccess(res, { message: MESSAGES.STATS.ADMIN_TOP_SHOPS_FETCHED, data })
})

export const adminTopProducts = asyncHandler(async (req, res) => {
  const data = await getAdminTopProducts(req.query)
  sendSuccess(res, { message: MESSAGES.STATS.ADMIN_TOP_PRODUCTS_FETCHED, data })
})

export const shopOverview = asyncHandler(async (req, res) => {
  const data = await getShopOverview(req.params.id, req.user, req.query)
  sendSuccess(res, { message: MESSAGES.STATS.SHOP_OVERVIEW_FETCHED, data })
})

export const shopProducts = asyncHandler(async (req, res) => {
  const data = await getShopProducts(req.params.id, req.user, req.query)
  sendSuccess(res, { message: MESSAGES.STATS.SHOP_PRODUCTS_FETCHED, data })
})

export const shopOrders = asyncHandler(async (req, res) => {
  const data = await getShopOrders(req.params.id, req.user, req.query)
  sendSuccess(res, { message: MESSAGES.STATS.SHOP_ORDERS_FETCHED, data })
})

export const shopStaff = asyncHandler(async (req, res) => {
  const data = await getShopStaff(req.params.id, req.user)
  sendSuccess(res, { message: MESSAGES.STATS.SHOP_STAFF_FETCHED, data })
})

import MESSAGES from '../../constants/message.constant.js'
import { sendSuccess } from '../../utils/response.util.js'
import {
  getAdminOverview,
  getAdminRevenue,
  getAdminTopProducts,
  getAdminTopShops,
  getShopDeliveries,
  getShopOrders,
  getShopOverview,
  getShopProducts,
  getShopRevenue,
  getShopStaff,
} from '../../services/stats/stats.service.js'

export const adminOverview = async (req, res, next) => {
  try {
    const data = await getAdminOverview(req.query)
    return sendSuccess(res, {
      message: MESSAGES.STATS.ADMIN_OVERVIEW_FETCHED,
      data,
    })
  } catch (error) {
    next(error)
  }
}

export const adminRevenue = async (req, res, next) => {
  try {
    const data = await getAdminRevenue(req.query)
    return sendSuccess(res, {
      message: MESSAGES.STATS.ADMIN_REVENUE_FETCHED,
      data,
    })
  } catch (error) {
    next(error)
  }
}

export const adminTopShops = async (req, res, next) => {
  try {
    const data = await getAdminTopShops(req.query)
    return sendSuccess(res, {
      message: MESSAGES.STATS.ADMIN_TOP_SHOPS_FETCHED,
      data,
    })
  } catch (error) {
    next(error)
  }
}

export const adminTopProducts = async (req, res, next) => {
  try {
    const data = await getAdminTopProducts(req.query)
    return sendSuccess(res, {
      message: MESSAGES.STATS.ADMIN_TOP_PRODUCTS_FETCHED,
      data,
    })
  } catch (error) {
    next(error)
  }
}

export const shopOverview = async (req, res, next) => {
  try {
    const data = await getShopOverview(req.params.id, req.user, req.query)
    return sendSuccess(res, {
      message: MESSAGES.STATS.SHOP_OVERVIEW_FETCHED,
      data,
    })
  } catch (error) {
    next(error)
  }
}

export const shopRevenue = async (req, res, next) => {
  try {
    const data = await getShopRevenue(req.params.id, req.user, req.query)
    return sendSuccess(res, {
      message: MESSAGES.STATS.SHOP_REVENUE_FETCHED,
      data,
    })
  } catch (error) {
    next(error)
  }
}

export const shopProducts = async (req, res, next) => {
  try {
    const data = await getShopProducts(req.params.id, req.user, req.query)
    return sendSuccess(res, {
      message: MESSAGES.STATS.SHOP_PRODUCTS_FETCHED,
      data,
    })
  } catch (error) {
    next(error)
  }
}

export const shopOrders = async (req, res, next) => {
  try {
    const data = await getShopOrders(req.params.id, req.user, req.query)
    return sendSuccess(res, {
      message: MESSAGES.STATS.SHOP_ORDERS_FETCHED,
      data,
    })
  } catch (error) {
    next(error)
  }
}

export const shopStaff = async (req, res, next) => {
  try {
    const data = await getShopStaff(req.params.id, req.user)
    return sendSuccess(res, {
      message: MESSAGES.STATS.SHOP_STAFF_FETCHED,
      data,
    })
  } catch (error) {
    next(error)
  }
}

export const shopDeliveries = async (req, res, next) => {
  try {
    const data = await getShopDeliveries(req.params.id, req.user, req.query)
    return sendSuccess(res, {
      message: MESSAGES.STATS.SHOP_DELIVERIES_FETCHED,
      data,
    })
  } catch (error) {
    next(error)
  }
}
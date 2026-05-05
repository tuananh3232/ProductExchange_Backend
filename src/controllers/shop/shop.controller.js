import * as shopService from '../../services/shop/shop.service.js'
import { sendSuccess } from '../../utils/response.util.js'
import { getPaginationParams } from '../../utils/pagination.util.js'
import MESSAGES from '../../constants/message.constant.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'

export const createShop = async (req, res, next) => {
  try {
    const shop = await shopService.createShop(req.user._id, req.body)
    sendSuccess(res, {
      message: MESSAGES.SHOP.CREATED,
      data: { shop },
      statusCode: HTTP_STATUS.CREATED,
    })
  } catch (error) {
    next(error)
  }
}

export const getShops = async (req, res, next) => {
  try {
    const pagination = getPaginationParams(req.query)
    const { shops, meta } = await shopService.getShops(req.query, pagination)
    sendSuccess(res, { message: MESSAGES.SHOP.FETCHED, data: { shops }, meta })
  } catch (error) {
    next(error)
  }
}

export const getShopById = async (req, res, next) => {
  try {
    const shop = await shopService.getShopById(req.params.id)
    sendSuccess(res, { message: MESSAGES.SHOP.DETAIL_FETCHED, data: { shop } })
  } catch (error) {
    next(error)
  }
}

export const updateShop = async (req, res, next) => {
  try {
    const shop = await shopService.updateShop(req.params.id, req.user, req.body)
    sendSuccess(res, { message: MESSAGES.SHOP.UPDATED, data: { shop } })
  } catch (error) {
    next(error)
  }
}

export const transferOwner = async (req, res, next) => {
  try {
    const shop = await shopService.transferOwner(req.params.id, req.user, req.body.newOwnerId)
    sendSuccess(res, { message: MESSAGES.SHOP.OWNER_UPDATED, data: { shop } })
  } catch (error) {
    next(error)
  }
}

export const addStaff = async (req, res, next) => {
  try {
    const shop = await shopService.addStaff(req.params.id, req.user, req.body.staffUserId)
    sendSuccess(res, { message: MESSAGES.SHOP.STAFF_ADDED, data: { shop } })
  } catch (error) {
    next(error)
  }
}

export const removeStaff = async (req, res, next) => {
  try {
    const shop = await shopService.removeStaff(req.params.id, req.user, req.params.staffUserId)
    sendSuccess(res, { message: MESSAGES.SHOP.STAFF_REMOVED, data: { shop } })
  } catch (error) {
    next(error)
  }
}

export const getStaffPermissions = async (req, res, next) => {
  try {
    const result = await shopService.getStaffPermissions(req.params.id, req.user, req.params.staffUserId)
    sendSuccess(res, { message: MESSAGES.SHOP.STAFF_PERMISSIONS_FETCHED, data: result })
  } catch (error) {
    next(error)
  }
}

export const updateStaffPermissions = async (req, res, next) => {
  try {
    const result = await shopService.updateStaffPermissions(
      req.params.id,
      req.user,
      req.params.staffUserId,
      req.body.permissions
    )
    sendSuccess(res, { message: MESSAGES.SHOP.STAFF_PERMISSIONS_UPDATED, data: result })
  } catch (error) {
    next(error)
  }
}

export const getMyShops = async (req, res, next) => {
  try {
    const pagination = getPaginationParams(req.query)
    const { shops, meta } = await shopService.getMyShops(req.user._id, req.query, pagination)
    sendSuccess(res, { message: MESSAGES.SHOP.MY_SHOPS_FETCHED, data: { shops }, meta })
  } catch (error) {
    next(error)
  }
}

export const getAdminShops = async (req, res, next) => {
  try {
    const pagination = getPaginationParams(req.query)
    const { shops, meta } = await shopService.getAdminShops(req.query, pagination)
    sendSuccess(res, { message: MESSAGES.SHOP.ADMIN_SHOPS_FETCHED, data: { shops }, meta })
  } catch (error) {
    next(error)
  }
}

export const approveShop = async (req, res, next) => {
  try {
    const shop = await shopService.approveShop(req.params.id)
    sendSuccess(res, { message: MESSAGES.SHOP.APPROVED, data: { shop } })
  } catch (error) {
    next(error)
  }
}

export const rejectShop = async (req, res, next) => {
  try {
    const shop = await shopService.rejectShop(req.params.id, req.body.rejectionReason)
    sendSuccess(res, { message: MESSAGES.SHOP.REJECTED, data: { shop } })
  } catch (error) {
    next(error)
  }
}

export const suspendShop = async (req, res, next) => {
  try {
    const shop = await shopService.suspendShop(req.params.id, req.body.reason)
    sendSuccess(res, { message: MESSAGES.SHOP.SUSPENDED, data: { shop } })
  } catch (error) {
    next(error)
  }
}

export const resubmitForReview = async (req, res, next) => {
  try {
    const shop = await shopService.resubmitShop(req.params.id, req.user)
    sendSuccess(res, { message: MESSAGES.SHOP.RESUBMITTED, data: { shop } })
  } catch (error) {
    next(error)
  }
}

export const unsuspendShop = async (req, res, next) => {
  try {
    const shop = await shopService.unsuspendShop(req.params.id)
    sendSuccess(res, { message: MESSAGES.SHOP.UNSUSPENDED, data: { shop } })
  } catch (error) {
    next(error)
  }
}

export const submitForReview = async (req, res, next) => {
  try {
    const shop = await shopService.submitForReview(req.params.id, req.user)
    sendSuccess(res, { message: MESSAGES.SHOP.SUBMITTED_FOR_REVIEW, data: { shop } })
  } catch (error) {
    next(error)
  }
}

import * as shopService from '../../services/shop/shop.service.js'
import { sendSuccess } from '../../utils/response.util.js'
import { getPaginationParams } from '../../utils/pagination.util.js'
import { asyncHandler } from '../../utils/async-handler.util.js'
import MESSAGES from '../../constants/message.constant.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'

export const createShop = asyncHandler(async (req, res) => {
  const shop = await shopService.createShop(req.user._id, req.body)
  sendSuccess(res, {
    message: MESSAGES.SHOP.CREATED,
    data: { shop },
    statusCode: HTTP_STATUS.CREATED,
  })
})

export const getShops = asyncHandler(async (req, res) => {
  const pagination = getPaginationParams(req.query)
  const { shops, meta } = await shopService.getShops(req.query, pagination)
  sendSuccess(res, { message: MESSAGES.SHOP.FETCHED, data: { shops }, meta })
})

export const getShopById = asyncHandler(async (req, res) => {
  const shop = await shopService.getShopById(req.params.id)
  sendSuccess(res, { message: MESSAGES.SHOP.DETAIL_FETCHED, data: { shop } })
})

export const updateShop = asyncHandler(async (req, res) => {
  const shop = await shopService.updateShop(req.params.id, req.user, req.body)
  sendSuccess(res, { message: MESSAGES.SHOP.UPDATED, data: { shop } })
})

export const transferOwner = asyncHandler(async (req, res) => {
  const shop = await shopService.transferOwner(req.params.id, req.user, req.body.newOwnerId)
  sendSuccess(res, { message: MESSAGES.SHOP.OWNER_UPDATED, data: { shop } })
})

export const addStaff = asyncHandler(async (req, res) => {
  const shop = await shopService.addStaff(req.params.id, req.user, req.body.staffUserId)
  sendSuccess(res, { message: MESSAGES.SHOP.STAFF_ADDED, data: { shop } })
})

export const removeStaff = asyncHandler(async (req, res) => {
  const shop = await shopService.removeStaff(req.params.id, req.user, req.params.staffUserId)
  sendSuccess(res, { message: MESSAGES.SHOP.STAFF_REMOVED, data: { shop } })
})

export const getStaffPermissions = asyncHandler(async (req, res) => {
  const result = await shopService.getStaffPermissions(req.params.id, req.user, req.params.staffUserId)
  sendSuccess(res, { message: MESSAGES.SHOP.STAFF_PERMISSIONS_FETCHED, data: result })
})

export const updateStaffPermissions = asyncHandler(async (req, res) => {
  const result = await shopService.updateStaffPermissions(
    req.params.id,
    req.user,
    req.params.staffUserId,
    req.body.permissions
  )
  sendSuccess(res, { message: MESSAGES.SHOP.STAFF_PERMISSIONS_UPDATED, data: result })
})

export const getMyShops = asyncHandler(async (req, res) => {
  const pagination = getPaginationParams(req.query)
  const { shops, meta } = await shopService.getMyShops(req.user._id, req.query, pagination)
  sendSuccess(res, { message: MESSAGES.SHOP.MY_SHOPS_FETCHED, data: { shops }, meta })
})

export const getAdminShops = asyncHandler(async (req, res) => {
  const pagination = getPaginationParams(req.query)
  const { shops, meta } = await shopService.getAdminShops(req.query, pagination)
  sendSuccess(res, { message: MESSAGES.SHOP.ADMIN_SHOPS_FETCHED, data: { shops }, meta })
})

export const approveShop = asyncHandler(async (req, res) => {
  const shop = await shopService.approveShop(req.params.id)
  sendSuccess(res, { message: MESSAGES.SHOP.APPROVED, data: { shop } })
})

export const rejectShop = asyncHandler(async (req, res) => {
  const shop = await shopService.rejectShop(req.params.id, req.body.rejectionReason)
  sendSuccess(res, { message: MESSAGES.SHOP.REJECTED, data: { shop } })
})

export const suspendShop = asyncHandler(async (req, res) => {
  const shop = await shopService.suspendShop(req.params.id, req.body.reason)
  sendSuccess(res, { message: MESSAGES.SHOP.SUSPENDED, data: { shop } })
})

export const resubmitForReview = asyncHandler(async (req, res) => {
  const shop = await shopService.resubmitShop(req.params.id, req.user)
  sendSuccess(res, { message: MESSAGES.SHOP.RESUBMITTED, data: { shop } })
})

export const unsuspendShop = asyncHandler(async (req, res) => {
  const shop = await shopService.unsuspendShop(req.params.id)
  sendSuccess(res, { message: MESSAGES.SHOP.UNSUSPENDED, data: { shop } })
})

export const submitForReview = asyncHandler(async (req, res) => {
  const shop = await shopService.submitForReview(req.params.id, req.user)
  sendSuccess(res, { message: MESSAGES.SHOP.SUBMITTED_FOR_REVIEW, data: { shop } })
})

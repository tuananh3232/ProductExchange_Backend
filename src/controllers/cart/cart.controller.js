import * as cartService from '../../services/cart/cart.service.js'
import { asyncHandler } from '../../utils/async-handler.util.js'
import { sendSuccess } from '../../utils/response.util.js'
import MESSAGES from '../../constants/message.constant.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'

export const addCombo = asyncHandler(async (req, res) => {
  const result = await cartService.addCombo(req.user._id, req.body.items)
  if (result.errors) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      message: MESSAGES.CART.SOME_PRODUCTS_UNAVAILABLE,
      errors: result.errors,
    })
  }
  return sendSuccess(res, { message: MESSAGES.CART.COMBO_ADDED, data: { cart: result.cart } })
})

export const getCart = asyncHandler(async (req, res) => {
  const cart = await cartService.getCart(req.user._id)
  return sendSuccess(res, { message: MESSAGES.CART.FETCHED, data: { cart } })
})

export const updateCartItem = asyncHandler(async (req, res) => {
  const cart = await cartService.updateCartItem(req.user._id, req.params.productId, req.body.quantity)
  return sendSuccess(res, { message: MESSAGES.CART.ITEM_UPDATED, data: { cart } })
})

export const removeCartItem = asyncHandler(async (req, res) => {
  const cart = await cartService.removeCartItem(req.user._id, req.params.productId)
  return sendSuccess(res, { message: MESSAGES.CART.ITEM_REMOVED, data: { cart } })
})

export const clearCart = asyncHandler(async (req, res) => {
  const cart = await cartService.clearCart(req.user._id)
  return sendSuccess(res, { message: MESSAGES.CART.CLEARED, data: { cart } })
})

export const checkoutCart = asyncHandler(async (req, res) => {
  const checkout = await cartService.checkoutCart(req.user._id, req.body, req.user, req)
  return sendSuccess(res, {
    message: MESSAGES.CART.CHECKOUT_CREATED,
    data: checkout,
    statusCode: HTTP_STATUS.CREATED,
  })
})

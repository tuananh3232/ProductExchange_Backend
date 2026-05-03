import * as productService from '../../services/product/product.service.js'
import { sendSuccess } from '../../utils/response.util.js'
import { getPaginationParams } from '../../utils/pagination.util.js'
import MESSAGES from '../../constants/message.constant.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'

export const getProducts = async (req, res, next) => {
  try {
    const pagination = getPaginationParams(req.query)
    const { products, meta } = await productService.getProducts(req.query, pagination)
    sendSuccess(res, { message: MESSAGES.PRODUCT.FETCHED, data: { products }, meta })
  } catch (error) {
    next(error)
  }
}

export const getProductById = async (req, res, next) => {
  try {
    const product = await productService.getProductById(req.params.id)
    sendSuccess(res, { message: MESSAGES.PRODUCT.DETAIL_FETCHED, data: { product } })
  } catch (error) {
    next(error)
  }
}

export const createProduct = async (req, res, next) => {
  try {
    const product = await productService.createProduct(req.user, req.body)
    sendSuccess(res, {
      message: MESSAGES.PRODUCT.CREATED,
      data: { product },
      statusCode: HTTP_STATUS.CREATED,
    })
  } catch (error) {
    next(error)
  }
}

export const updateProduct = async (req, res, next) => {
  try {
    const product = await productService.updateProduct(req.params.id, req.user, req.body)
    sendSuccess(res, { message: MESSAGES.PRODUCT.UPDATED, data: { product } })
  } catch (error) {
    next(error)
  }
}

export const deleteProduct = async (req, res, next) => {
  try {
    await productService.deleteProduct(req.params.id, req.user)
    sendSuccess(res, { message: MESSAGES.PRODUCT.DELETED })
  } catch (error) {
    next(error)
  }
}

export const updateProductStatus = async (req, res, next) => {
  try {
    const product = await productService.updateProductStatus(req.params.id, req.user, req.body.status)
    sendSuccess(res, { message: MESSAGES.PRODUCT.STATUS_UPDATED, data: { product } })
  } catch (error) {
    next(error)
  }
}

export const addProductImages = async (req, res, next) => {
  try {
    const product = await productService.addProductImages(req.params.id, req.user, req.body.images)
    sendSuccess(res, { message: MESSAGES.PRODUCT.IMAGES_ADDED, data: { product } })
  } catch (error) {
    next(error)
  }
}

export const removeProductImage = async (req, res, next) => {
  try {
    const product = await productService.removeProductImage(req.params.id, req.user, req.params.publicId)
    sendSuccess(res, { message: MESSAGES.PRODUCT.IMAGE_REMOVED, data: { product } })
  } catch (error) {
    next(error)
  }
}

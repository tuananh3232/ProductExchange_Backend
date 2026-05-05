import * as categoryService from '../../services/category/category.service.js'
import { sendSuccess } from '../../utils/response.util.js'
import { getPaginationParams } from '../../utils/pagination.util.js'
import MESSAGES from '../../constants/message.constant.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'

export const createCategory = async (req, res, next) => {
  try {
    const category = await categoryService.createCategory(req.body)
    sendSuccess(res, {
      message: MESSAGES.CATEGORY.CREATED,
      data: { category },
      statusCode: HTTP_STATUS.CREATED,
    })
  } catch (error) {
    next(error)
  }
}

export const getCategories = async (req, res, next) => {
  try {
    const pagination = getPaginationParams(req.query)
    const { categories, meta } = await categoryService.getCategories(req.query, pagination)
    sendSuccess(res, { message: MESSAGES.CATEGORY.FETCHED, data: { categories }, meta })
  } catch (error) {
    next(error)
  }
}

export const getCategoryById = async (req, res, next) => {
  try {
    const category = await categoryService.getCategoryById(req.params.id)
    sendSuccess(res, { message: MESSAGES.CATEGORY.DETAIL_FETCHED, data: { category } })
  } catch (error) {
    next(error)
  }
}

export const updateCategory = async (req, res, next) => {
  try {
    const category = await categoryService.updateCategory(req.params.id, req.body)
    sendSuccess(res, { message: MESSAGES.CATEGORY.UPDATED, data: { category } })
  } catch (error) {
    next(error)
  }
}

export const deleteCategory = async (req, res, next) => {
  try {
    await categoryService.deleteCategory(req.params.id)
    sendSuccess(res, { message: MESSAGES.CATEGORY.DELETED })
  } catch (error) {
    next(error)
  }
}

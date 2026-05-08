import * as categoryService from '../../services/category/category.service.js'
import { sendSuccess } from '../../utils/response.util.js'
import { getPaginationParams } from '../../utils/pagination.util.js'
import { asyncHandler } from '../../utils/async-handler.util.js'
import MESSAGES from '../../constants/message.constant.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'

export const createCategory = asyncHandler(async (req, res) => {
  const category = await categoryService.createCategory(req.body)
  sendSuccess(res, {
    message: MESSAGES.CATEGORY.CREATED,
    data: { category },
    statusCode: HTTP_STATUS.CREATED,
  })
})

export const getCategories = asyncHandler(async (req, res) => {
  const pagination = getPaginationParams(req.query)
  const { categories, meta } = await categoryService.getCategories(req.query, pagination)
  sendSuccess(res, { message: MESSAGES.CATEGORY.FETCHED, data: { categories }, meta })
})

export const getCategoryById = asyncHandler(async (req, res) => {
  const category = await categoryService.getCategoryById(req.params.id)
  sendSuccess(res, { message: MESSAGES.CATEGORY.DETAIL_FETCHED, data: { category } })
})

export const updateCategory = asyncHandler(async (req, res) => {
  const category = await categoryService.updateCategory(req.params.id, req.body)
  sendSuccess(res, { message: MESSAGES.CATEGORY.UPDATED, data: { category } })
})

export const deleteCategory = asyncHandler(async (req, res) => {
  await categoryService.deleteCategory(req.params.id)
  sendSuccess(res, { message: MESSAGES.CATEGORY.DELETED })
})

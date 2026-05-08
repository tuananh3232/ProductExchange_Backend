import * as categoryRepo from '../../repositories/category/category.repository.js'
import AppError from '../../utils/app-error.util.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'
import ERRORS from '../../constants/error.constant.js'
import { paginate } from '../../utils/pagination.util.js'
import { normalizeSlug } from '../../utils/slug.util.js'

export const createCategory = async (payload) => {
  const slug = normalizeSlug(payload.slug || payload.name)
  if (!slug) throw new AppError('Tên category không hợp lệ', HTTP_STATUS.BAD_REQUEST, ERRORS.VALIDATION.INVALID_FORMAT)

  const existed = await categoryRepo.findBySlug(slug)
  if (existed) throw new AppError('Category đã tồn tại', HTTP_STATUS.CONFLICT, ERRORS.VALIDATION.DUPLICATE)

  const category = await categoryRepo.create({ ...payload, slug })
  return category
}

export const getCategories = async (query, pagination) => {
  const filter = { isActive: true }
  if (query.search) filter.$text = { $search: query.search }

  const { items: categories, meta } = await paginate(categoryRepo, filter, pagination)
  return { categories, meta }
}

export const getCategoryById = async (id) => {
  const category = await categoryRepo.findById(id)
  if (!category || !category.isActive) {
    throw new AppError('Không tìm thấy category', HTTP_STATUS.NOT_FOUND, ERRORS.GENERAL.NOT_FOUND)
  }
  return category
}

export const updateCategory = async (id, payload) => {
  const category = await categoryRepo.findById(id)
  if (!category || !category.isActive) {
    throw new AppError('Không tìm thấy category', HTTP_STATUS.NOT_FOUND, ERRORS.GENERAL.NOT_FOUND)
  }

  const updateData = { ...payload }
  if (payload.name || payload.slug) {
    const slug = normalizeSlug(payload.slug || payload.name)
    const existed = await categoryRepo.findBySlug(slug)
    if (existed && existed._id.toString() !== id.toString()) {
      throw new AppError('Category đã tồn tại', HTTP_STATUS.CONFLICT, ERRORS.VALIDATION.DUPLICATE)
    }
    updateData.slug = slug
  }

  return categoryRepo.updateById(id, updateData)
}

export const deleteCategory = async (id) => {
  const category = await categoryRepo.findById(id)
  if (!category) return null
  return categoryRepo.deleteById(id)
}

import * as categoryRepo from '../../repositories/category/category.repository.js'
import AppError from '../../utils/app-error.util.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'
import ERRORS from '../../constants/error.constant.js'
import { paginate } from '../../utils/pagination.util.js'
import { normalizeSlug } from '../../utils/slug.util.js'
import { writeAuditLog } from '../audit/audit-log.service.js'

export const createCategory = async (payload) => {
  const slug = normalizeSlug(payload.slug || payload.name)
  if (!slug) throw new AppError('Tên danh mục không hợp lệ', HTTP_STATUS.BAD_REQUEST, ERRORS.VALIDATION.INVALID_FORMAT)

  const existed = await categoryRepo.findBySlug(slug)
  if (existed) throw new AppError('Danh mục đã tồn tại', HTTP_STATUS.CONFLICT, ERRORS.VALIDATION.DUPLICATE)

  const category = await categoryRepo.create({ ...payload, slug })
  return category
}

export const getCategories = async (query, pagination) => {
  const filter = { isActive: true }
  if (query.search) filter.$text = { $search: query.search }

  const { items: categories, meta } = await paginate(categoryRepo, filter, pagination)
  return { categories, meta }
}

export const getAdminCategories = async (query, pagination) => {
  const filter = {}
  if (query.search) filter.$text = { $search: query.search }
  if (query.isActive !== undefined) filter.isActive = query.isActive === true || query.isActive === 'true'
  if (query.status) {
    filter.isActive = query.status === 'active'
  }
  if (query.createdFrom || query.createdTo) {
    filter.createdAt = {}
    if (query.createdFrom) filter.createdAt.$gte = new Date(query.createdFrom)
    if (query.createdTo) filter.createdAt.$lte = new Date(query.createdTo)
  }

  const { items: categories, meta } = await paginate(categoryRepo, filter, pagination)
  return { categories, meta }
}

export const getCategoryById = async (id) => {
  const category = await categoryRepo.findById(id)
  if (!category || !category.isActive) {
    throw new AppError('Không tìm thấy danh mục', HTTP_STATUS.NOT_FOUND, ERRORS.GENERAL.NOT_FOUND)
  }
  return category
}

export const getAdminCategoryById = async (id) => {
  const category = await categoryRepo.findById(id)
  if (!category) {
    throw new AppError('KhÃ´ng tÃ¬m tháº¥y danh má»¥c', HTTP_STATUS.NOT_FOUND, ERRORS.GENERAL.NOT_FOUND)
  }
  return category
}

export const updateCategory = async (id, payload) => {
  const category = await categoryRepo.findById(id)
  if (!category || !category.isActive) {
    throw new AppError('Không tìm thấy danh mục', HTTP_STATUS.NOT_FOUND, ERRORS.GENERAL.NOT_FOUND)
  }

  const updateData = { ...payload }
  if (payload.name || payload.slug) {
    const slug = normalizeSlug(payload.slug || payload.name)
    const existed = await categoryRepo.findBySlug(slug)
    if (existed && existed._id.toString() !== id.toString()) {
      throw new AppError('Danh mục đã tồn tại', HTTP_STATUS.CONFLICT, ERRORS.VALIDATION.DUPLICATE)
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

export const updateAdminCategoryStatus = async (id, { isActive, reason = '', adminNote = '' }, actor) => {
  const category = await categoryRepo.findById(id)
  if (!category) {
    throw new AppError('KhÃ´ng tÃ¬m tháº¥y danh má»¥c', HTTP_STATUS.NOT_FOUND, ERRORS.GENERAL.NOT_FOUND)
  }

  const updated = await categoryRepo.updateById(id, {
    isActive,
    deletedAt: isActive ? null : new Date(),
  })

  await writeAuditLog({
    adminId: actor?._id,
    action: 'CATEGORY_STATUS_CHANGED',
    targetType: 'category',
    targetId: category._id,
    previousStatus: category.isActive ? 'active' : 'inactive',
    newStatus: isActive ? 'active' : 'inactive',
    reason,
    adminNote,
  })

  return updated
}

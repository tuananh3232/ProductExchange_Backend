import mongoose from 'mongoose'
import Shop from '../../models/shop.model.js'
import Product from '../../models/product.model.js'
import User from '../../models/user.model.js'
import AppError from '../../utils/app-error.util.js'
import ERRORS from '../../constants/error.constant.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'
import { listAuditLogs, AUDIT_TARGET_TYPE_TO_MODULE } from '../audit/audit-log.service.js'

// Reverse of AUDIT_TARGET_TYPE_TO_MODULE: a UI module maps back to every raw targetType it groups.
const MODULE_TO_TARGET_TYPES = Object.entries(AUDIT_TARGET_TYPE_TO_MODULE).reduce((acc, [targetType, module]) => {
  acc[module] = acc[module] || []
  acc[module].push(targetType)
  return acc
}, {})

const toObjectId = (value) => new mongoose.Types.ObjectId(value.toString())

const parseDate = (value, label) => {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(`${label} không hợp lệ`, HTTP_STATUS.BAD_REQUEST, ERRORS.VALIDATION.INVALID_FORMAT)
  }
  return parsed
}

const buildDateRange = ({ fromDate, toDate, field = 'createdAt' } = {}) => {
  if (!fromDate && !toDate) return {}

  const range = {}
  const start = fromDate ? parseDate(fromDate, 'fromDate') : null
  const end = toDate ? parseDate(toDate, 'toDate') : null

  if (start) range.$gte = start
  if (end) {
    end.setHours(23, 59, 59, 999)
    range.$lte = end
  }

  if (start && end && start > end) {
    throw new AppError('fromDate không được lớn hơn toDate', HTTP_STATUS.BAD_REQUEST, ERRORS.VALIDATION.INVALID_FORMAT)
  }

  return { [field]: range }
}

const buildAuditFilter = (query = {}) => {
  const filter = {
    ...buildDateRange({ fromDate: query.fromDate, toDate: query.toDate }),
  }

  if (query.action) filter.action = query.action
  if (query.targetType) filter.targetType = query.targetType
  else if (query.module && MODULE_TO_TARGET_TYPES[query.module]) {
    filter.targetType = { $in: MODULE_TO_TARGET_TYPES[query.module] }
  }
  if (query.targetId) filter.targetId = toObjectId(query.targetId)
  if (query.adminId) filter.adminId = toObjectId(query.adminId)

  return filter
}

const toPagination = (query = {}) => ({
  page: Math.max(1, parseInt(query.page, 10) || 1),
  limit: Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10)),
  sortOrder: query.sortOrder === 'asc' ? 1 : -1,
})

export const getAuditLogs = (query = {}) => listAuditLogs(buildAuditFilter(query), toPagination(query))

export const getUserActivity = async (userId, query = {}) => {
  const user = await User.exists({ _id: userId })
  if (!user) {
    throw new AppError('Người dùng không tồn tại', HTTP_STATUS.NOT_FOUND, ERRORS.GENERAL.NOT_FOUND)
  }

  const filter = {
    ...buildAuditFilter(query),
    $or: [
      { targetId: toObjectId(userId) },
      { 'metadata.userId': userId.toString() },
      { 'metadata.user': userId.toString() },
    ],
  }

  return listAuditLogs(filter, toPagination(query))
}

export const getTargetHistory = async ({ targetType, targetId, query = {} }) => {
  const modelByTarget = {
    shop: Shop,
    product: Product,
    user: User,
  }
  const Model = modelByTarget[targetType]
  const exists = Model ? await Model.exists({ _id: targetId }) : true
  if (!exists) {
    throw new AppError('Không tìm thấy tài nguyên', HTTP_STATUS.NOT_FOUND, ERRORS.GENERAL.NOT_FOUND)
  }

  const filter = {
    ...buildAuditFilter(query),
    targetType,
    targetId: toObjectId(targetId),
  }

  return listAuditLogs(filter, toPagination(query))
}

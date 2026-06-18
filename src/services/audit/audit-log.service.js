import AuditLog from '../../models/audit-log.model.js'
import { buildPaginationMeta } from '../../utils/pagination.util.js'

export const writeAuditLog = async ({
  adminId,
  action,
  targetType,
  targetId,
  previousStatus = '',
  newStatus = '',
  reason = '',
  adminNote = '',
  metadata = {},
}) => {
  if (!adminId || !action || !targetType || !targetId) return null

  try {
    return await AuditLog.create({
      adminId,
      action,
      targetType,
      targetId,
      previousStatus: previousStatus || '',
      newStatus: newStatus || '',
      reason: reason || '',
      adminNote: adminNote || '',
      metadata,
    })
  } catch (error) {
    console.warn('[audit] failed to write admin audit log', error?.message || error)
    return null
  }
}

const sanitizeMetadata = (metadata = {}) => {
  const blockedKeys = new Set([
    'password',
    'refreshToken',
    'accessToken',
    'token',
    'otp',
    'emailVerificationToken',
    'resetPasswordToken',
    'signature',
    'secret',
    'webhookSecret',
    'accountNumber',
    'rawCallbackData',
  ])

  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return metadata || {}
  }

  return Object.entries(metadata).reduce((acc, [key, value]) => {
    if (blockedKeys.has(key)) return acc
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      acc[key] = sanitizeMetadata(value)
    } else {
      acc[key] = value
    }
    return acc
  }, {})
}

export const serializeAuditLog = (log) => {
  const value = typeof log?.toObject === 'function' ? log.toObject() : { ...(log || {}) }
  return {
    _id: value._id?.toString?.() || value._id,
    adminId: value.adminId?._id
      ? {
          _id: value.adminId._id.toString(),
          name: value.adminId.name,
          email: value.adminId.email,
        }
      : value.adminId?.toString?.() || value.adminId,
    action: value.action,
    targetType: value.targetType,
    targetId: value.targetId?.toString?.() || value.targetId,
    previousStatus: value.previousStatus || '',
    newStatus: value.newStatus || '',
    reason: value.reason || '',
    adminNote: value.adminNote || '',
    metadata: sanitizeMetadata(value.metadata || {}),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  }
}

export const listAuditLogs = async (filter = {}, { page = 1, limit = 10, sortOrder = -1 } = {}) => {
  const skip = (page - 1) * limit
  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .populate('adminId', 'name email')
      .sort({ createdAt: sortOrder })
      .skip(skip)
      .limit(limit),
    AuditLog.countDocuments(filter),
  ])

  return {
    auditLogs: logs.map(serializeAuditLog),
    meta: buildPaginationMeta(total, page, limit),
  }
}

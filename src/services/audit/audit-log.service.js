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

// Groups raw audit `targetType` values into the coarse modules the admin UI filters by.
export const AUDIT_TARGET_TYPE_TO_MODULE = {
  user: 'users',
  role: 'users',
  product: 'products',
  category: 'products',
  shop: 'shops',
  order: 'orders',
  exchange: 'orders',
  payment: 'payments',
  withdrawal: 'payments',
  notification: 'notifications',
}

const buildAuditDescription = (value) => {
  if (value.reason) return value.reason
  if (value.previousStatus || value.newStatus) {
    return `${value.previousStatus || '—'} → ${value.newStatus || '—'}`
  }
  return value.adminNote || ''
}

export const serializeAuditLog = (log) => {
  const value = typeof log?.toObject === 'function' ? log.toObject() : { ...(log || {}) }
  const actor = value.adminId?._id
    ? {
        _id: value.adminId._id.toString(),
        name: value.adminId.name,
        email: value.adminId.email,
        role: Array.isArray(value.adminId.roles) ? value.adminId.roles[0] : undefined,
      }
    : null
  return {
    _id: value._id?.toString?.() || value._id,
    action: value.action,
    module: AUDIT_TARGET_TYPE_TO_MODULE[value.targetType] || value.targetType || 'general',
    entityType: value.targetType,
    entityId: value.targetId?.toString?.() || value.targetId,
    description: buildAuditDescription(value),
    actor,
    metadata: sanitizeMetadata(value.metadata || {}),
    createdAt: value.createdAt,
    // Raw fields retained for backward compatibility / detail views.
    previousStatus: value.previousStatus || '',
    newStatus: value.newStatus || '',
    reason: value.reason || '',
    adminNote: value.adminNote || '',
    updatedAt: value.updatedAt,
  }
}

export const listAuditLogs = async (filter = {}, { page = 1, limit = 10, sortOrder = -1 } = {}) => {
  const skip = (page - 1) * limit
  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .populate('adminId', 'name email roles')
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

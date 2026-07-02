import * as shopRepo from '../../repositories/shop/shop.repository.js'
import * as permissionRepo from '../../repositories/permission/permission.repository.js'
import User from '../../models/user.model.js'
import Shop from '../../models/shop.model.js'
import AppError from '../../utils/app-error.util.js'
import ERRORS from '../../constants/error.constant.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'
import { paginate } from '../../utils/pagination.util.js'
import { normalizeSlug } from '../../utils/slug.util.js'
import { ROLES } from '../../constants/role.constant.js'
import { SHOP_STATUS } from '../../constants/status.constant.js'
import PERMISSIONS, { SHOP_STAFF_PERMISSIONS } from '../../constants/permission.constant.js'
import { assertShopPermission } from '../../utils/data-scope.util.js'
import { notifySafely } from '../notification/notification.service.js'
import { NOTIFICATION_TARGET_TYPES, NOTIFICATION_TYPES } from '../../constants/notification.constant.js'
import { writeAuditLog } from '../audit/audit-log.service.js'

const toIdString = (value) => (value && value._id ? value._id.toString() : value ? value.toString() : null)
const DELETABLE_SHOP_STATUSES = [SHOP_STATUS.REJECTED]
const EMAIL_PATTERN = /^\S+@\S+\.\S+$/
const SHOP_LIMITS = {
  default: 1,
  vip: 3
}
const SHOP_SUSPENSION_REASONS = {
  ADMIN: 'admin',
  VIP_EXPIRED: 'vip_expired'
}

const normalizeEmail = (email) => (typeof email === 'string' ? email.trim().toLowerCase() : '')

const notifyShopUser = (recipient, type, shop, message, sender = null, data = {}) =>
  notifySafely({
    recipient,
    sender,
    type,
    title: 'Cập nhật cửa hàng',
    message,
    targetType: NOTIFICATION_TARGET_TYPES.SHOP,
    targetId: shop._id,
    actionUrl: `/shops/${shop._id}`,
    data: { shopId: shop._id, ...data }
  })

const toBasicUserResponse = (user) => ({
  _id: toIdString(user),
  name: user.name,
  email: user.email,
  avatar: user.avatar || { url: '', publicId: '' }
})

// eslint-disable-next-line no-unused-vars
const ensureShopAccess = (shop, userContext) => {
  const roleSet = new Set(userContext?.roles || [])
  if (roleSet.has(ROLES.ADMIN)) return

  const userId = userContext?._id?.toString()
  if (!userId) {
    throw new AppError('Bạn không có quyền truy cập shop này', HTTP_STATUS.FORBIDDEN, ERRORS.AUTH.FORBIDDEN)
  }

  const isOwner = shop.owner?._id?.toString() === userId || shop.owner?.toString() === userId
  const isStaff = (shop.staff || []).some(
    (staffId) => staffId?._id?.toString() === userId || staffId?.toString() === userId
  )

  if (!isOwner && !isStaff) {
    throw new AppError('Bạn không có quyền truy cập shop này', HTTP_STATUS.FORBIDDEN, ERRORS.AUTH.FORBIDDEN)
  }
}

const ensureShopOwnerAccess = (shop, userContext) => {
  const roleSet = new Set(userContext?.roles || [])
  if (roleSet.has(ROLES.ADMIN)) return

  const userId = userContext?._id?.toString()
  const ownerId = shop.owner?._id?.toString() || shop.owner?.toString()

  if (!userId || ownerId !== userId) {
    throw new AppError(
      'Bạn không có quyền quản lý quyền staff của shop này',
      HTTP_STATUS.FORBIDDEN,
      ERRORS.AUTH.FORBIDDEN
    )
  }
}

const assertActiveUserByEmail = async (email) => {
  const normalizedEmail = normalizeEmail(email)

  if (!normalizedEmail) {
    throw new AppError('Email is required', HTTP_STATUS.BAD_REQUEST, ERRORS.VALIDATION.REQUIRED)
  }

  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    throw new AppError('Invalid email', HTTP_STATUS.BAD_REQUEST, ERRORS.VALIDATION.INVALID_FORMAT)
  }

  const user = await User.findOne({ email: normalizedEmail }).select('_id name email avatar roles isActive')
  if (!user) {
    throw new AppError('Người dùng không tồn tại', HTTP_STATUS.NOT_FOUND, ERRORS.GENERAL.NOT_FOUND)
  }

  if (!user.isActive) {
    throw new AppError('Account is inactive', HTTP_STATUS.BAD_REQUEST, ERRORS.AUTH.ACCOUNT_INACTIVE)
  }

  return user
}

const assertUserExists = async (userId) => {
  const user = await User.findById(userId)
  if (!user) {
    throw new AppError('Người dùng không tồn tại', HTTP_STATUS.NOT_FOUND, ERRORS.GENERAL.NOT_FOUND)
  }
  return user
}

const ensureStaffTargetRole = (user) => {
  const roleSet = new Set(user?.roles || [])

  if (!roleSet.has(ROLES.MEMBER)) {
    throw new AppError('Chỉ có thể thêm member làm staff', HTTP_STATUS.BAD_REQUEST, ERRORS.SHOP.INVALID_STAFF)
  }

  if (roleSet.has(ROLES.ADMIN)) {
    throw new AppError('Không thể thêm admin làm staff', HTTP_STATUS.BAD_REQUEST, ERRORS.SHOP.INVALID_STAFF)
  }
}

const hasActiveVip = (user) => Boolean(user?.vip?.expiresAt && new Date(user.vip.expiresAt) > new Date())

const getAllowedShopCount = (user) => (hasActiveVip(user) ? SHOP_LIMITS.vip : SHOP_LIMITS.default)

const buildQuotaExceededMessage = (user) => {
  const allowedCount = getAllowedShopCount(user)

  if (allowedCount <= SHOP_LIMITS.default) {
    return 'Mỗi tài khoản chỉ được tạo 1 shop. Nâng cấp VIP cá nhân để mở thêm tối đa 3 shop'
  }

  return `Tài khoản VIP chỉ được tạo tối đa ${SHOP_LIMITS.vip} shop`
}

const assertCanCreateShopDraft = (owner) => {
  const roleSet = new Set(owner?.roles || [])
  const hasSellerRole = roleSet.has(ROLES.SELLER)
  const hasApprovedKyc = owner?.kyc?.status === 'approved'

  if (!hasSellerRole && !hasApprovedKyc) {
    throw new AppError('Bạn cần được duyệt KYC trước khi tạo shop', HTTP_STATUS.FORBIDDEN, ERRORS.KYC.APPROVAL_REQUIRED)
  }
}

export const reconcileOwnerShopQuota = async (ownerId, { userDoc = null, notify = true } = {}) => {
  const owner = userDoc ?? (await User.findById(ownerId).select('_id vip'))
  if (!owner) {
    return { allowedCount: SHOP_LIMITS.default, totalShops: 0, changed: false }
  }

  const allowedCount = getAllowedShopCount(owner)
  const shops = await Shop.find({ owner: ownerId, isActive: true }).sort({ createdAt: 1 })
  let changed = false

  for (let index = 0; index < shops.length; index += 1) {
    const shop = shops[index]
    const shouldRemainAvailable = index < allowedCount
    const suspensionReason = shop.suspensionMeta?.reason ?? null

    if (shouldRemainAvailable) {
      if (shop.status === SHOP_STATUS.SUSPENDED && suspensionReason === SHOP_SUSPENSION_REASONS.VIP_EXPIRED) {
        const previousStatus = shop.suspensionMeta?.previousStatus || SHOP_STATUS.DRAFT
        const nextStatus = previousStatus === SHOP_STATUS.SUSPENDED ? SHOP_STATUS.DRAFT : previousStatus
        const updatedShop = await shopRepo.updateById(shop._id, {
          status: nextStatus,
          suspensionMeta: {
            reason: null,
            previousStatus: null,
            suspendedAt: null
          }
        })

        if (notify) {
          await notifyShopUser(
            shop.owner?._id || shop.owner,
            NOTIFICATION_TYPES.SHOP_UNBLOCKED,
            updatedShop,
            'Shop của bạn đã được mở lại sau khi gia hạn VIP',
            null,
            { reason: SHOP_SUSPENSION_REASONS.VIP_EXPIRED }
          )
        }

        changed = true
      }

      continue
    }

    if (shop.status === SHOP_STATUS.SUSPENDED) {
      continue
    }

    const updatedShop = await shopRepo.updateById(shop._id, {
      status: SHOP_STATUS.SUSPENDED,
      suspensionMeta: {
        reason: SHOP_SUSPENSION_REASONS.VIP_EXPIRED,
        previousStatus: shop.status,
        suspendedAt: new Date()
      }
    })

    if (notify) {
      await notifyShopUser(
        shop.owner?._id || shop.owner,
        NOTIFICATION_TYPES.SHOP_BLOCKED,
        updatedShop,
        'Shop của bạn tạm bị khóa vì vượt quá giới hạn shop của gói hiện tại',
        null,
        { reason: SHOP_SUSPENSION_REASONS.VIP_EXPIRED, previousStatus: shop.status }
      )
    }

    changed = true
  }

  return {
    allowedCount,
    totalShops: shops.length,
    changed
  }
}

export const createShop = async (ownerId, payload) => {
  const owner = await assertUserExists(ownerId)
  assertCanCreateShopDraft(owner)
  await reconcileOwnerShopQuota(ownerId, { userDoc: owner, notify: false })

  const totalOwnedShops = await Shop.countDocuments({ owner: ownerId, isActive: true })
  if (totalOwnedShops >= getAllowedShopCount(owner)) {
    throw new AppError(buildQuotaExceededMessage(owner), HTTP_STATUS.BAD_REQUEST, ERRORS.VALIDATION.INVALID_FORMAT)
  }

  const slug = normalizeSlug(payload.slug || payload.name)
  if (!slug) {
    throw new AppError('Tên shop không hợp lệ', HTTP_STATUS.BAD_REQUEST, ERRORS.VALIDATION.INVALID_FORMAT)
  }

  const existed = await shopRepo.findBySlug(slug)
  if (existed) {
    throw new AppError('Shop đã tồn tại', HTTP_STATUS.CONFLICT, ERRORS.SHOP.SLUG_ALREADY_EXISTS)
  }

  const shop = await shopRepo.create({
    ...payload,
    slug,
    owner: ownerId,
    staff: [],
    status: SHOP_STATUS.DRAFT
  })

  return shopRepo.findById(shop._id)
}

export const getShopById = async (shopId) => {
  const shop = await shopRepo.findById(shopId)
  if (!shop || !shop.isActive || shop.status !== SHOP_STATUS.ACTIVE) {
    throw new AppError('Không tìm thấy shop', HTTP_STATUS.NOT_FOUND, ERRORS.SHOP.NOT_FOUND)
  }
  return shop
}

export const getShopDashboard = async (shopId, userContext) => {
  const shop = await shopRepo.findById(shopId)
  if (!shop || !shop.isActive) {
    throw new AppError('Không tìm thấy shop', HTTP_STATUS.NOT_FOUND, ERRORS.SHOP.NOT_FOUND)
  }

  const userId = toIdString(userContext?._id)
  const roleSet = new Set(userContext?.roles || [])
  const ownerId = toIdString(shop.owner)
  const isStaff = (shop.staff || []).some((staffId) => toIdString(staffId) === userId)

  if (!roleSet.has(ROLES.ADMIN) && userId !== ownerId && !isStaff) {
    throw new AppError('Bạn không có quyền truy cập shop này', HTTP_STATUS.FORBIDDEN, ERRORS.AUTH.FORBIDDEN)
  }

  return shop
}

export const getShops = async (query, pagination) => {
  const filter = { isActive: true, status: SHOP_STATUS.ACTIVE }

  if (query.ownerId) filter.owner = query.ownerId
  if (query.search) filter.$text = { $search: query.search }

  const { items: shops, meta } = await paginate(shopRepo, filter, pagination)
  return { shops, meta }
}

export const submitForReview = async (shopId, userContext) => {
  const shop = await shopRepo.findById(shopId)
  if (!shop || !shop.isActive) {
    throw new AppError('Không tìm thấy shop', HTTP_STATUS.NOT_FOUND, ERRORS.SHOP.NOT_FOUND)
  }

  await assertShopPermission({
    user: userContext,
    shopId,
    permissionKey: PERMISSIONS.SHOP_PROFILE_SUBMIT_REVIEW,
    message: 'Bạn không có quyền nộp shop này',
    errorCode: ERRORS.AUTH.FORBIDDEN
  })

  const owner = await User.findById(userContext._id).select('kyc')
  if (!owner?.kyc || owner.kyc.status === 'none') {
    throw new AppError(
      'Vui lòng nộp hồ sơ xác minh danh tính (CCCD) trước khi nộp shop',
      HTTP_STATUS.BAD_REQUEST,
      ERRORS.KYC.NOT_SUBMITTED
    )
  }

  if (shop.status !== SHOP_STATUS.DRAFT) {
    throw new AppError(
      'Shop phải ở trạng thái draft mới có thể nộp xét duyệt',
      HTTP_STATUS.BAD_REQUEST,
      ERRORS.SHOP.NOT_DRAFT
    )
  }

  const isComplete =
    shop.phone?.trim() && shop.email?.trim() && shop.address?.province?.trim() && shop.address?.district?.trim()

  if (!isComplete) {
    throw new AppError(
      'Thông tin shop chưa đầy đủ. Vui lòng điền phone, email, tỉnh/thành và quận/huyện trước khi nộp',
      HTTP_STATUS.BAD_REQUEST,
      ERRORS.SHOP.INCOMPLETE_ONBOARDING
    )
  }

  return shopRepo.updateById(shopId, { status: SHOP_STATUS.PENDING_REVIEW })
}

export const updateShop = async (shopId, userContext, payload) => {
  const shop = await shopRepo.findById(shopId)
  if (!shop || !shop.isActive) {
    throw new AppError('Không tìm thấy shop', HTTP_STATUS.NOT_FOUND, ERRORS.SHOP.NOT_FOUND)
  }

  await assertShopPermission({
    user: userContext,
    shopId,
    permissionKey: PERMISSIONS.SHOP_PROFILE_UPDATE,
    message: 'Bạn không có quyền cập nhật shop này',
    errorCode: ERRORS.AUTH.FORBIDDEN
  })

  if (shop.status === SHOP_STATUS.PENDING_REVIEW) {
    throw new AppError(
      'Không thể sửa thông tin shop khi đang chờ xét duyệt',
      HTTP_STATUS.BAD_REQUEST,
      ERRORS.SHOP.LOCKED_FOR_REVIEW
    )
  }

  const updateData = { ...payload }

  if (Object.prototype.hasOwnProperty.call(payload, 'address') && payload.address) {
    updateData.address = {
      ...(shop.address || {}),
      ...payload.address
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'logo') && payload.logo) {
    updateData.logo = {
      ...(shop.logo || {}),
      ...payload.logo
    }
  }

  if (payload.slug || payload.name) {
    const slug = normalizeSlug(payload.slug || payload.name)
    const existed = await shopRepo.findBySlug(slug)
    if (existed && existed._id.toString() !== shopId.toString()) {
      throw new AppError('Shop đã tồn tại', HTTP_STATUS.CONFLICT, ERRORS.SHOP.SLUG_ALREADY_EXISTS)
    }
    updateData.slug = slug
  }

  return shopRepo.updateById(shopId, updateData)
}

export const deleteShop = async (shopId, userContext) => {
  const shop = await shopRepo.findById(shopId)
  if (!shop || !shop.isActive) {
    throw new AppError('Không tìm thấy shop', HTTP_STATUS.NOT_FOUND, ERRORS.SHOP.NOT_FOUND)
  }

  await assertShopPermission({
    user: userContext,
    shopId,
    permissionKey: PERMISSIONS.SHOP_STAFF_PERMISSION_READ,
    message: 'Bạn không có quyền xem quyền staff của shop này',
    errorCode: ERRORS.AUTH.FORBIDDEN
  })

  if (!DELETABLE_SHOP_STATUSES.includes(shop.status)) {
    throw new AppError(
      'Chỉ có thể xóa shop đang ở trạng thái bị từ chối',
      HTTP_STATUS.BAD_REQUEST,
      ERRORS.SHOP.NOT_REJECTED
    )
  }

  await shopRepo.updateById(shopId, {
    isActive: false,
    slug: `${shop.slug}-deleted-${shop._id.toString()}`
  })
}

export const transferOwner = async (shopId, userContext, newOwnerEmail) => {
  const shop = await shopRepo.findById(shopId)
  if (!shop || !shop.isActive) {
    throw new AppError('Không tìm thấy shop', HTTP_STATUS.NOT_FOUND, ERRORS.SHOP.NOT_FOUND)
  }

  await assertShopPermission({
    user: userContext,
    shopId,
    permissionKey: PERMISSIONS.SHOP_STAFF_PERMISSION_READ,
    message: 'Bạn không có quyền xem quyền staff của shop này',
    errorCode: ERRORS.AUTH.FORBIDDEN
  })
  const newOwner = await assertActiveUserByEmail(newOwnerEmail)
  const newOwnerId = newOwner._id
  const requesterId = toIdString(userContext?._id)
  const currentOwnerId = toIdString(shop.owner)

  if (requesterId && requesterId === toIdString(newOwnerId)) {
    throw new AppError(
      'Không thể chuyển quyền shop cho chính mình',
      HTTP_STATUS.BAD_REQUEST,
      ERRORS.VALIDATION.INVALID_FORMAT
    )
  }

  if (currentOwnerId === toIdString(newOwnerId)) {
    throw new AppError(
      'Người dùng này đang là owner của shop',
      HTTP_STATUS.BAD_REQUEST,
      ERRORS.VALIDATION.INVALID_FORMAT
    )
  }

  const updateData = {
    owner: newOwnerId,
    staff: (shop.staff || []).filter((staffId) => toIdString(staffId) !== toIdString(newOwnerId)),
    staffPermissions: (shop.staffPermissions || []).filter(
      (entry) => toIdString(entry.staffUser) !== toIdString(newOwnerId)
    )
  }

  const ownerRoles = new Set(newOwner.roles || [])
  ownerRoles.add(ROLES.SHOP_OWNER)
  newOwner.roles = [...ownerRoles]
  await newOwner.save()

  const updatedShop = await shopRepo.updateById(shopId, updateData)
  await notifyShopUser(
    newOwnerId,
    NOTIFICATION_TYPES.SHOP_OWNERSHIP_TRANSFERRED,
    updatedShop,
    'Bạn đã trở thành chủ sở hữu shop',
    userContext._id
  )
  await notifyShopUser(
    currentOwnerId,
    NOTIFICATION_TYPES.SHOP_OWNERSHIP_TRANSFERRED,
    updatedShop,
    'Quyền sở hữu shop đã được chuyển giao',
    userContext._id
  )
  await reconcileOwnerShopQuota(newOwnerId, { userDoc: newOwner })

  if (currentOwnerId && currentOwnerId !== toIdString(newOwnerId)) {
    await reconcileOwnerShopQuota(currentOwnerId)
    const oldOwnerStillOwnsShop = await shopRepo.countMany({
      _id: { $ne: shopId },
      owner: currentOwnerId,
      isActive: true
    })

    if (!oldOwnerStillOwnsShop) {
      const oldOwner = await User.findById(currentOwnerId).select('roles')
      if (oldOwner) {
        oldOwner.roles = (oldOwner.roles || []).filter((role) => role !== ROLES.SHOP_OWNER)
        await oldOwner.save()
      }
    }
  }

  return updatedShop
}

export const addStaff = async (shopId, userContext, staffUserId) => {
  const shop = await shopRepo.findById(shopId)
  if (!shop || !shop.isActive) {
    throw new AppError('Không tìm thấy shop', HTTP_STATUS.NOT_FOUND, ERRORS.SHOP.NOT_FOUND)
  }

  await assertShopPermission({
    user: userContext,
    shopId,
    permissionKey: PERMISSIONS.SHOP_STAFF_INVITE,
    message: 'Bạn không có quyền thêm staff cho shop này',
    errorCode: ERRORS.AUTH.FORBIDDEN
  })
  const staffUser = await assertUserExists(staffUserId)
  const staffId = staffUserId.toString()
  const requesterId = userContext?._id?.toString()

  if (requesterId && requesterId === staffId) {
    throw new AppError('Không thể tự thêm chính mình làm staff', HTTP_STATUS.BAD_REQUEST, ERRORS.SHOP.INVALID_STAFF)
  }

  ensureStaffTargetRole(staffUser)

  const isOwner = toIdString(shop.owner) === staffId
  if (isOwner) {
    throw new AppError('Không thể thêm owner vào staff', HTTP_STATUS.BAD_REQUEST, ERRORS.SHOP.INVALID_STAFF)
  }

  const isAlreadyStaff = (shop.staff || []).some((staffIdInShop) => toIdString(staffIdInShop) === staffId)
  if (isAlreadyStaff) {
    throw new AppError('Người dùng đã là nhân viên của shop', HTTP_STATUS.BAD_REQUEST, ERRORS.SHOP.ALREADY_STAFF)
  }

  const staffRoles = new Set(staffUser.roles || [])
  staffRoles.add(ROLES.STAFF)
  staffUser.roles = [...staffRoles]
  await staffUser.save()

  return shopRepo.addStaff(shopId, staffUserId)
}

export const removeStaff = async (shopId, userContext, staffUserId) => {
  const shop = await shopRepo.findById(shopId)
  if (!shop || !shop.isActive) {
    throw new AppError('Không tìm thấy shop', HTTP_STATUS.NOT_FOUND, ERRORS.SHOP.NOT_FOUND)
  }

  await assertShopPermission({
    user: userContext,
    shopId,
    permissionKey: PERMISSIONS.SHOP_STAFF_REMOVE,
    message: 'Bạn không có quyền xóa staff khỏi shop này',
    errorCode: ERRORS.AUTH.FORBIDDEN
  })
  const updatedShop = await shopRepo.updateById(shopId, {
    $pull: {
      staff: staffUserId,
      staffPermissions: { staffUser: staffUserId }
    }
  })
  await notifyShopUser(
    staffUserId,
    NOTIFICATION_TYPES.SHOP_STAFF_REMOVED,
    updatedShop,
    'Bạn đã được gỡ khỏi staff của shop',
    userContext._id
  )
  return updatedShop
}

export const getShopStaff = async (shopId, userContext) => {
  const shop = await shopRepo.findById(shopId)
  if (!shop || !shop.isActive) {
    throw new AppError('Không tìm thấy shop', HTTP_STATUS.NOT_FOUND, ERRORS.SHOP.NOT_FOUND)
  }

  await assertShopPermission({
    user: userContext,
    shopId,
    permissionKey: PERMISSIONS.SHOP_STAFF_READ,
    message: 'Bạn không có quyền xem staff của shop này',
    errorCode: ERRORS.AUTH.FORBIDDEN
  })

  const permissionByStaffId = new Map(
    (shop.staffPermissions || []).map((entry) => [
      toIdString(entry.staffUser),
      {
        permissions: entry.permissions || [],
        updatedAt: entry.updatedAt || null,
        updatedBy: entry.updatedBy || null
      }
    ])
  )

  const staff = (shop.staff || []).map((member) => {
    const memberId = toIdString(member)
    const permissionEntry = permissionByStaffId.get(memberId)

    return {
      user: member,
      permissions: permissionEntry?.permissions || [],
      permissionUpdatedAt: permissionEntry?.updatedAt || null,
      permissionUpdatedBy: permissionEntry?.updatedBy || null
    }
  })

  return { staff }
}

export const getStaffPermissions = async (shopId, userContext, staffUserId) => {
  const shop = await shopRepo.findById(shopId)
  if (!shop || !shop.isActive) {
    throw new AppError('Không tìm thấy shop', HTTP_STATUS.NOT_FOUND, ERRORS.SHOP.NOT_FOUND)
  }

  ensureShopOwnerAccess(shop, userContext)

  const isStaff = (shop.staff || []).some(
    (staffId) => staffId?._id?.toString() === staffUserId.toString() || staffId?.toString() === staffUserId.toString()
  )

  if (!isStaff) {
    throw new AppError('Người dùng không thuộc staff của shop', HTTP_STATUS.BAD_REQUEST, ERRORS.SHOP.INVALID_STAFF)
  }

  const availablePermissions = await permissionRepo.findByKeys(SHOP_STAFF_PERMISSIONS)
  const assigned = (shop.staffPermissions || []).find(
    (entry) =>
      entry.staffUser?._id?.toString() === staffUserId.toString() ||
      entry.staffUser?.toString() === staffUserId.toString()
  )

  return {
    availablePermissions,
    assignedPermissions: assigned?.permissions || [],
    staffUserId
  }
}

export const getMyShops = async (userId, query, pagination) => {
  await reconcileOwnerShopQuota(userId)

  const filter = {
    isActive: true,
    $or: [{ owner: userId }, { staff: userId }]
  }
  if (query.status) filter.status = query.status

  const { items: shops, meta } = await paginate(shopRepo, filter, pagination)
  return { shops, meta }
}

export const getAdminShopById = async (shopId) => {
  const shop = await shopRepo.findByIdForAdmin(shopId)
  if (!shop || !shop.isActive) {
    throw new AppError('Không tìm thấy shop', HTTP_STATUS.NOT_FOUND, ERRORS.SHOP.NOT_FOUND)
  }
  return shop
}

export const getAdminShops = async (query, pagination) => {
  const filter = { isActive: true, status: { $ne: SHOP_STATUS.DRAFT } }
  if (query.status) filter.status = query.status
  if (query.ownerId) filter.owner = query.ownerId
  if (query.search) filter.$text = { $search: query.search }

  const { items: shops, meta } = await paginate(shopRepo, filter, pagination)
  return { shops, meta }
}

export const resubmitShop = async (shopId, userContext) => {
  const shop = await shopRepo.findById(shopId)
  if (!shop || !shop.isActive) {
    throw new AppError('Không tìm thấy shop', HTTP_STATUS.NOT_FOUND, ERRORS.SHOP.NOT_FOUND)
  }

  await assertShopPermission({
    user: userContext,
    shopId,
    permissionKey: PERMISSIONS.SHOP_PROFILE_SUBMIT_REVIEW,
    message: 'Bạn không có quyền nộp lại shop này',
    errorCode: ERRORS.AUTH.FORBIDDEN
  })

  const owner = await User.findById(userContext._id).select('kyc')
  if (!owner?.kyc || owner.kyc.status === 'none') {
    throw new AppError(
      'Vui lòng nộp hồ sơ xác minh danh tính (CCCD) trước khi nộp lại shop',
      HTTP_STATUS.BAD_REQUEST,
      ERRORS.KYC.NOT_SUBMITTED
    )
  }

  if (shop.status !== SHOP_STATUS.REJECTED) {
    throw new AppError(
      'Shop phải ở trạng thái bị từ chối mới có thể nộp lại',
      HTTP_STATUS.BAD_REQUEST,
      ERRORS.SHOP.NOT_REJECTED
    )
  }

  const isComplete =
    shop.phone?.trim() && shop.email?.trim() && shop.address?.province?.trim() && shop.address?.district?.trim()

  if (!isComplete) {
    throw new AppError(
      'Thông tin shop chưa đầy đủ. Vui lòng điền phone, email, tỉnh/thành và quận/huyện trước khi nộp lại',
      HTTP_STATUS.BAD_REQUEST,
      ERRORS.SHOP.INCOMPLETE_ONBOARDING
    )
  }

  return shopRepo.updateById(shopId, { status: SHOP_STATUS.PENDING_REVIEW, rejectionReason: '' })
}

export const unsuspendShop = async (shopId, actor = null) => {
  const shop = await shopRepo.findById(shopId)
  if (!shop || !shop.isActive) {
    throw new AppError('Không tìm thấy shop', HTTP_STATUS.NOT_FOUND, ERRORS.SHOP.NOT_FOUND)
  }
  if (shop.status !== SHOP_STATUS.SUSPENDED) {
    throw new AppError('Shop không ở trạng thái đình chỉ', HTTP_STATUS.BAD_REQUEST, ERRORS.SHOP.NOT_SUSPENDED)
  }
  const previousStatus = shop.suspensionMeta?.previousStatus || SHOP_STATUS.ACTIVE
  const updatedShop = await shopRepo.updateById(shopId, {
    status: previousStatus === SHOP_STATUS.SUSPENDED ? SHOP_STATUS.ACTIVE : previousStatus,
    rejectionReason: '',
    suspensionMeta: {
      reason: null,
      previousStatus: null,
      suspendedAt: null,
      suspendedBy: shop.suspensionMeta?.suspendedBy || null,
      reasonText: shop.suspensionMeta?.reasonText || '',
      adminNote: shop.suspensionMeta?.adminNote || '',
      unsuspendedBy: actor?._id || null,
      unsuspendedAt: new Date()
    }
  })
  await writeAuditLog({
    adminId: actor?._id,
    action: 'SHOP_UNSUSPENDED',
    targetType: 'shop',
    targetId: shop._id,
    previousStatus: shop.status,
    newStatus: updatedShop.status,
  })
  await notifyShopUser(
    shop.owner?._id || shop.owner,
    NOTIFICATION_TYPES.SHOP_UNBLOCKED,
    updatedShop,
    'Shop của bạn đã được mở khóa'
  )
  return updatedShop
}

export const approveShop = async (shopId, actor = null) => {
  const shop = await shopRepo.findById(shopId)
  if (!shop || !shop.isActive) {
    throw new AppError('Không tìm thấy shop', HTTP_STATUS.NOT_FOUND, ERRORS.SHOP.NOT_FOUND)
  }
  if (shop.status !== SHOP_STATUS.PENDING_REVIEW) {
    throw new AppError('Shop phải ở trạng thái chờ xét duyệt', HTTP_STATUS.BAD_REQUEST, ERRORS.SHOP.NOT_PENDING)
  }

  const shopOwner = await User.findById(shop.owner?._id || shop.owner).select('kyc roles role')
  if (!shopOwner?.kyc || shopOwner.kyc.status !== 'approved') {
    throw new AppError(
      'Chủ shop chưa được xác minh danh tính (KYC), không thể duyệt shop',
      HTTP_STATUS.BAD_REQUEST,
      ERRORS.KYC.NOT_APPROVED
    )
  }

  const ownerRoles = new Set(Array.isArray(shopOwner.roles) ? shopOwner.roles : [])
  if (!ownerRoles.has(ROLES.SHOP_OWNER)) {
    ownerRoles.add(ROLES.SHOP_OWNER)
    shopOwner.roles = [...ownerRoles]
    await shopOwner.save()
  }

  const now = new Date()
  const updatedShop = await shopRepo.updateById(shopId, {
    status: SHOP_STATUS.ACTIVE,
    rejectionReason: '',
    reviewMeta: { reviewedBy: actor?._id || null, reviewedAt: now, adminNote: '' },
    approvalMeta: { approvedBy: actor?._id || null, approvedAt: now, adminNote: '' },
  })
  await writeAuditLog({
    adminId: actor?._id,
    action: 'SHOP_APPROVED',
    targetType: 'shop',
    targetId: shop._id,
    previousStatus: shop.status,
    newStatus: SHOP_STATUS.ACTIVE,
  })
  await notifyShopUser(
    shop.owner?._id || shop.owner,
    NOTIFICATION_TYPES.SHOP_APPROVED,
    updatedShop,
    'Shop của bạn đã được phê duyệt'
  )
  return updatedShop
}

export const rejectShop = async (shopId, rejectionReason, actor = null) => {
  const shop = await shopRepo.findById(shopId)
  if (!shop || !shop.isActive) {
    throw new AppError('Không tìm thấy shop', HTTP_STATUS.NOT_FOUND, ERRORS.SHOP.NOT_FOUND)
  }
  if (shop.status !== SHOP_STATUS.PENDING_REVIEW) {
    throw new AppError('Shop phải ở trạng thái chờ xét duyệt', HTTP_STATUS.BAD_REQUEST, ERRORS.SHOP.NOT_PENDING)
  }
  const now = new Date()
  const updatedShop = await shopRepo.updateById(shopId, {
    status: SHOP_STATUS.REJECTED,
    rejectionReason,
    reviewMeta: { reviewedBy: actor?._id || null, reviewedAt: now, adminNote: '' },
    rejectionMeta: { rejectedBy: actor?._id || null, rejectedAt: now, reason: rejectionReason, adminNote: '' },
  })
  await writeAuditLog({
    adminId: actor?._id,
    action: 'SHOP_REJECTED',
    targetType: 'shop',
    targetId: shop._id,
    previousStatus: shop.status,
    newStatus: SHOP_STATUS.REJECTED,
    reason: rejectionReason,
  })
  await notifyShopUser(
    shop.owner?._id || shop.owner,
    NOTIFICATION_TYPES.SHOP_REJECTED,
    updatedShop,
    'Shop của bạn bị từ chối',
    null,
    { rejectionReason }
  )
  return updatedShop
}

export const suspendShop = async (shopId, reason, actor = null) => {
  const shop = await shopRepo.findById(shopId)
  if (!shop || !shop.isActive) {
    throw new AppError('Không tìm thấy shop', HTTP_STATUS.NOT_FOUND, ERRORS.SHOP.NOT_FOUND)
  }
  if (shop.status !== SHOP_STATUS.ACTIVE) {
    throw new AppError('Chỉ có thể đình chỉ shop đang hoạt động', HTTP_STATUS.BAD_REQUEST, ERRORS.SHOP.NOT_ACTIVE)
  }
  const updatedShop = await shopRepo.updateById(shopId, {
    status: SHOP_STATUS.SUSPENDED,
    suspensionMeta: {
      reason: SHOP_SUSPENSION_REASONS.ADMIN,
      previousStatus: shop.status,
      suspendedAt: new Date(),
      suspendedBy: actor?._id || null,
      reasonText: reason,
      adminNote: '',
      unsuspendedBy: null,
      unsuspendedAt: null
    }
  })
  await writeAuditLog({
    adminId: actor?._id,
    action: 'SHOP_SUSPENDED',
    targetType: 'shop',
    targetId: shop._id,
    previousStatus: shop.status,
    newStatus: SHOP_STATUS.SUSPENDED,
    reason,
  })
  await notifyShopUser(
    shop.owner?._id || shop.owner,
    NOTIFICATION_TYPES.SHOP_BLOCKED,
    updatedShop,
    'Shop của bạn đã bị khóa',
    null,
    { reason }
  )
  return updatedShop
}

export const updateStaffPermissions = async (shopId, userContext, staffUserId, permissionKeys = []) => {
  const shop = await shopRepo.findById(shopId)
  if (!shop || !shop.isActive) {
    throw new AppError('Không tìm thấy shop', HTTP_STATUS.NOT_FOUND, ERRORS.SHOP.NOT_FOUND)
  }

  await assertShopPermission({
    user: userContext,
    shopId,
    permissionKey: PERMISSIONS.SHOP_STAFF_PERMISSION_UPDATE,
    message: 'Bạn không có quyền sửa quyền staff của shop này',
    errorCode: ERRORS.AUTH.FORBIDDEN
  })

  if (userContext?._id?.toString() === staffUserId.toString()) {
    throw new AppError('Không thể tự sửa quyền staff của chính mình', HTTP_STATUS.FORBIDDEN, ERRORS.AUTH.FORBIDDEN)
  }

  const isStaff = (shop.staff || []).some(
    (staffId) => staffId?._id?.toString() === staffUserId.toString() || staffId?.toString() === staffUserId.toString()
  )

  if (!isStaff) {
    throw new AppError('Người dùng không thuộc staff của shop', HTTP_STATUS.BAD_REQUEST, ERRORS.SHOP.INVALID_STAFF)
  }

  const uniqueKeys = [...new Set(permissionKeys)]
  const invalidKeys = uniqueKeys.filter((key) => !SHOP_STAFF_PERMISSIONS.includes(key))
  if (invalidKeys.length) {
    throw new AppError(
      'Danh sách quyền staff chứa quyền không hợp lệ',
      HTTP_STATUS.BAD_REQUEST,
      ERRORS.RBAC.PERMISSION_NOT_FOUND
    )
  }

  const permissions = uniqueKeys.length ? await permissionRepo.findByKeys(uniqueKeys) : []
  if (permissions.length !== uniqueKeys.length) {
    throw new AppError('Danh sách quyền không hợp lệ', HTTP_STATUS.BAD_REQUEST, ERRORS.RBAC.PERMISSION_NOT_FOUND)
  }

  const nextStaffPermissions = (shop.staffPermissions || []).filter(
    (entry) =>
      entry.staffUser?._id?.toString() !== staffUserId.toString() &&
      entry.staffUser?.toString() !== staffUserId.toString()
  )

  nextStaffPermissions.push({
    staffUser: staffUserId,
    permissions: uniqueKeys,
    updatedBy: userContext._id,
    updatedAt: new Date()
  })

  const updatedShop = await shopRepo.updateById(shopId, { staffPermissions: nextStaffPermissions })
  await notifyShopUser(
    staffUserId,
    NOTIFICATION_TYPES.SHOP_STAFF_ROLE_UPDATED,
    updatedShop,
    'Quyền staff của bạn đã được cập nhật',
    userContext._id,
    { permissions: uniqueKeys }
  )

  return {
    shop: updatedShop,
    staffUserId,
    permissions: permissions.map((permission) => permission.key)
  }
}

export const findUserByEmailForShop = async (shopId, userContext, email) => {
  const shop = await shopRepo.findById(shopId)
  if (!shop || !shop.isActive) {
    throw new AppError('Không tìm thấy shop', HTTP_STATUS.NOT_FOUND, ERRORS.SHOP.NOT_FOUND)
  }

  await assertShopPermission({
    user: userContext,
    shopId,
    permissionKey: PERMISSIONS.SHOP_STAFF_INVITE,
    message: 'Bạn không có quyền tìm người dùng để mời staff',
    errorCode: ERRORS.AUTH.FORBIDDEN
  })
  const user = await assertActiveUserByEmail(email)
  return toBasicUserResponse(user)
}

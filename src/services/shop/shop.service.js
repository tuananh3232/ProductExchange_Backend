import * as shopRepo from '../../repositories/shop/shop.repository.js'
import * as permissionRepo from '../../repositories/permission/permission.repository.js'
import User from '../../models/user.model.js'
import AppError from '../../utils/app-error.util.js'
import ERRORS from '../../constants/error.constant.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'
import { paginate } from '../../utils/pagination.util.js'
import { normalizeSlug } from '../../utils/slug.util.js'
import { ROLES } from '../../constants/role.constant.js'
import { SHOP_STATUS } from '../../constants/status.constant.js'

const ensureShopAccess = (shop, userContext) => {
  const roleSet = new Set(userContext?.roles || [])
  if (roleSet.has(ROLES.ADMIN)) return

  const userId = userContext?._id?.toString()
  if (!userId) {
    throw new AppError('Bạn không có quyền truy cập shop này', HTTP_STATUS.FORBIDDEN, ERRORS.AUTH.FORBIDDEN)
  }

  const isOwner = shop.owner?._id?.toString() === userId || shop.owner?.toString() === userId
  const isStaff = (shop.staff || []).some((staffId) => staffId?._id?.toString() === userId || staffId?.toString() === userId)

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
    throw new AppError('Bạn không có quyền quản lý quyền staff của shop này', HTTP_STATUS.FORBIDDEN, ERRORS.AUTH.FORBIDDEN)
  }
}

const assertUserExists = async (userId) => {
  const user = await User.findById(userId)
  if (!user) {
    throw new AppError('Người dùng không tồn tại', HTTP_STATUS.NOT_FOUND, ERRORS.GENERAL.NOT_FOUND)
  }
  return user
}

export const createShop = async (ownerId, payload) => {
  const ownerUser = await assertUserExists(ownerId)

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
    status: SHOP_STATUS.DRAFT,
  })

  const ownerRoles = new Set(ownerUser.roles || [ownerUser.role].filter(Boolean))
  ownerRoles.add(ROLES.SHOP_OWNER)
  ownerUser.roles = [...ownerRoles]
  ownerUser.role = ownerRoles.has(ROLES.ADMIN) ? ROLES.ADMIN : ownerUser.role
  await ownerUser.save()

  return shopRepo.findById(shop._id)
}

export const getShopById = async (shopId) => {
  const shop = await shopRepo.findById(shopId)
  if (!shop || !shop.isActive || shop.status !== SHOP_STATUS.ACTIVE) {
    throw new AppError('Không tìm thấy shop', HTTP_STATUS.NOT_FOUND, ERRORS.SHOP.NOT_FOUND)
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

  ensureShopOwnerAccess(shop, userContext)

  const owner = await User.findById(userContext._id).select('kyc')
  if (!owner?.kyc || owner.kyc.status === 'none') {
    throw new AppError(
      'Vui lòng nộp hồ sơ xác minh danh tính (CCCD) trước khi nộp shop',
      HTTP_STATUS.BAD_REQUEST,
      ERRORS.KYC.NOT_SUBMITTED
    )
  }

  if (shop.status !== SHOP_STATUS.DRAFT) {
    throw new AppError('Shop phải ở trạng thái draft mới có thể nộp xét duyệt', HTTP_STATUS.BAD_REQUEST, ERRORS.SHOP.NOT_DRAFT)
  }

  const isComplete =
    shop.phone?.trim() &&
    shop.email?.trim() &&
    shop.address?.province?.trim() &&
    shop.address?.district?.trim()

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

  ensureShopAccess(shop, userContext)

  const updateData = { ...payload }

  if (Object.prototype.hasOwnProperty.call(payload, 'address') && payload.address) {
    updateData.address = {
      ...(shop.address || {}),
      ...payload.address,
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'logo') && payload.logo) {
    updateData.logo = {
      ...(shop.logo || {}),
      ...payload.logo,
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

export const transferOwner = async (shopId, userContext, newOwnerId) => {
  const shop = await shopRepo.findById(shopId)
  if (!shop || !shop.isActive) {
    throw new AppError('Không tìm thấy shop', HTTP_STATUS.NOT_FOUND, ERRORS.SHOP.NOT_FOUND)
  }

  ensureShopAccess(shop, userContext)
  const newOwner = await assertUserExists(newOwnerId)

  const updateData = {
    owner: newOwnerId,
    staff: (shop.staff || []).filter((staffId) => staffId.toString() !== newOwnerId.toString()),
    staffPermissions: (shop.staffPermissions || []).filter(
      (entry) => (entry.staffUser?._id?.toString() || entry.staffUser?.toString()) !== newOwnerId.toString()
    ),
  }

  const ownerRoles = new Set(newOwner.roles || [newOwner.role].filter(Boolean))
  ownerRoles.add(ROLES.SHOP_OWNER)
  newOwner.roles = [...ownerRoles]
  if (!newOwner.role) {
    newOwner.role = ROLES.SHOP_OWNER
  }
  await newOwner.save()

  return shopRepo.updateById(shopId, updateData)
}

export const addStaff = async (shopId, userContext, staffUserId) => {
  const shop = await shopRepo.findById(shopId)
  if (!shop || !shop.isActive) {
    throw new AppError('Không tìm thấy shop', HTTP_STATUS.NOT_FOUND, ERRORS.SHOP.NOT_FOUND)
  }

  ensureShopAccess(shop, userContext)
  const staffUser = await assertUserExists(staffUserId)

  const isOwner = shop.owner?._id?.toString() === staffUserId.toString() || shop.owner?.toString() === staffUserId.toString()
  if (isOwner) {
    throw new AppError('Không thể thêm owner vào staff', HTTP_STATUS.BAD_REQUEST, ERRORS.SHOP.INVALID_STAFF)
  }

  const staffRoles = new Set(staffUser.roles || [staffUser.role].filter(Boolean))
  staffRoles.add(ROLES.STAFF)
  staffUser.roles = [...staffRoles]
  if (!staffUser.role) {
    staffUser.role = ROLES.STAFF
  }
  await staffUser.save()

  return shopRepo.addStaff(shopId, staffUserId)
}

export const removeStaff = async (shopId, userContext, staffUserId) => {
  const shop = await shopRepo.findById(shopId)
  if (!shop || !shop.isActive) {
    throw new AppError('Không tìm thấy shop', HTTP_STATUS.NOT_FOUND, ERRORS.SHOP.NOT_FOUND)
  }

  ensureShopAccess(shop, userContext)
  return shopRepo.updateById(shopId, {
    $pull: {
      staff: staffUserId,
      staffPermissions: { staffUser: staffUserId },
    },
  })
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

  const availablePermissions = await permissionRepo.findAll()
  const assigned = (shop.staffPermissions || []).find(
    (entry) => entry.staffUser?._id?.toString() === staffUserId.toString() || entry.staffUser?.toString() === staffUserId.toString()
  )

  return {
    availablePermissions,
    assignedPermissions: assigned?.permissions || [],
    staffUserId,
  }
}

export const getMyShops = async (userId, query, pagination) => {
  const filter = { owner: userId, isActive: true }
  if (query.status) filter.status = query.status

  const { items: shops, meta } = await paginate(shopRepo, filter, pagination)
  return { shops, meta }
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

  ensureShopOwnerAccess(shop, userContext)

  const owner = await User.findById(userContext._id).select('kyc')
  if (!owner?.kyc || owner.kyc.status === 'none') {
    throw new AppError(
      'Vui lòng nộp hồ sơ xác minh danh tính (CCCD) trước khi nộp lại shop',
      HTTP_STATUS.BAD_REQUEST,
      ERRORS.KYC.NOT_SUBMITTED
    )
  }

  if (shop.status !== SHOP_STATUS.REJECTED) {
    throw new AppError('Shop phải ở trạng thái bị từ chối mới có thể nộp lại', HTTP_STATUS.BAD_REQUEST, ERRORS.SHOP.NOT_REJECTED)
  }

  const isComplete =
    shop.phone?.trim() &&
    shop.email?.trim() &&
    shop.address?.province?.trim() &&
    shop.address?.district?.trim()

  if (!isComplete) {
    throw new AppError(
      'Thông tin shop chưa đầy đủ. Vui lòng điền phone, email, tỉnh/thành và quận/huyện trước khi nộp lại',
      HTTP_STATUS.BAD_REQUEST,
      ERRORS.SHOP.INCOMPLETE_ONBOARDING
    )
  }

  return shopRepo.updateById(shopId, { status: SHOP_STATUS.PENDING_REVIEW, rejectionReason: '' })
}

export const unsuspendShop = async (shopId) => {
  const shop = await shopRepo.findById(shopId)
  if (!shop || !shop.isActive) {
    throw new AppError('Không tìm thấy shop', HTTP_STATUS.NOT_FOUND, ERRORS.SHOP.NOT_FOUND)
  }
  if (shop.status !== SHOP_STATUS.SUSPENDED) {
    throw new AppError('Shop không ở trạng thái đình chỉ', HTTP_STATUS.BAD_REQUEST, ERRORS.SHOP.NOT_ACTIVE)
  }
  return shopRepo.updateById(shopId, { status: SHOP_STATUS.ACTIVE, rejectionReason: '' })
}

export const approveShop = async (shopId) => {
  const shop = await shopRepo.findById(shopId)
  if (!shop || !shop.isActive) {
    throw new AppError('Không tìm thấy shop', HTTP_STATUS.NOT_FOUND, ERRORS.SHOP.NOT_FOUND)
  }
  if (shop.status !== SHOP_STATUS.PENDING_REVIEW) {
    throw new AppError('Shop phải ở trạng thái chờ xét duyệt', HTTP_STATUS.BAD_REQUEST, ERRORS.SHOP.NOT_PENDING)
  }

  const shopOwner = await User.findById(shop.owner?._id || shop.owner).select('kyc')
  if (!shopOwner?.kyc || shopOwner.kyc.status !== 'approved') {
    throw new AppError('Chủ shop chưa được xác minh danh tính (KYC), không thể duyệt shop', HTTP_STATUS.BAD_REQUEST, ERRORS.KYC.NOT_APPROVED)
  }

  return shopRepo.updateById(shopId, { status: SHOP_STATUS.ACTIVE, rejectionReason: '' })
}

export const rejectShop = async (shopId, rejectionReason) => {
  const shop = await shopRepo.findById(shopId)
  if (!shop || !shop.isActive) {
    throw new AppError('Không tìm thấy shop', HTTP_STATUS.NOT_FOUND, ERRORS.SHOP.NOT_FOUND)
  }
  if (shop.status !== SHOP_STATUS.PENDING_REVIEW) {
    throw new AppError('Shop phải ở trạng thái chờ xét duyệt', HTTP_STATUS.BAD_REQUEST, ERRORS.SHOP.NOT_PENDING)
  }
  return shopRepo.updateById(shopId, { status: SHOP_STATUS.REJECTED, rejectionReason })
}

export const suspendShop = async (shopId, reason) => {
  const shop = await shopRepo.findById(shopId)
  if (!shop || !shop.isActive) {
    throw new AppError('Không tìm thấy shop', HTTP_STATUS.NOT_FOUND, ERRORS.SHOP.NOT_FOUND)
  }
  if (shop.status !== SHOP_STATUS.ACTIVE) {
    throw new AppError('Chỉ có thể đình chỉ shop đang hoạt động', HTTP_STATUS.BAD_REQUEST, ERRORS.SHOP.NOT_ACTIVE)
  }
  return shopRepo.updateById(shopId, { status: SHOP_STATUS.SUSPENDED, rejectionReason: reason })
}

export const updateStaffPermissions = async (shopId, userContext, staffUserId, permissionKeys = []) => {
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

  const uniqueKeys = [...new Set(permissionKeys)]
  const permissions = uniqueKeys.length ? await permissionRepo.findByKeys(uniqueKeys) : []
  if (permissions.length !== uniqueKeys.length) {
    throw new AppError('Danh sách quyền không hợp lệ', HTTP_STATUS.BAD_REQUEST, ERRORS.RBAC.PERMISSION_NOT_FOUND)
  }

  const nextStaffPermissions = (shop.staffPermissions || []).filter(
    (entry) => entry.staffUser?._id?.toString() !== staffUserId.toString() && entry.staffUser?.toString() !== staffUserId.toString()
  )

  nextStaffPermissions.push({
    staffUser: staffUserId,
    permissions: uniqueKeys,
    updatedBy: userContext._id,
    updatedAt: new Date(),
  })

  const updatedShop = await shopRepo.updateById(shopId, { staffPermissions: nextStaffPermissions })

  return {
    shop: updatedShop,
    staffUserId,
    permissions: permissions.map((permission) => permission.key),
  }
}

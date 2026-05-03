import * as shopRepo from '../../repositories/shop/shop.repository.js'
import * as permissionRepo from '../../repositories/permission/permission.repository.js'
import User from '../../models/user.model.js'
import AppError from '../../utils/app-error.util.js'
import ERRORS from '../../constants/error.constant.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'
import { buildPaginationMeta } from '../../utils/pagination.util.js'
import { ROLES } from '../../constants/role.constant.js'

const normalizeSlug = (name = '') =>
  name
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')

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
  if (!shop || !shop.isActive) {
    throw new AppError('Không tìm thấy shop', HTTP_STATUS.NOT_FOUND, ERRORS.SHOP.NOT_FOUND)
  }
  return shop
}

export const getShops = async (query, { page, limit, skip, sortBy, sortOrder }) => {
  const filter = { isActive: true }

  if (query.ownerId) filter.owner = query.ownerId
  if (query.search) filter.$text = { $search: query.search }

  const [shops, total] = await Promise.all([
    shopRepo.findMany({ filter, skip, limit, sortBy, sortOrder }),
    shopRepo.countMany(filter),
  ])

  return { shops, meta: buildPaginationMeta(total, page, limit) }
}

export const updateShop = async (shopId, userContext, payload) => {
  const shop = await shopRepo.findById(shopId)
  if (!shop || !shop.isActive) {
    throw new AppError('Không tìm thấy shop', HTTP_STATUS.NOT_FOUND, ERRORS.SHOP.NOT_FOUND)
  }

  ensureShopAccess(shop, userContext)

  const updateData = { ...payload }
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

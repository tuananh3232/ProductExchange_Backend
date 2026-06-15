import AppError from '../../utils/app-error.util.js'
import ERRORS from '../../constants/error.constant.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'
import { ROLE_ENUM, ROLE_DESCRIPTIONS, ROLES } from '../../constants/role.constant.js'
import { SHOP_STATUS } from '../../constants/status.constant.js'
import {
  RBAC_ASSIGNABLE_ROLE_CODES,
  RBAC_MATRIX_CAPABILITIES,
  RBAC_MATRIX_GROUPS,
  RBAC_MATRIX_PERMISSION_KEYS,
  RBAC_MATRIX_ROLE_CODES,
  RBAC_PROTECTED_ROLE_CODES,
  RBAC_ROLE_UI,
} from '../../constants/rbac-matrix.constant.js'
import * as permissionRepo from '../../repositories/permission/permission.repository.js'
import * as roleRepo from '../../repositories/role/role.repository.js'
import * as shopRepo from '../../repositories/shop/shop.repository.js'
import * as userRepo from '../../repositories/user/user.repository.js'
import { ensureRbacSeedData } from './rbac-seed.service.js'

const protectedRoleCodeSet = new Set(RBAC_PROTECTED_ROLE_CODES)
const matrixRoleCodeSet = new Set(RBAC_MATRIX_ROLE_CODES)
const assignableRoleCodeSet = new Set(RBAC_ASSIGNABLE_ROLE_CODES)
const matrixPermissionKeySet = new Set(RBAC_MATRIX_PERMISSION_KEYS)

const normalizeEmail = (email) => (typeof email === 'string' ? email.trim().toLowerCase() : '')
const toIdString = (value) => (value && value._id ? value._id.toString() : value ? value.toString() : '')

const getRoleUiMeta = (roleCode) => ({
  label: RBAC_ROLE_UI[roleCode]?.label ?? roleCode,
  description: RBAC_ROLE_UI[roleCode]?.description ?? ROLE_DESCRIPTIONS[roleCode] ?? '',
})

const serializeRole = (role) => ({
  _id: role._id,
  code: role.code,
  name: role.name,
  description: role.description ?? '',
  permissions: role.permissions ?? [],
  ui: getRoleUiMeta(role.code),
})

const serializeAssignableUser = (user) => ({
  _id: toIdString(user._id),
  name: user.name,
  email: user.email,
  isActive: user.isActive,
})

const serializeShopSummary = (shop) => ({
  _id: toIdString(shop._id),
  name: shop.name,
  slug: shop.slug ?? '',
  status: shop.status,
  owner: shop.owner
    ? {
        _id: toIdString(shop.owner),
        name: shop.owner.name,
        email: shop.owner.email,
      }
    : null,
})

export const getPermissions = async () => {
  const permissions = await permissionRepo.findAll()
  return permissions
}

export const getRoles = async () => {
  const roles = await roleRepo.findAllWithPermissions()
  return roles
}

export const getRbacMatrix = async () => {
  const roles = await roleRepo.findAllWithPermissions()
  const serializedRoles = roles.map(serializeRole)
  const rolesByCode = new Map(serializedRoles.map((role) => [role.code, role]))

  const matrixRoles = RBAC_MATRIX_ROLE_CODES.map((roleCode) => {
    const existingRole = rolesByCode.get(roleCode)

    return (
      existingRole ?? {
        _id: roleCode,
        code: roleCode,
        name: roleCode,
        description: '',
        permissions: [],
        ui: getRoleUiMeta(roleCode),
      }
    )
  })

  const assignableRoles = RBAC_ASSIGNABLE_ROLE_CODES.map((roleCode) => {
    const ui = getRoleUiMeta(roleCode)

    return {
      code: roleCode,
      label: ui.label,
      description: ui.description,
    }
  })

  const capabilitiesByGroup = RBAC_MATRIX_CAPABILITIES.reduce((accumulator, capability) => {
    accumulator[capability.groupKey] = [...(accumulator[capability.groupKey] ?? []), capability]
    return accumulator
  }, {})

  const groups = RBAC_MATRIX_GROUPS.map((group) => ({
    key: group.key,
    title: group.title,
    description: group.description,
    capabilities: (capabilitiesByGroup[group.key] ?? []).map((capability) => ({
      key: capability.key,
      title: capability.title,
      helper: capability.helper,
      permissionKeys: capability.permissionKeys,
    })),
  }))

  return {
    roles: matrixRoles,
    assignableRoles,
    protectedRoleCodes: RBAC_PROTECTED_ROLE_CODES,
    groups,
    matrixPermissionKeys: RBAC_MATRIX_PERMISSION_KEYS,
    meta: {
      matrixRoleCodes: RBAC_MATRIX_ROLE_CODES,
      assignableRoleCodes: RBAC_ASSIGNABLE_ROLE_CODES,
      protectedRoleCodes: RBAC_PROTECTED_ROLE_CODES,
    },
  }
}

export const updateRolePermissions = async (roleCode, permissionKeys) => {
  if (!ROLE_ENUM.includes(roleCode)) {
    throw new AppError('Role không hợp lệ', HTTP_STATUS.BAD_REQUEST, ERRORS.VALIDATION.INVALID_FORMAT)
  }

  if (protectedRoleCodeSet.has(roleCode) || !matrixRoleCodeSet.has(roleCode)) {
    throw new AppError(
      'Role này không được phép chỉnh sửa trên ma trận RBAC',
      HTTP_STATUS.FORBIDDEN,
      ERRORS.GENERAL.FORBIDDEN
    )
  }

  const uniquePermissionKeys = [...new Set(permissionKeys)]
  const invalidMatrixKeys = uniquePermissionKeys.filter((key) => !matrixPermissionKeySet.has(key))
  if (invalidMatrixKeys.length) {
    throw new AppError(
      'Danh sách permission không hợp lệ trong ma trận RBAC',
      HTTP_STATUS.BAD_REQUEST,
      ERRORS.RBAC.PERMISSION_NOT_FOUND
    )
  }

  const permissions = await permissionRepo.findByKeys(uniquePermissionKeys)
  if (permissions.length !== uniquePermissionKeys.length) {
    throw new AppError('Danh sách permission không hợp lệ', HTTP_STATUS.BAD_REQUEST, ERRORS.RBAC.PERMISSION_NOT_FOUND)
  }

  const currentRole = await roleRepo.findByCodeWithPermissions(roleCode)
  const role = await roleRepo.upsertRoleByCode({
    code: roleCode,
    name: currentRole?.name ?? roleCode,
    description: currentRole?.description ?? '',
    permissionIds: permissions.map((permission) => permission._id),
  })

  return role
}

export const getUserAssignmentPreview = async (email) => {
  const normalizedEmail = normalizeEmail(email)
  const user = await userRepo.findByEmail(normalizedEmail)

  if (!user) {
    throw new AppError('Người dùng không tồn tại', HTTP_STATUS.NOT_FOUND, ERRORS.GENERAL.NOT_FOUND)
  }

  const currentRoles = [...new Set(user.roles || [])]
  const staffShops = await shopRepo.findManyByStaffUserId(user._id)
  const protectedRoles = currentRoles.filter((role) => protectedRoleCodeSet.has(role))

  return {
    user: serializeAssignableUser(user),
    roles: currentRoles,
    staffShops: staffShops.map(serializeShopSummary),
    protectedRoles,
    isProtectedUser: protectedRoles.length > 0,
  }
}

export const assignRolesToUser = async (email, roles, actor = null, options = {}) => {
  const normalizedRoles = [...new Set(roles)]
  if (!normalizedRoles.length) {
    throw new AppError('Người dùng phải có ít nhất một vai trò', HTTP_STATUS.BAD_REQUEST, ERRORS.RBAC.ROLE_REQUIRED)
  }

  const invalidRoles = normalizedRoles.filter((role) => !ROLE_ENUM.includes(role))
  if (invalidRoles.length) {
    throw new AppError('Danh sách vai trò không hợp lệ', HTTP_STATUS.BAD_REQUEST, ERRORS.RBAC.ROLE_NOT_FOUND)
  }

  const disallowedRoles = normalizedRoles.filter((role) => !assignableRoleCodeSet.has(role))
  if (disallowedRoles.length) {
    throw new AppError(
      'Không thể gán vai trò nằm ngoài ma trận phân quyền vận hành',
      HTTP_STATUS.FORBIDDEN,
      ERRORS.GENERAL.FORBIDDEN
    )
  }

  const normalizedEmail = normalizeEmail(email)
  if (actor?.email?.toLowerCase?.() === normalizedEmail) {
    throw new AppError(
      'Không thể tự chỉnh vai trò của chính tài khoản đang đăng nhập',
      HTTP_STATUS.FORBIDDEN,
      ERRORS.GENERAL.FORBIDDEN
    )
  }

  const user = await userRepo.findByEmail(normalizedEmail)
  if (!user) {
    throw new AppError('Người dùng không tồn tại', HTTP_STATUS.NOT_FOUND, ERRORS.GENERAL.NOT_FOUND)
  }

  const currentRoles = new Set(user.roles || [])
  const protectedRoles = [...currentRoles].filter((role) => protectedRoleCodeSet.has(role))
  if (protectedRoles.length) {
    throw new AppError(
      'Không thể chỉnh sửa vai trò của tài khoản quản trị được bảo vệ',
      HTTP_STATUS.FORBIDDEN,
      ERRORS.GENERAL.FORBIDDEN
    )
  }

  const nextRoleSet = new Set(normalizedRoles)
  const shouldAssignStaff = nextRoleSet.has(ROLES.STAFF)
  const normalizedStaffShopId = typeof options.staffShopId === 'string' ? options.staffShopId.trim() : ''

  if (shouldAssignStaff && !nextRoleSet.has(ROLES.MEMBER)) {
    throw new AppError(
      'Vai trò staff phải đi kèm vai trò member để đúng nghiệp vụ',
      HTTP_STATUS.BAD_REQUEST,
      ERRORS.SHOP.INVALID_STAFF
    )
  }

  if (shouldAssignStaff) {
    if (!normalizedStaffShopId) {
      throw new AppError(
        'Khi gán vai trò staff, bạn cần chọn shop tương ứng',
        HTTP_STATUS.BAD_REQUEST,
        ERRORS.SHOP.INVALID_STAFF
      )
    }

    const staffShop = await shopRepo.findByIdForAdmin(normalizedStaffShopId)
    if (!staffShop || !staffShop.isActive || staffShop.status !== SHOP_STATUS.ACTIVE) {
      throw new AppError('Shop được chọn không hợp lệ hoặc chưa hoạt động', HTTP_STATUS.BAD_REQUEST, ERRORS.SHOP.NOT_FOUND)
    }

    if (toIdString(staffShop.owner) === toIdString(user._id)) {
      throw new AppError(
        'Không thể gán chủ shop vào vai trò staff của chính shop đó',
        HTTP_STATUS.BAD_REQUEST,
        ERRORS.SHOP.INVALID_STAFF
      )
    }

    await shopRepo.removeStaffFromAllShops(user._id, normalizedStaffShopId)

    const isAlreadyStaffInSelectedShop = (staffShop.staff || []).some(
      (staffMember) => toIdString(staffMember) === toIdString(user._id)
    )

    if (!isAlreadyStaffInSelectedShop) {
      await shopRepo.addStaff(normalizedStaffShopId, user._id)
    }
  } else {
    await shopRepo.removeStaffFromAllShops(user._id)
  }

  user.roles = [...nextRoleSet]
  await user.save()

  return user.toPublicJSON()
}

export const seedRbac = async () => {
  await ensureRbacSeedData()
}

import User from '../../models/user.model.js'
import AppError from '../../utils/app-error.util.js'
import ERRORS from '../../constants/error.constant.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'
import { ROLE_ENUM, ROLE_DESCRIPTIONS } from '../../constants/role.constant.js'
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
import { ensureRbacSeedData } from './rbac-seed.service.js'

const protectedRoleCodeSet = new Set(RBAC_PROTECTED_ROLE_CODES)
const matrixRoleCodeSet = new Set(RBAC_MATRIX_ROLE_CODES)
const assignableRoleCodeSet = new Set(RBAC_ASSIGNABLE_ROLE_CODES)
const matrixPermissionKeySet = new Set(RBAC_MATRIX_PERMISSION_KEYS)

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

export const assignRolesToUser = async (userId, roles, actor = null) => {
  const normalizedRoles = [...new Set(roles)]
  if (!normalizedRoles.length) {
    throw new AppError('Người dùng phải có ít nhất một role', HTTP_STATUS.BAD_REQUEST, ERRORS.RBAC.ROLE_REQUIRED)
  }

  const invalidRoles = normalizedRoles.filter((role) => !ROLE_ENUM.includes(role))
  if (invalidRoles.length) {
    throw new AppError('Danh sách role không hợp lệ', HTTP_STATUS.BAD_REQUEST, ERRORS.RBAC.ROLE_NOT_FOUND)
  }

  const disallowedRoles = normalizedRoles.filter((role) => !assignableRoleCodeSet.has(role))
  if (disallowedRoles.length) {
    throw new AppError(
      'Không thể gán role nằm ngoài ma trận phân quyền vận hành',
      HTTP_STATUS.FORBIDDEN,
      ERRORS.GENERAL.FORBIDDEN
    )
  }

  if (actor?._id?.toString() === userId?.toString()) {
    throw new AppError(
      'Không thể tự chỉnh role của chính tài khoản đang đăng nhập',
      HTTP_STATUS.FORBIDDEN,
      ERRORS.GENERAL.FORBIDDEN
    )
  }

  const user = await User.findById(userId)
  if (!user) {
    throw new AppError('Người dùng không tồn tại', HTTP_STATUS.NOT_FOUND, ERRORS.GENERAL.NOT_FOUND)
  }

  user.roles = normalizedRoles
  await user.save()

  return user.toPublicJSON()
}

export const seedRbac = async () => {
  await ensureRbacSeedData()
}

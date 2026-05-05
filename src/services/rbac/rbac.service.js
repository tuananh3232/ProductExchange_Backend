import User from '../../models/user.model.js'
import AppError from '../../utils/app-error.util.js'
import ERRORS from '../../constants/error.constant.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'
import { ROLE_ENUM, ROLES } from '../../constants/role.constant.js'
import * as permissionRepo from '../../repositories/permission/permission.repository.js'
import * as roleRepo from '../../repositories/role/role.repository.js'
import { ensureRbacSeedData } from './rbac-seed.service.js'

export const getPermissions = async () => {
  const permissions = await permissionRepo.findAll()
  return permissions
}

export const getRoles = async () => {
  const roles = await roleRepo.findAllWithPermissions()
  return roles
}

export const updateRolePermissions = async (roleCode, permissionKeys) => {
  if (!ROLE_ENUM.includes(roleCode)) {
    throw new AppError('Role không hợp lệ', HTTP_STATUS.BAD_REQUEST, ERRORS.VALIDATION.INVALID_FORMAT)
  }

  const uniquePermissionKeys = [...new Set(permissionKeys)]
  const permissions = await permissionRepo.findByKeys(uniquePermissionKeys)

  if (permissions.length !== uniquePermissionKeys.length) {
    throw new AppError('Danh sách permission không hợp lệ', HTTP_STATUS.BAD_REQUEST, ERRORS.RBAC.PERMISSION_NOT_FOUND)
  }

  const role = await roleRepo.upsertRoleByCode({
    code: roleCode,
    name: roleCode,
    description: '',
    permissionIds: permissions.map((permission) => permission._id),
  })

  return role
}

export const assignRolesToUser = async (userId, roles) => {
  const normalizedRoles = [...new Set(roles)]
  if (!normalizedRoles.length) {
    throw new AppError('Người dùng phải có ít nhất một role', HTTP_STATUS.BAD_REQUEST, ERRORS.RBAC.ROLE_REQUIRED)
  }

  const invalidRoles = normalizedRoles.filter((role) => !ROLE_ENUM.includes(role))
  if (invalidRoles.length) {
    throw new AppError('Danh sách role không hợp lệ', HTTP_STATUS.BAD_REQUEST, ERRORS.RBAC.ROLE_NOT_FOUND)
  }

  const user = await User.findById(userId)
  if (!user) {
    throw new AppError('Người dùng không tồn tại', HTTP_STATUS.NOT_FOUND, ERRORS.GENERAL.NOT_FOUND)
  }

  user.roles = normalizedRoles
  user.role = normalizedRoles.includes(ROLES.ADMIN) ? ROLES.ADMIN : normalizedRoles[0]
  await user.save()

  return user.toPublicJSON()
}

export const seedRbac = async () => {
  await ensureRbacSeedData()
}

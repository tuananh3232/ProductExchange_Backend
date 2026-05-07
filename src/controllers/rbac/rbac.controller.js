import * as rbacService from '../../services/rbac/rbac.service.js'
import { sendSuccess } from '../../utils/response.util.js'
import { asyncHandler } from '../../utils/async-handler.util.js'
import MESSAGES from '../../constants/message.constant.js'

export const getPermissions = asyncHandler(async (req, res) => {
  const permissions = await rbacService.getPermissions()
  sendSuccess(res, { message: MESSAGES.RBAC.PERMISSIONS_FETCHED, data: { permissions } })
})

export const getRoles = asyncHandler(async (req, res) => {
  const roles = await rbacService.getRoles()
  sendSuccess(res, { message: MESSAGES.RBAC.ROLES_FETCHED, data: { roles } })
})

export const updateRolePermissions = asyncHandler(async (req, res) => {
  const role = await rbacService.updateRolePermissions(req.params.roleCode, req.body.permissionKeys)
  sendSuccess(res, { message: MESSAGES.RBAC.ROLE_UPDATED, data: { role } })
})

export const assignRolesToUser = asyncHandler(async (req, res) => {
  const user = await rbacService.assignRolesToUser(req.params.userId, req.body.roles)
  sendSuccess(res, { message: MESSAGES.RBAC.USER_ROLES_UPDATED, data: { user } })
})

export const seedRbac = asyncHandler(async (req, res) => {
  await rbacService.seedRbac()
  sendSuccess(res, { message: MESSAGES.RBAC.SEED_SUCCESS })
})

import * as rbacService from '../../services/rbac/rbac.service.js'
import { sendSuccess } from '../../utils/response.util.js'
import MESSAGES from '../../constants/message.constant.js'

export const getPermissions = async (req, res, next) => {
  try {
    const permissions = await rbacService.getPermissions()
    sendSuccess(res, { message: MESSAGES.RBAC.PERMISSIONS_FETCHED, data: { permissions } })
  } catch (error) {
    next(error)
  }
}

export const getRoles = async (req, res, next) => {
  try {
    const roles = await rbacService.getRoles()
    sendSuccess(res, { message: MESSAGES.RBAC.ROLES_FETCHED, data: { roles } })
  } catch (error) {
    next(error)
  }
}

export const updateRolePermissions = async (req, res, next) => {
  try {
    const role = await rbacService.updateRolePermissions(req.params.roleCode, req.body.permissionKeys)
    sendSuccess(res, { message: MESSAGES.RBAC.ROLE_UPDATED, data: { role } })
  } catch (error) {
    next(error)
  }
}

export const assignRolesToUser = async (req, res, next) => {
  try {
    const user = await rbacService.assignRolesToUser(req.params.userId, req.body.roles)
    sendSuccess(res, { message: MESSAGES.RBAC.USER_ROLES_UPDATED, data: { user } })
  } catch (error) {
    next(error)
  }
}

export const seedRbac = async (req, res, next) => {
  try {
    await rbacService.seedRbac()
    sendSuccess(res, { message: MESSAGES.RBAC.SEED_SUCCESS })
  } catch (error) {
    next(error)
  }
}

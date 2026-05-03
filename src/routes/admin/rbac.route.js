import { Router } from 'express'
import * as rbacController from '../../controllers/rbac/rbac.controller.js'
import { authenticate, requirePermissions } from '../../middlewares/auth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { assignRolesSchema, updateRolePermissionsSchema } from '../../validations/rbac/rbac.validation.js'
import PERMISSIONS from '../../constants/permission.constant.js'

const router = Router()

router.use(authenticate)

router.get('/permissions', requirePermissions(PERMISSIONS.ADMIN_MANAGE_PERMISSIONS), rbacController.getPermissions)
router.get('/roles', requirePermissions(PERMISSIONS.ADMIN_MANAGE_ROLES), rbacController.getRoles)
router.put(
  '/roles/:roleCode/permissions',
  requirePermissions(PERMISSIONS.ADMIN_MANAGE_ROLES),
  validate(updateRolePermissionsSchema),
  rbacController.updateRolePermissions
)
router.patch(
  '/users/:userId/roles',
  requirePermissions(PERMISSIONS.ADMIN_MANAGE_ROLES),
  validate(assignRolesSchema),
  rbacController.assignRolesToUser
)
router.post('/seed', requirePermissions(PERMISSIONS.ADMIN_MANAGE_ROLES), rbacController.seedRbac)

export default router

/**
 * @swagger
 * tags:
 *   name: RBAC
 *   description: API quản lý vai trò và quyền
 *
 * /admin/rbac/permissions:
 *   get:
 *     summary: Lấy danh sách quyền
 *     tags: [RBAC]
 *     responses:
 *       200:
 *         description: Lấy danh sách quyền thành công
 *
 * /admin/rbac/roles:
 *   get:
 *     summary: Lấy danh sách vai trò
 *     tags: [RBAC]
 *     responses:
 *       200:
 *         description: Lấy danh sách vai trò thành công
 *
 * /admin/rbac/roles/{roleCode}/permissions:
 *   put:
 *     summary: Cập nhật quyền cho vai trò
 *     tags: [RBAC]
 *     parameters:
 *       - in: path
 *         name: roleCode
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [permissionCodes]
 *             properties:
 *               permissionCodes:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Cập nhật quyền thành công
 *
 * /admin/rbac/users/{userId}/roles:
 *   patch:
 *     summary: Gán vai trò cho người dùng
 *     tags: [RBAC]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [roleCodes]
 *             properties:
 *               roleCodes:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Cập nhật vai trò thành công
 *
 * /admin/rbac/seed:
 *   post:
 *     summary: Khởi tạo dữ liệu RBAC
 *     tags: [RBAC]
 *     responses:
 *       200:
 *         description: Khởi tạo RBAC thành công
 */

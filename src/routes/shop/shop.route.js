import { Router } from 'express'
import * as shopController from '../../controllers/shop/shop.controller.js'
import { authenticate, requirePermissions } from '../../middlewares/auth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import {
  addStaffSchema,
  createShopSchema,
  updateStaffPermissionsSchema,
  transferOwnerSchema,
  updateShopSchema,
} from '../../validations/shop/shop.validation.js'
import PERMISSIONS from '../../constants/permission.constant.js'
import shopStatsRoutes from './stats.route.js'

const router = Router()

router.use('/:id/stats', shopStatsRoutes)

router.get('/', shopController.getShops)
router.get('/:id', shopController.getShopById)

router.post(
  '/',
  authenticate,
  requirePermissions(PERMISSIONS.SHOP_CREATE),
  validate(createShopSchema),
  shopController.createShop
)

router.put(
  '/:id',
  authenticate,
  requirePermissions(PERMISSIONS.SHOP_UPDATE),
  validate(updateShopSchema),
  shopController.updateShop
)

router.patch(
  '/:id/owner',
  authenticate,
  requirePermissions(PERMISSIONS.SHOP_MANAGE_OWNER),
  validate(transferOwnerSchema),
  shopController.transferOwner
)

router.post(
  '/:id/staff',
  authenticate,
  requirePermissions(PERMISSIONS.SHOP_MANAGE_STAFF),
  validate(addStaffSchema),
  shopController.addStaff
)

router.get(
  '/:id/staff/:staffUserId/permissions',
  authenticate,
  requirePermissions(PERMISSIONS.SHOP_MANAGE_STAFF_PERMISSIONS),
  shopController.getStaffPermissions
)

router.put(
  '/:id/staff/:staffUserId/permissions',
  authenticate,
  requirePermissions(PERMISSIONS.SHOP_MANAGE_STAFF_PERMISSIONS),
  validate(updateStaffPermissionsSchema),
  shopController.updateStaffPermissions
)

router.delete(
  '/:id/staff/:staffUserId',
  authenticate,
  requirePermissions(PERMISSIONS.SHOP_MANAGE_STAFF),
  shopController.removeStaff
)

export default router

/**
 * @swagger
 * /shops/{id}/staff/{staffUserId}/permissions:
 *   get:
 *     summary: Lấy danh sách quyền của staff trong shop
 *     tags: [Shops]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: staffUserId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lấy danh sách quyền staff thành công
 *   put:
 *     summary: Cập nhật quyền của staff trong shop
 *     tags: [Shops]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: staffUserId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [permissions]
 *             properties:
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Cập nhật quyền staff thành công
 */

/**
 * @swagger
 * tags:
 *   name: Shops
 *   description: API quản lý shop
 *
 * /shops:
 *   get:
 *     summary: Lấy danh sách shop
 *     tags: [Shops]
 *     security: []
 *     responses:
 *       200:
 *         description: Lấy danh sách shop thành công
 *   post:
 *     summary: Tạo shop mới
 *     tags: [Shops]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *     responses:
 *       201:
 *         description: Tạo shop thành công
 *
 * /shops/{id}:
 *   get:
 *     summary: Xem chi tiết shop
 *     tags: [Shops]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lấy chi tiết shop thành công
 *   put:
 *     summary: Cập nhật shop
 *     tags: [Shops]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Cập nhật shop thành công
 *
 * /shops/{id}/owner:
 *   patch:
 *     summary: Chuyển owner shop
 *     tags: [Shops]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Cập nhật owner thành công
 *
 * /shops/{id}/staff:
 *   post:
 *     summary: Thêm staff vào shop
 *     tags: [Shops]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       201:
 *         description: Thêm staff thành công
 *
 * /shops/{id}/staff/{staffUserId}:
 *   delete:
 *     summary: Gỡ staff khỏi shop
 *     tags: [Shops]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: staffUserId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Gỡ staff thành công
 */

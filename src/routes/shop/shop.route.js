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
import shopInvitationRoutes from './shop-invitation.route.js'


const router = Router()

router.use('/:id/stats', shopStatsRoutes)

router.get('/', shopController.getShops)

router.get(
  '/mine',
  authenticate,
  requirePermissions(PERMISSIONS.SHOP_READ),
  shopController.getMyShops
)

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

router.post(
  '/:id/submit',
  authenticate,
  requirePermissions(PERMISSIONS.SHOP_UPDATE),
  shopController.submitForReview
)

router.post(
  '/:id/resubmit',
  authenticate,
  requirePermissions(PERMISSIONS.SHOP_UPDATE),
  shopController.resubmitForReview
)

// Invitation routes - must be after specific routes to avoid conflicts
router.use('/', shopInvitationRoutes)

export default router

/**
 * @swagger
 * tags:
 *   name: Shops
 *   description: API quản lý shop
 */

/**
 * @swagger
 * /shops/{id}/staff:
 *   post:
 *     summary: Thêm staff vào shop
 *     tags: [Shops]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [staffUserId]
 *             properties:
 *               staffUserId:
 *                 type: string
 *                 description: ID người dùng cần thêm làm staff
 *     responses:
 *       200:
 *         description: Thêm staff vào shop thành công
 *   delete:
 *     summary: Xóa staff khỏi shop
 *     tags: [Shops]
 *     security:
 *       - bearerAuth: []
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
 *         description: Xóa staff khỏi shop thành công
 *
 * /shops/{id}/staff/{staffUserId}/permissions:
 *   get:
 *     summary: Lấy danh sách quyền của staff trong shop
 *     tags: [Shops]
 *     security:
 *       - bearerAuth: []
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
 *     security:
 *       - bearerAuth: []
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
 *
 * /shops/{id}/invitations:
 *   post:
 *     summary: Gửi lời mời tham gia shop
 *     tags: [Shops]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [inviteeId]
 *             properties:
 *               inviteeId:
 *                 type: string
 *                 description: ID người dùng được mời
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Gửi lời mời tham gia shop thành công
 *   get:
 *     summary: Lấy danh sách lời mời của shop
 *     tags: [Shops]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, accepted, rejected, expired]
 *     responses:
 *       200:
 *         description: Lấy danh sách lời mời thành công
 *
 * /shops/my/invitations:
 *   get:
 *     summary: Lấy danh sách lời mời đang chờ của tôi
 *     tags: [Shops]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lấy danh sách lời mời của tôi thành công
 *
 * /shops/invitations/{invitationId}/action:
 *   post:
 *     summary: Chấp nhận hoặc từ chối lời mời tham gia shop
 *     tags: [Shops]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invitationId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [action]
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [accept, reject]
 *     responses:
 *       200:
 *         description: Xử lý lời mời tham gia shop thành công
 *
 * /shops/invitations/{invitationId}:
 *   delete:
 *     summary: Hủy lời mời tham gia shop
 *     tags: [Shops]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invitationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Hủy lời mời tham gia shop thành công
 */

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
 * /shops/mine:
 *   get:
 *     summary: Lấy danh sách shop của tôi (owner)
 *     tags: [Shops]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, pending_review, active, rejected, suspended]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lấy danh sách shop của tôi thành công
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             minProperties: 1
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *               address:
 *                 type: object
 *                 properties:
 *                   province:
 *                     type: string
 *                   district:
 *                     type: string
 *                   detail:
 *                     type: string
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
 *
 * /shops/{id}/submit:
 *   post:
 *     summary: Nộp shop để xét duyệt (draft → pending_review)
 *     tags: [Shops]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Nộp shop thành công
 *
 * /shops/{id}/resubmit:
 *   post:
 *     summary: Nộp lại shop sau khi bị từ chối (rejected → pending_review)
 *     tags: [Shops]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Nộp lại shop thành công
 */

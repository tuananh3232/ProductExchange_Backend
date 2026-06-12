import { Router } from 'express'
import * as shopController from '../../controllers/shop/shop.controller.js'
import * as productController from '../../controllers/product/product.controller.js'
import * as optionsController from '../../controllers/options/options.controller.js'
import { authenticate, requirePermissions, requireShopPermission } from '../../middlewares/auth.middleware.js'
import { validateObjectId } from '../../middlewares/object-id.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import {
  createShopSchema,
  updateStaffPermissionsSchema,
  transferOwnerSchema,
  updateShopSchema
} from '../../validations/shop/shop.validation.js'
import PERMISSIONS from '../../constants/permission.constant.js'
import shopStatsRoutes from './stats.route.js'
import shopInvitationRoutes from './shop-invitation.route.js'

const router = Router()

router.use('/:id/stats', shopStatsRoutes)

router.get('/filter-options', optionsController.getShopFilterOptions)
router.get('/', shopController.getShops)

router.get('/mine', authenticate, requirePermissions(PERMISSIONS.SHOP_PROFILE_READ), shopController.getMyShops)

router.get('/:id', shopController.getShopById)

router.get(
  '/:id/dashboard',
  authenticate,
  requireShopPermission(PERMISSIONS.SHOP_PROFILE_READ),
  shopController.getShopDashboard
)

router.get(
  '/:id/products',
  authenticate,
  requireShopPermission(PERMISSIONS.SHOP_PRODUCT_READ),
  productController.getShopProducts
)

router.post('/', authenticate, validate(createShopSchema), shopController.createShop)

router.put(
  '/:id',
  validateObjectId('id'),
  authenticate,
  requireShopPermission(PERMISSIONS.SHOP_PROFILE_UPDATE),
  validate(updateShopSchema),
  shopController.updateShop
)

router.delete(
  '/:id',
  validateObjectId('id'),
  authenticate,
  requireShopPermission(PERMISSIONS.SHOP_PROFILE_UPDATE),
  shopController.deleteShop
)

router.patch(
  '/:id/owner',
  validateObjectId('id'),
  authenticate,
  requireShopPermission(PERMISSIONS.SHOP_OWNER_TRANSFER),
  validate(transferOwnerSchema),
  shopController.transferOwner
)

router.get('/:id/staff', authenticate, requireShopPermission(PERMISSIONS.SHOP_STAFF_READ), shopController.getShopStaff)

router.get(
  '/:id/users/by-email',
  authenticate,
  validateObjectId('id'),
  requireShopPermission(PERMISSIONS.SHOP_STAFF_INVITE),
  shopController.getInviteeCandidates
)

router.get(
  '/:id/staff/:staffUserId/permissions',
  authenticate,
  requireShopPermission(PERMISSIONS.SHOP_STAFF_PERMISSION_READ),
  shopController.getStaffPermissions
)

router.put(
  '/:id/staff/:staffUserId/permissions',
  authenticate,
  requireShopPermission(PERMISSIONS.SHOP_STAFF_PERMISSION_UPDATE),
  validate(updateStaffPermissionsSchema),
  shopController.updateStaffPermissions
)

router.delete(
  '/:id/staff/:staffUserId',
  authenticate,
  requireShopPermission(PERMISSIONS.SHOP_STAFF_REMOVE),
  shopController.removeStaff
)

router.post(
  '/:id/submit',
  authenticate,
  requireShopPermission(PERMISSIONS.SHOP_PROFILE_SUBMIT_REVIEW),
  shopController.submitForReview
)

router.post(
  '/:id/resubmit',
  authenticate,
  requireShopPermission(PERMISSIONS.SHOP_PROFILE_SUBMIT_REVIEW),
  shopController.resubmitForReview
)

router.use('/', shopInvitationRoutes)

export default router

/**
 * @swagger
 * tags:
 *   - name: Public - Shops
 *     description: API shop public
 *   - name: Shop Owner
 *     description: API quản lý shop dành cho chủ shop
 *   - name: Shop Dashboard
 *     description: API dashboard shop dành cho owner/staff
 *   - name: Shop Products
 *     description: API quản lý sản phẩm shop
 *   - name: Shop Staff Management
 *     description: API quản lý staff của shop
 *   - name: Shop Invitations
 *     description: API quản lý lời mời staff
 *
 * /shops:
 *   get:
 *     summary: Lấy danh sách shop public
 *     tags: [Public - Shops]
 *     security: []
 *     responses:
 *       200:
 *         description: Lấy danh sách shop thành công
 *   post:
 *     summary: Tạo shop mới
 *     tags: [Shop Owner]
 *     security:
 *       - bearerAuth: []
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
 * /shops/mine:
 *   get:
 *     summary: Lấy danh sách shop của tôi
 *     tags: [Shop Owner]
 *     security:
 *       - bearerAuth: []
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
 * /shops/{id}:
 *   get:
 *     summary: Xem chi tiết shop public
 *     tags: [Public - Shops]
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
 *     tags: [Shop Owner]
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
 *   delete:
 *     summary: Xóa shop bị từ chối
 *     tags: [Shop Owner]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Xóa shop bị từ chối thành công
 *       400:
 *         description: Shop không ở trạng thái rejected
 *       403:
 *         description: Không có quyền
 *       404:
 *         description: Không tìm thấy shop
 *
 * /shops/{id}/dashboard:
 *   get:
 *     summary: Lấy dashboard shop
 *     tags: [Shop Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lấy dashboard shop thành công
 *
 * /shops/{id}/products:
 *   get:
 *     summary: Lấy danh sách sản phẩm của shop
 *     tags: [Shop Products]
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
 *         description: Lấy danh sách sản phẩm của shop thành công
 *
 * /shops/{id}/owner:
 *   patch:
 *     summary: Chuyển owner shop bằng email
 *     tags: [Shop Owner]
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
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *     responses:
 *       200:
 *         description: Cập nhật owner thành công
 *       400:
 *         description: Email không hợp lệ
 *       403:
 *         description: Không có quyền
 *       404:
 *         description: Email chưa đăng ký
 *
 * /shops/{id}/staff:
 *   get:
 *     summary: Lấy danh sách staff của shop
 *     tags: [Shop Staff Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lấy danh sách staff thành công
 *
 * /shops/{id}/users/by-email:
 *   get:
 *     summary: Tìm người dùng theo email
 *     tags: [Shop Staff Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *           format: email
 *     responses:
 *       200:
 *         description: Tìm người dùng thành công
 *       400:
 *         description: Email không hợp lệ
 *       404:
 *         description: Email chưa đăng ký
 *
 * /shops/{id}/staff/{staffUserId}/permissions:
 *   get:
 *     summary: Lấy quyền của staff
 *     tags: [Shop Staff Management]
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
 *         description: Lấy quyền staff thành công
 *   put:
 *     summary: Cập nhật quyền staff
 *     tags: [Shop Staff Management]
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
 * /shops/{id}/staff/{staffUserId}:
 *   delete:
 *     summary: Gỡ staff khỏi shop
 *     tags: [Shop Staff Management]
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
 *         description: Gỡ staff thành công
 *
 * /shops/{id}/invitations:
 *   post:
 *     summary: Gửi lời mời staff
 *     tags: [Shop Invitations]
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
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *     responses:
 *       201:
 *         description: Gửi lời mời staff thành công
 *   get:
 *     summary: Lấy danh sách lời mời staff
 *     tags: [Shop Invitations]
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
 *     summary: Lấy lời mời staff của tôi
 *     tags: [Shop Invitations]
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
 *         description: Lấy lời mời staff của tôi thành công
 *
 * /shops/invitations/{invitationId}/action:
 *   post:
 *     summary: Phản hồi lời mời staff
 *     tags: [Shop Invitations]
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
 *         description: Phản hồi lời mời staff thành công
 *
 * /shops/invitations/{invitationId}:
 *   delete:
 *     summary: Hủy lời mời staff
 *     tags: [Shop Invitations]
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
 *         description: Hủy lời mời staff thành công
 *
 * /shops/{id}/submit:
 *   post:
 *     summary: Nộp shop để xét duyệt
 *     tags: [Shop Owner]
 *     security:
 *       - bearerAuth: []
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
 *     summary: Nộp lại shop
 *     tags: [Shop Owner]
 *     security:
 *       - bearerAuth: []
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

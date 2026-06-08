import { Router } from 'express'
import * as productController from '../../controllers/product/product.controller.js'
import * as productVisualController from '../../controllers/product/product-visual.controller.js'
import { authenticate, requirePermissions, requireShopOwnerProductVisual } from '../../middlewares/auth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { validateObjectId } from '../../middlewares/object-id.middleware.js'
import {
  createProductSchema,
  updateProductSchema,
  updateStatusSchema,
} from '../../validations/product/product.validation.js'
import {
  updateVisualProfileSchema,
  previewCutoutSchema,
  confirmCutoutSchema,
} from '../../validations/product/product-visual.validation.js'
import { uploadProductImages, uploadProductVisualImage, parseJsonFields } from '../../middlewares/upload.middleware.js'
import { productQuerySchema } from '../../validations/common/query.validation.js'
import PERMISSIONS from '../../constants/permission.constant.js'

const router = Router()

/**
 * @swagger
 * tags:
 *   - name: Products
 *     description: API duyệt và tìm kiếm sản phẩm public
 *   - name: Product Management
 *     description: API tạo, cập nhật, xóa sản phẩm shop và sản phẩm cá nhân seller
 */

/**
 * @swagger
 * /products:
 *   get:
 *     summary: Lấy danh sách sản phẩm public
 *     tags: [Products]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: listingType
 *         schema: { type: string, enum: [sell] }
 *       - in: query
 *         name: minPrice
 *         schema: { type: number }
 *       - in: query
 *         name: maxPrice
 *         schema: { type: number }
 *       - in: query
 *         name: ownerType
 *         schema: { type: string, enum: [SHOP, SELLER] }
 *       - in: query
 *         name: shopId
 *         schema:
 *           type: string
 *       - in: query
 *         name: sellerId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lấy danh sách sản phẩm thành công
 *   post:
 *     summary: Tạo sản phẩm cá nhân hoặc sản phẩm shop
 *     tags: [Product Management]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [title, description, price, listingType, condition, category]
 *             properties:
 *               ownerType:
 *                 type: string
 *                 enum: [SHOP, SELLER]
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *                 example: 650000
 *               stock:
 *                 type: integer
 *                 minimum: 0
 *                 default: 1
 *                 example: 12
 *               listingType:
 *                 type: string
 *                 enum: [sell]
 *               condition:
 *                 type: string
 *                 enum: [new, like_new, good, fair, poor]
 *               category:
 *                 type: string
 *                 example: 507f1f77bcf86cd799439011
 *               shop:
 *                 type: string
 *                 example: 507f1f77bcf86cd799439012
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *               location:
 *                 type: object
 *                 properties:
 *                   province:
 *                     type: string
 *                   district:
 *                     type: string
 *               style:
 *                 type: string
 *                 enum: [minimalist, modern, vintage, luxury, korean, bohemian]
 *               roomType:
 *                 type: string
 *                 enum: [bedroom, living_room, kitchen, workspace]
 *               colorTone:
 *                 type: string
 *                 enum: [warm, cool, neutral, dark, bright]
 *               decorRole:
 *                 type: string
 *                 enum: [main_item, lighting, wall_decor, textile, accent_item, fragrance]
 *               comboPriority:
 *                 type: number
 *           examples:
 *             createShopProduct:
 *               summary: Tạo sản phẩm shop
 *               value:
 *                 ownerType: SHOP
 *                 title: Wood decor table
 *                 description: Bàn decor gỗ tự nhiên cho phòng khách.
 *                 price: 650000
 *                 stock: 12
 *                 listingType: sell
 *                 condition: good
 *                 category: 507f1f77bcf86cd799439011
 *                 shop: 507f1f77bcf86cd799439012
 *             createSellerProduct:
 *               summary: Tạo sản phẩm cá nhân
 *               value:
 *                 ownerType: SELLER
 *                 title: Decor desk lamp
 *                 description: Đèn bàn ánh sáng ấm cho góc đọc sách.
 *                 price: 450000
 *                 stock: 1
 *                 listingType: sell
 *                 condition: like_new
 *                 category: 507f1f77bcf86cd799439011
 *     responses:
 *       201:
 *         description: Tạo sản phẩm thành công
 */
router.get('/', validate(productQuerySchema, 'query'), productController.getProducts)
router.post(
  '/',
  authenticate,
  requirePermissions(PERMISSIONS.PRODUCT_CREATE),
  uploadProductImages,
  parseJsonFields(['location']),
  validate(createProductSchema),
  productController.createProduct
)

/**
 * @swagger
 * /products/{id}:
 *   get:
 *     summary: Lấy chi tiết sản phẩm public
 *     tags: [Products]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lấy chi tiết sản phẩm thành công
 *   patch:
 *     summary: Cập nhật sản phẩm
 *     tags: [Product Management]
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
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *                 example: 650000
 *               stock:
 *                 type: integer
 *                 minimum: 0
 *                 example: 8
 *               condition:
 *                 type: string
 *                 enum: [new, like_new, good, fair, poor]
 *               category:
 *                 type: string
 *               shop:
 *                 type: string
 *                 nullable: true
 *               images:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     url:
 *                       type: string
 *                     publicId:
 *                       type: string
 *               location:
 *                 type: object
 *                 properties:
 *                   province:
 *                     type: string
 *                   district:
 *                     type: string
 *               style:
 *                 type: string
 *                 enum: [minimalist, modern, vintage, luxury, korean, bohemian]
 *               roomType:
 *                 type: string
 *                 enum: [bedroom, living_room, kitchen, workspace]
 *               colorTone:
 *                 type: string
 *                 enum: [warm, cool, neutral, dark, bright]
 *               decorRole:
 *                 type: string
 *                 enum: [main_item, lighting, wall_decor, textile, accent_item, fragrance]
 *               comboPriority:
 *                 type: number
 *     responses:
 *       200:
 *         description: Cập nhật sản phẩm thành công
 *   delete:
 *     summary: Xóa sản phẩm
 *     tags: [Product Management]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Xóa sản phẩm thành công
 */
router.get('/:id', validateObjectId('id'), productController.getProductById)
router.patch(
  '/:id',
  validateObjectId('id'),
  authenticate,
  requirePermissions(PERMISSIONS.PRODUCT_UPDATE),
  validate(updateProductSchema),
  productController.updateProduct
)
router.patch(
  '/:id/status',
  validateObjectId('id'),
  authenticate,
  requirePermissions(PERMISSIONS.PRODUCT_UPDATE),
  validate(updateStatusSchema),
  productController.updateProductStatus
)
router.post(
  '/:id/images',
  validateObjectId('id'),
  authenticate,
  requirePermissions(PERMISSIONS.PRODUCT_UPDATE),
  uploadProductImages,
  productController.addProductImages
)
router.delete(
  '/:id/images/:publicId',
  validateObjectId('id'),
  authenticate,
  requirePermissions(PERMISSIONS.PRODUCT_UPDATE),
  productController.removeProductImage
)
router.delete(
  '/:id',
  validateObjectId('id'),
  authenticate,
  requirePermissions(PERMISSIONS.PRODUCT_DELETE),
  productController.deleteProduct
)

/**
 * @swagger
 * /products/{id}/visual-assets/source:
 *   post:
 *     summary: Upload ảnh nguồn sản phẩm (source image)
 *     tags: [Product Management]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [image]
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Upload source image thành công
 *
 * /products/{id}/visual-assets/cutout:
 *   post:
 *     summary: Upload cutout sản phẩm (đã xóa nền)
 *     tags: [Product Management]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *               view:
 *                 type: string
 *                 enum: [front, left_angle, right_angle, back]
 *                 default: front
 *               provider:
 *                 type: string
 *                 enum: [manual, cloudinary, remove_bg, clipdrop, internal]
 *                 default: manual
 *     responses:
 *       200:
 *         description: Upload cutout thành công
 *   delete:
 *     summary: Xóa cutout sản phẩm
 *     tags: [Product Management]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: publicId
 *         required: true
 *         schema:
 *           type: string
 *         description: Cloudinary publicId của cutout cần xóa, ví dụ products/cutouts/abc123
 *     responses:
 *       200:
 *         description: Xóa cutout thành công
 *
 * /products/{id}/visual-profile:
 *   patch:
 *     summary: Cập nhật visual profile và kích thước sản phẩm
 *     tags: [Product Management]
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
 *             properties:
 *               dimensions:
 *                 type: object
 *                 properties:
 *                   widthCm:
 *                     type: number
 *                     minimum: 1
 *                     maximum: 2000
 *                   heightCm:
 *                     type: number
 *                     minimum: 1
 *                     maximum: 2000
 *                   depthCm:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 2000
 *               visualProfile:
 *                 type: object
 *                 properties:
 *                   placementType:
 *                     type: string
 *                     enum: [wall_mounted, floor_standing, surface_standing]
 *                   anchor:
 *                     type: string
 *                     enum: [center, bottom_center, bottom_left, bottom_right]
 *     responses:
 *       200:
 *         description: Cập nhật visual profile thành công
 */
/**
 * @swagger
 * /products/{id}/visual-assets/cutout/preview:
 *   post:
 *     summary: Tách nền ảnh và trả về preview (chưa lưu vào sản phẩm)
 *     tags: [Product Management]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [image]
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *               provider:
 *                 type: string
 *                 enum: [manual, remove_bg]
 *                 default: remove_bg
 *     responses:
 *       200:
 *         description: Preview tách nền thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 previewUrl:
 *                   type: string
 *                 tempPublicId:
 *                   type: string
 *                 widthPx:
 *                   type: integer
 *                 heightPx:
 *                   type: integer
 *
 * /products/{id}/visual-assets/cutout/confirm:
 *   post:
 *     summary: Xác nhận cutout preview và lưu vào sản phẩm (kèm kích thước thực)
 *     tags: [Product Management]
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
 *             required: [tempPublicId, widthCm, heightCm]
 *             properties:
 *               tempPublicId:
 *                 type: string
 *                 description: publicId trả về từ API preview
 *               view:
 *                 type: string
 *                 enum: [front, left_angle, right_angle, back]
 *                 default: front
 *               widthCm:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 2000
 *               heightCm:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 2000
 *               depthCm:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 2000
 *     responses:
 *       200:
 *         description: Xác nhận cutout thành công, isVisualizerReady được tính lại
 */
router.post(
  '/:id/visual-assets/cutout/preview',
  authenticate,
  validateObjectId('id'),
  requirePermissions(PERMISSIONS.PRODUCT_VISUAL_ASSET_MANAGE),
  requireShopOwnerProductVisual,
  uploadProductVisualImage,
  validate(previewCutoutSchema),
  productVisualController.previewCutout
)
router.post(
  '/:id/visual-assets/cutout/confirm',
  authenticate,
  validateObjectId('id'),
  requirePermissions(PERMISSIONS.PRODUCT_VISUAL_ASSET_MANAGE),
  requireShopOwnerProductVisual,
  validate(confirmCutoutSchema),
  productVisualController.confirmCutout
)
router.post(
  '/:id/visual-assets/source',
  authenticate,
  validateObjectId('id'),
  requirePermissions(PERMISSIONS.PRODUCT_VISUAL_ASSET_MANAGE),
  requireShopOwnerProductVisual,
  uploadProductVisualImage,
  productVisualController.uploadSource
)
router.patch(
  '/:id/visual-profile',
  authenticate,
  validateObjectId('id'),
  requirePermissions(PERMISSIONS.PRODUCT_VISUAL_ASSET_MANAGE),
  requireShopOwnerProductVisual,
  validate(updateVisualProfileSchema),
  productVisualController.updateVisualProfile
)
router.delete(
  '/:id/visual-assets/cutout',
  authenticate,
  validateObjectId('id'),
  requirePermissions(PERMISSIONS.PRODUCT_VISUAL_ASSET_MANAGE),
  requireShopOwnerProductVisual,
  productVisualController.deleteCutout
)

export default router

/**
 * @swagger
 * /products/{id}/status:
 *   patch:
 *     summary: Cập nhật trạng thái sản phẩm
 *     tags: [Product Management]
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
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [available, pending, sold, hidden]
 *     responses:
 *       200:
 *         description: Cập nhật trạng thái sản phẩm thành công
 *
 * /products/{id}/images:
 *   post:
 *     summary: Thêm ảnh sản phẩm
 *     tags: [Product Management]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [images]
 *             properties:
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Thêm ảnh sản phẩm thành công
 *
 * /products/{id}/images/{publicId}:
 *   delete:
 *     summary: Xóa ảnh sản phẩm
 *     tags: [Product Management]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: publicId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Xóa ảnh sản phẩm thành công
 */

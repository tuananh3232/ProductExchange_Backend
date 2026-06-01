import { Router } from 'express'
import * as productController from '../../controllers/product/product.controller.js'
import { authenticate, requirePermissions } from '../../middlewares/auth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { validateObjectId } from '../../middlewares/object-id.middleware.js'
import {
  createProductSchema,
  updateProductSchema,
  updateStatusSchema,
} from '../../validations/product/product.validation.js'
import { uploadProductImages, parseJsonFields } from '../../middlewares/upload.middleware.js'
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
 *                 type: string
 *                 description: 'JSON string, ví dụ: {"province":"Hà Nội","district":"Cầu Giấy"}'
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

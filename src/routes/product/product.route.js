import { Router } from 'express'
import * as productController from '../../controllers/product/product.controller.js'
import { authenticate } from '../../middlewares/auth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import {
	addProductImagesSchema,
	createProductSchema,
	updateProductSchema,
	updateStatusSchema,
} from '../../validations/product/product.validation.js'
const router = Router()

/**
 * @swagger
 * tags:
 *   name: Products
 *   description: API Quản lý sản phẩm
 */

/**
 * @swagger
 * /products:
 *   get:
 *     summary: Lấy danh sách sản phẩm
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
 *         schema: { type: string }
 *       - in: query
 *         name: listingType
 *         schema: { type: string, enum: [sell, exchange, both] }
 *       - in: query
 *         name: minPrice
 *         schema: { type: number }
 *       - in: query
 *         name: maxPrice
 *         schema: { type: number }
 *     responses:
 *       200:
 *         description: Lấy danh sách thành công
 *   post:
 *     summary: Đăng sản phẩm mới
 *     tags: [Products]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               listingType:
 *                 type: string
 *                 enum: [sell, exchange, both]
 *               condition:
 *                 type: string
 *                 enum: [new, like_new, good, fair, poor]
 *               category:
 *                 type: string
 *     responses:
 *       201:
 *         description: Thành công
 */
router.get('/', productController.getProducts)
router.post(
	'/',
	authenticate,
	validate(createProductSchema),
	productController.createProduct
)

/**
 * @swagger
 * /products/{id}:
 *   get:
 *     summary: Lấy chi tiết sản phẩm
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
 *         description: Thành công
 *   patch:
 *     summary: Cập nhật sản phẩm
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Thành công
 *   delete:
 *     summary: Xóa sản phẩm
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Thành công
 */
router.get('/:id', productController.getProductById)
router.patch(
	'/:id',
	authenticate,
	validate(updateProductSchema),
	productController.updateProduct
)
router.patch(
	'/:id/status',
	authenticate,
	validate(updateStatusSchema),
	productController.updateProductStatus
)
router.post(
	'/:id/images',
	authenticate,
	validate(addProductImagesSchema),
	productController.addProductImages
)
router.delete(
	'/:id/images/:publicId',
	authenticate,
	productController.removeProductImage
)
router.delete('/:id', authenticate, productController.deleteProduct)

export default router

/**
 * @swagger
 * /products/{id}/status:
 *   patch:
 *     summary: Cập nhật trạng thái sản phẩm
 *     tags: [Products]
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
 *                 enum: [available, pending, sold, exchanged, hidden]
 *     responses:
 *       200:
 *         description: Cập nhật trạng thái thành công
 *
 * /products/{id}/images:
 *   post:
 *     summary: Thêm ảnh sản phẩm
 *     tags: [Products]
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
 *             required: [images]
 *             properties:
 *               images:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     url:
 *                       type: string
 *                     publicId:
 *                       type: string
 *     responses:
 *       200:
 *         description: Thêm ảnh thành công
 *
 * /products/{id}/images/{publicId}:
 *   delete:
 *     summary: Xóa ảnh sản phẩm
 *     tags: [Products]
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
 *         description: Xóa ảnh thành công
 */

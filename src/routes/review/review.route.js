import { Router } from 'express'
import * as reviewController from '../../controllers/review/review.controller.js'
import { authenticate } from '../../middlewares/auth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { validateObjectId } from '../../middlewares/object-id.middleware.js'
import { uploadReviewImages } from '../../middlewares/upload.middleware.js'
import { createReviewSchema, updateReviewSchema, replyReviewSchema } from '../../validations/review/review.validation.js'

const router = Router()

/**
 * @swagger
 * tags:
 *   name: Reviews
 *   description: API Đánh giá sản phẩm
 */

/**
 * @swagger
 * /reviews/products/{productId}:
 *   get:
 *     summary: Lấy danh sách đánh giá của một sản phẩm (kèm tổng quan sao)
 *     tags: [Reviews]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
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
 *       - in: query
 *         name: rating
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 5
 *         description: Lọc theo số sao
 *       - in: query
 *         name: hasImage
 *         schema:
 *           type: boolean
 *         description: Chỉ lấy đánh giá có ảnh
 *     responses:
 *       200:
 *         description: Lấy danh sách đánh giá thành công
 */
router.get('/products/:productId', validateObjectId('productId'), reviewController.getProductReviews)

/**
 * @swagger
 * /reviews:
 *   post:
 *     summary: Tạo đánh giá sản phẩm (chỉ người đã mua, đơn đã giao)
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [orderId, productId, rating]
 *             properties:
 *               orderId:
 *                 type: string
 *               productId:
 *                 type: string
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               comment:
 *                 type: string
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       201:
 *         description: Đánh giá sản phẩm thành công
 */
router.post('/', authenticate, uploadReviewImages, validate(createReviewSchema), reviewController.createReview)

/**
 * @swagger
 * /reviews/{id}:
 *   patch:
 *     summary: Cập nhật đánh giá của chính mình
 *     tags: [Reviews]
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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               comment:
 *                 type: string
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Cập nhật đánh giá thành công
 *   delete:
 *     summary: Xóa đánh giá (chủ đánh giá hoặc admin)
 *     tags: [Reviews]
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
 *         description: Xóa đánh giá thành công
 */
router.patch('/:id', authenticate, validateObjectId('id'), uploadReviewImages, validate(updateReviewSchema), reviewController.updateReview)
router.delete('/:id', authenticate, validateObjectId('id'), reviewController.deleteReview)

/**
 * @swagger
 * /reviews/{id}/reply:
 *   post:
 *     summary: Người bán/shop phản hồi đánh giá
 *     tags: [Reviews]
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
 *             required: [content]
 *             properties:
 *               content:
 *                 type: string
 *     responses:
 *       200:
 *         description: Phản hồi đánh giá thành công
 */
router.post('/:id/reply', authenticate, validateObjectId('id'), validate(replyReviewSchema), reviewController.replyReview)

export default router

import { Router } from 'express'
import * as categoryController from '../../controllers/category/category.controller.js'
import { authenticate } from '../../middlewares/auth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { createCategorySchema, updateCategorySchema } from '../../validations/category/category.validation.js'

const router = Router()

/**
 * @swagger
 * tags:
 *   name: Categories
 *   description: API Quản lý danh mục
 */

/**
 * @swagger
 * /categories:
 *   get:
 *     summary: Lấy danh sách danh mục
 *     tags: [Categories]
 *     security: []
 *     responses:
 *       200:
 *         description: Lấy danh sách thành công
 *   post:
 *     summary: Tạo danh mục mới
 *     tags: [Categories]
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
 *                 example: Đồ trang trí
 *               slug:
 *                 type: string
 *                 example: do-trang-tri
 *               description:
 *                 type: string
 *                 example: Các món decor giúp làm đẹp không gian sống.
 *               icon:
 *                 type: string
 *                 example: 
 *               isActive:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       201:
 *         description: Tạo danh mục thành công
 */
router.get('/', categoryController.getCategories)
router.post('/', authenticate, validate(createCategorySchema), categoryController.createCategory)

/**
 * @swagger
 * /categories/{id}:
 *   get:
 *     summary: Lấy chi tiết danh mục
 *     tags: [Categories]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lấy chi tiết thành công
 *   patch:
 *     summary: Cập nhật danh mục
 *     tags: [Categories]
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
 *             properties:
 *               name:
 *                 type: string
 *                 example: Đồ trang trí
 *               slug:
 *                 type: string
 *                 example: do-trang-tri
 *               description:
 *                 type: string
 *                 example: Các món decor giúp làm đẹp không gian sống.
 *               icon:
 *                 type: string
 *                 example: 
 *               isActive:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Cập nhật danh mục thành công
 *   delete:
 *     summary: Xóa danh mục
 *     tags: [Categories]
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
 *         description: Xóa danh mục thành công
 */
router.get('/:id', categoryController.getCategoryById)
router.patch('/:id', authenticate, validate(updateCategorySchema), categoryController.updateCategory)
router.delete('/:id', authenticate, categoryController.deleteCategory)

export default router

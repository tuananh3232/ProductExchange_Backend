import { Router } from 'express'
import * as categoryController from '../../controllers/category/category.controller.js'
import { authenticate, requirePermissions } from '../../middlewares/auth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { createCategorySchema, updateCategorySchema } from '../../validations/category/category.validation.js'
import PERMISSIONS from '../../constants/permission.constant.js'

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
 *     summary: Lấy danh sách category
 *     tags: [Categories]
 *     security: []
 *     responses:
 *       200:
 *         description: Lấy danh sách thành công
 *   post:
 *     summary: Tạo category mới
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
 *         description: Tạo category thành công
 */
router.get('/', categoryController.getCategories)
router.post('/', authenticate, requirePermissions(PERMISSIONS.ADMIN_MANAGE_PRODUCTS), validate(createCategorySchema), categoryController.createCategory)

/**
 * @swagger
 * /categories/{id}:
 *   get:
 *     summary: Lấy chi tiết category
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
 *     summary: Cập nhật category
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
 *         description: Cập nhật category thành công
 *   delete:
 *     summary: Xóa category
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
 *         description: Xóa category thành công
 */
router.get('/:id', categoryController.getCategoryById)
router.patch('/:id', authenticate, requirePermissions(PERMISSIONS.ADMIN_MANAGE_PRODUCTS), validate(updateCategorySchema), categoryController.updateCategory)
router.delete('/:id', authenticate, requirePermissions(PERMISSIONS.ADMIN_MANAGE_PRODUCTS), categoryController.deleteCategory)

export default router

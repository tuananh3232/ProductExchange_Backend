import { Router } from 'express'
import * as roomSceneController from '../../controllers/room-visualizer/room-scene.controller.js'
import { authenticate, requireVip } from '../../middlewares/auth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { validateObjectId } from '../../middlewares/object-id.middleware.js'
import { uploadRoomSceneImage } from '../../middlewares/upload.middleware.js'
import {
  createSceneSchema,
  updateSceneSchema,
  calibrationSchema,
  placementsSchema,
} from '../../validations/room-visualizer/room-scene.validation.js'

const router = Router({ mergeParams: true })

/**
 * @swagger
 * /room-projects/{projectId}/scenes:
 *   get:
 *     summary: Lấy danh sách scene trong project
 *     tags: [Room Visualizer]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lấy danh sách scene thành công
 *       404:
 *         description: Project không tồn tại
 *   post:
 *     summary: Tạo scene mới trong project
 *     tags: [Room Visualizer]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
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
 *                 maxLength: 120
 *     responses:
 *       201:
 *         description: Tạo scene thành công
 *       400:
 *         description: Đã đạt giới hạn số scene
 *       404:
 *         description: Project không tồn tại
 */
router.get('/', authenticate, requireVip, validateObjectId('projectId'), roomSceneController.list)
router.post(
  '/',
  authenticate,
  requireVip,
  validateObjectId('projectId'),
  validate(createSceneSchema),
  roomSceneController.create
)

/**
 * @swagger
 * /room-projects/{projectId}/scenes/{sceneId}:
 *   get:
 *     summary: Lấy chi tiết scene
 *     tags: [Room Visualizer]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: sceneId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lấy chi tiết scene thành công
 *       404:
 *         description: Scene hoặc project không tồn tại
 *   patch:
 *     summary: Cập nhật tên scene
 *     tags: [Room Visualizer]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: sceneId
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
 *                 maxLength: 120
 *     responses:
 *       200:
 *         description: Cập nhật scene thành công
 *       404:
 *         description: Scene hoặc project không tồn tại
 *   delete:
 *     summary: Xóa scene (soft delete)
 *     tags: [Room Visualizer]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: sceneId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Xóa scene thành công
 *       404:
 *         description: Scene hoặc project không tồn tại
 *
 * /room-projects/{projectId}/scenes/{sceneId}/image:
 *   post:
 *     summary: Upload ảnh phòng cho scene (tối đa 10MB)
 *     tags: [Room Visualizer]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: sceneId
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
 *         description: Upload ảnh phòng thành công, calibration được reset
 *       404:
 *         description: Scene hoặc project không tồn tại
 *
 * /room-projects/{projectId}/scenes/{sceneId}/calibration:
 *   patch:
 *     summary: Calibrate tỷ lệ thực của scene
 *     tags: [Room Visualizer]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: sceneId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [start, end, realLengthCm]
 *             properties:
 *               start:
 *                 type: object
 *                 properties:
 *                   x: { type: number }
 *                   y: { type: number }
 *               end:
 *                 type: object
 *                 properties:
 *                   x: { type: number }
 *                   y: { type: number }
 *               realLengthCm:
 *                 type: number
 *                 minimum: 1
 *     responses:
 *       200:
 *         description: Calibration thành công
 *       400:
 *         description: Scene chưa có ảnh hoặc tọa độ ngoài bounds
 *       404:
 *         description: Scene hoặc project không tồn tại
 */
router.get(
  '/:sceneId',
  authenticate,
  requireVip,
  validateObjectId('projectId'),
  validateObjectId('sceneId'),
  roomSceneController.getOne
)
router.patch(
  '/:sceneId',
  authenticate,
  requireVip,
  validateObjectId('projectId'),
  validateObjectId('sceneId'),
  validate(updateSceneSchema),
  roomSceneController.update
)
router.delete(
  '/:sceneId',
  authenticate,
  requireVip,
  validateObjectId('projectId'),
  validateObjectId('sceneId'),
  roomSceneController.remove
)
router.post(
  '/:sceneId/image',
  authenticate,
  requireVip,
  validateObjectId('projectId'),
  validateObjectId('sceneId'),
  uploadRoomSceneImage,
  roomSceneController.uploadImage
)
router.patch(
  '/:sceneId/calibration',
  authenticate,
  requireVip,
  validateObjectId('projectId'),
  validateObjectId('sceneId'),
  validate(calibrationSchema),
  roomSceneController.calibrate
)

/**
 * @swagger
 * /room-projects/{projectId}/scenes/{sceneId}/placements:
 *   put:
 *     summary: Lưu toàn bộ placements của scene (replace)
 *     tags: [Room Visualizer]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: sceneId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [placements]
 *             properties:
 *               placements:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [product, cutoutPublicId, x, y]
 *                   properties:
 *                     product:
 *                       type: string
 *                     cutoutPublicId:
 *                       type: string
 *                     view:
 *                       type: string
 *                       enum: [front, left_angle, right_angle, back]
 *                     x:
 *                       type: number
 *                     y:
 *                       type: number
 *                     scale:
 *                       type: number
 *                     rotation:
 *                       type: number
 *                     zIndex:
 *                       type: integer
 *                     opacity:
 *                       type: number
 *                       minimum: 0
 *                       maximum: 1
 *                     locked:
 *                       type: boolean
 *     responses:
 *       200:
 *         description: Lưu placements thành công
 *       400:
 *         description: Scene chưa calibrate, vượt giới hạn, hoặc sản phẩm không hợp lệ
 *       404:
 *         description: Scene, project hoặc sản phẩm không tồn tại
 */
router.put(
  '/:sceneId/placements',
  authenticate,
  requireVip,
  validateObjectId('projectId'),
  validateObjectId('sceneId'),
  validate(placementsSchema),
  roomSceneController.savePlacements
)

/**
 * @swagger
 * /room-projects/{projectId}/scenes/{sceneId}/export:
 *   get:
 *     summary: Lấy dữ liệu export scene (placements đã populate thông tin sản phẩm)
 *     tags: [Room Visualizer]
 *     description: |
 *       Trả về toàn bộ dữ liệu scene bao gồm ảnh nền, calibration,
 *       và danh sách placement với thông tin sản phẩm đầy đủ (kích thước, cutout URL).
 *       Frontend dùng dữ liệu này để render canvas và export ảnh kết quả.
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: sceneId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lấy dữ liệu export thành công
 *       400:
 *         description: Scene chưa có ảnh
 *       404:
 *         description: Scene hoặc project không tồn tại
 */
router.get(
  '/:sceneId/export',
  authenticate,
  requireVip,
  validateObjectId('projectId'),
  validateObjectId('sceneId'),
  roomSceneController.exportScene
)

export default router

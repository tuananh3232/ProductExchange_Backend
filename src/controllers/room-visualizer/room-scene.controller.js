import * as roomSceneService from '../../services/room-visualizer/room-scene.service.js'
import { asyncHandler } from '../../utils/async-handler.util.js'
import { sendSuccess } from '../../utils/response.util.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'

export const list = asyncHandler(async (req, res) => {
  const scenes = await roomSceneService.listScenes(req.params.projectId, req.user._id)
  sendSuccess(res, { message: 'Lấy danh sách scene thành công', data: { scenes } })
})

export const create = asyncHandler(async (req, res) => {
  const scene = await roomSceneService.createScene(req.params.projectId, req.user._id, req.body)
  sendSuccess(res, { message: 'Tạo scene thành công', data: { scene }, statusCode: HTTP_STATUS.CREATED })
})

export const getOne = asyncHandler(async (req, res) => {
  const scene = await roomSceneService.getScene(req.params.projectId, req.params.sceneId, req.user._id)
  sendSuccess(res, { message: 'Lấy chi tiết scene thành công', data: { scene } })
})

export const update = asyncHandler(async (req, res) => {
  const scene = await roomSceneService.updateScene(req.params.projectId, req.params.sceneId, req.user._id, req.body)
  sendSuccess(res, { message: 'Cập nhật scene thành công', data: { scene } })
})

export const remove = asyncHandler(async (req, res) => {
  await roomSceneService.deleteScene(req.params.projectId, req.params.sceneId, req.user._id)
  sendSuccess(res, { message: 'Xóa scene thành công' })
})

export const uploadImage = asyncHandler(async (req, res) => {
  const scene = await roomSceneService.uploadSceneImage(
    req.params.projectId,
    req.params.sceneId,
    req.user._id,
    req.file.buffer
  )
  sendSuccess(res, { message: 'Upload ảnh phòng thành công', data: { scene } })
})

export const calibrate = asyncHandler(async (req, res) => {
  const scene = await roomSceneService.calibrateScene(
    req.params.projectId,
    req.params.sceneId,
    req.user._id,
    req.body
  )
  sendSuccess(res, { message: 'Calibration thành công', data: { scene } })
})

export const exportScene = asyncHandler(async (req, res) => {
  const data = await roomSceneService.exportSceneData(req.params.projectId, req.params.sceneId, req.user._id)
  sendSuccess(res, { message: 'Lấy dữ liệu export thành công', data })
})

export const savePlacements = asyncHandler(async (req, res) => {
  const scene = await roomSceneService.savePlacements(
    req.params.projectId,
    req.params.sceneId,
    req.user._id,
    req.body.placements
  )
  sendSuccess(res, { message: 'Lưu placements thành công', data: { scene } })
})

import RoomProject from '../../models/room-project.model.js'
import Product from '../../models/product.model.js'
import * as roomSceneRepo from '../../repositories/room-visualizer/room-scene.repository.js'
import { uploadBuffer, deleteImage } from '../../utils/cloudinary.util.js'
import AppError from '../../utils/app-error.util.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'

const MAX_SCENES = parseInt(process.env.ROOM_VISUALIZER_MAX_SCENES_PER_PROJECT, 10) || 10
const MAX_PLACEMENTS = parseInt(process.env.ROOM_VISUALIZER_MAX_PLACEMENTS_PER_SCENE, 10) || 50

const _verifyProject = async (projectId, userId) => {
  const project = await RoomProject.findOne({ _id: projectId, owner: userId, status: { $ne: 'archived' } })
  if (!project) {
    throw new AppError('Project không tồn tại', HTTP_STATUS.NOT_FOUND, 'PROJECT_NOT_FOUND')
  }
  return project
}

export const listScenes = async (projectId, userId) => {
  await _verifyProject(projectId, userId)
  return roomSceneRepo.findByProject(projectId, userId)
}

export const createScene = async (projectId, userId, { name }) => {
  await _verifyProject(projectId, userId)
  const count = await roomSceneRepo.countByProject(projectId)
  if (count >= MAX_SCENES) {
    throw new AppError('Đã đạt giới hạn số scene', HTTP_STATUS.BAD_REQUEST, 'SCENE_LIMIT_EXCEEDED')
  }
  return roomSceneRepo.create({ project: projectId, owner: userId, name })
}

export const getScene = async (projectId, sceneId, userId) => {
  await _verifyProject(projectId, userId)
  return roomSceneRepo.findByIdAndOwner(sceneId, userId)
}

export const updateScene = async (projectId, sceneId, userId, { name }) => {
  await _verifyProject(projectId, userId)
  await roomSceneRepo.findByIdAndOwner(sceneId, userId)
  return roomSceneRepo.updateById(sceneId, { name })
}

export const deleteScene = async (projectId, sceneId, userId) => {
  await _verifyProject(projectId, userId)
  await roomSceneRepo.findByIdAndOwner(sceneId, userId)
  return roomSceneRepo.updateById(sceneId, { isActive: false })
}

export const uploadSceneImage = async (projectId, sceneId, userId, buffer) => {
  await _verifyProject(projectId, userId)
  const scene = await roomSceneRepo.findByIdAndOwner(sceneId, userId)

  if (scene.image?.publicId) {
    await deleteImage(scene.image.publicId)
  }

  const result = await uploadBuffer(buffer, 'room-scenes')

  return roomSceneRepo.updateById(sceneId, {
    image: { url: result.url, publicId: result.publicId, widthPx: result.width, heightPx: result.height },
    calibration: { start: { x: null, y: null }, end: { x: null, y: null }, realLengthCm: null, pixelsPerCm: null, calibratedAt: null },
  })
}

export const calibrateScene = async (projectId, sceneId, userId, { start, end, realLengthCm }) => {
  await _verifyProject(projectId, userId)
  const scene = await roomSceneRepo.findByIdAndOwner(sceneId, userId)

  if (!scene.image?.url) {
    throw new AppError('Scene chưa có ảnh, không thể calibrate', HTTP_STATUS.BAD_REQUEST, 'SCENE_NO_IMAGE')
  }

  const { widthPx, heightPx } = scene.image
  if (
    start.x < 0 || start.x > widthPx || start.y < 0 || start.y > heightPx ||
    end.x < 0 || end.x > widthPx || end.y < 0 || end.y > heightPx
  ) {
    throw new AppError('Tọa độ calibration nằm ngoài bounds ảnh', HTTP_STATUS.BAD_REQUEST, 'CALIBRATION_OUT_OF_BOUNDS')
  }

  const dx = end.x - start.x
  const dy = end.y - start.y
  const pixelLength = Math.sqrt(dx * dx + dy * dy)
  const pixelsPerCm = pixelLength / realLengthCm

  return roomSceneRepo.updateById(sceneId, {
    calibration: { start, end, realLengthCm, pixelsPerCm, calibratedAt: new Date() },
  })
}

export const exportSceneData = async (projectId, sceneId, userId) => {
  await _verifyProject(projectId, userId)
  const scene = await roomSceneRepo.findByIdAndOwner(sceneId, userId)

  if (!scene.image?.url) {
    throw new AppError('Scene chưa có ảnh, không thể export', HTTP_STATUS.BAD_REQUEST, 'SCENE_NO_IMAGE')
  }

  const populatedPlacements = await Promise.all(
    (scene.placements || []).map(async (p) => {
      const product = await Product.findById(p.product).select(
        'title dimensions visualProfile.isVisualizerReady visualAssets.cutouts'
      ).lean()
      const cutout = (product?.visualAssets?.cutouts || []).find((c) => c.publicId === p.cutoutPublicId)
      return {
        ...p.toObject?.() ?? p,
        productInfo: product
          ? {
              title: product.title,
              dimensions: product.dimensions,
              isVisualizerReady: product.visualProfile?.isVisualizerReady,
              cutout: cutout ?? null,
            }
          : null,
      }
    })
  )

  return {
    sceneId: scene._id,
    name: scene.name,
    image: scene.image,
    calibration: scene.calibration,
    placements: populatedPlacements,
  }
}

export const savePlacements = async (projectId, sceneId, userId, placements) => {
  await _verifyProject(projectId, userId)
  const scene = await roomSceneRepo.findByIdAndOwner(sceneId, userId)

  if (!scene.calibration?.pixelsPerCm) {
    throw new AppError('Scene chưa được calibrate', HTTP_STATUS.BAD_REQUEST, 'SCENE_NOT_CALIBRATED')
  }

  if (placements.length > MAX_PLACEMENTS) {
    throw new AppError(
      `Vượt quá giới hạn ${MAX_PLACEMENTS} placement mỗi scene`,
      HTTP_STATUS.BAD_REQUEST,
      'PLACEMENT_LIMIT_EXCEEDED'
    )
  }

  for (const p of placements) {
    const product = await Product.findById(p.product).select('isActive visualProfile visualAssets')
    if (!product) {
      throw new AppError(`Sản phẩm ${p.product} không tồn tại`, HTTP_STATUS.NOT_FOUND, 'PRODUCT_NOT_FOUND')
    }
    if (!product.isActive) {
      throw new AppError(`Sản phẩm ${p.product} không còn hoạt động`, HTTP_STATUS.BAD_REQUEST, 'PRODUCT_INACTIVE')
    }
    if (!product.visualProfile?.isVisualizerReady) {
      throw new AppError('Sản phẩm chưa sẵn sàng cho visualizer', HTTP_STATUS.BAD_REQUEST, 'PRODUCT_NOT_VISUALIZER_READY')
    }
    const cutoutExists = (product.visualAssets?.cutouts || []).some((c) => c.publicId === p.cutoutPublicId)
    if (!cutoutExists) {
      throw new AppError(`Cutout ${p.cutoutPublicId} không thuộc sản phẩm này`, HTTP_STATUS.BAD_REQUEST, 'CUTOUT_NOT_FOUND')
    }
  }

  return roomSceneRepo.updateById(sceneId, { placements })
}

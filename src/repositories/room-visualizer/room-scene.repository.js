import RoomScene from '../../models/room-scene.model.js'
import AppError from '../../utils/app-error.util.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'

export const findByProject = (projectId, ownerId) =>
  RoomScene.find({ project: projectId, owner: ownerId, isActive: true }).sort({ createdAt: -1 }).lean()

export const findByIdAndOwner = async (sceneId, ownerId) => {
  const scene = await RoomScene.findOne({ _id: sceneId, owner: ownerId, isActive: true })
  if (!scene) {
    throw new AppError('Scene không tồn tại', HTTP_STATUS.NOT_FOUND, 'SCENE_NOT_FOUND')
  }
  return scene
}

export const create = (payload) => new RoomScene(payload).save()

export const updateById = (sceneId, updateData) =>
  RoomScene.findByIdAndUpdate(sceneId, updateData, { new: true })

export const countByProject = (projectId) =>
  RoomScene.countDocuments({ project: projectId, isActive: true })

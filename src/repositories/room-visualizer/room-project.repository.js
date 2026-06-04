import RoomProject from '../../models/room-project.model.js'
import AppError from '../../utils/app-error.util.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'

export const findByOwner = async (ownerId, { page = 1, limit = 10, status } = {}) => {
  const filter = { owner: ownerId }
  if (status) filter.status = status

  const skip = (page - 1) * limit
  const [data, total] = await Promise.all([
    RoomProject.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    RoomProject.countDocuments(filter),
  ])

  return { data, total, page, limit }
}

export const findByIdAndOwner = async (projectId, ownerId) => {
  const project = await RoomProject.findOne({ _id: projectId, owner: ownerId })
  if (!project) {
    throw new AppError('Project không tồn tại', HTTP_STATUS.NOT_FOUND, 'PROJECT_NOT_FOUND')
  }
  return project
}

export const create = (payload) => new RoomProject(payload).save()

export const updateById = (projectId, updateData) =>
  RoomProject.findByIdAndUpdate(projectId, updateData, { new: true })

export const countByOwner = (ownerId) =>
  RoomProject.countDocuments({ owner: ownerId, status: { $ne: 'archived' } })

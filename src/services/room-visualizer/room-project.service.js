import * as roomProjectRepo from '../../repositories/room-visualizer/room-project.repository.js'
import RoomProject from '../../models/room-project.model.js'
import AppError from '../../utils/app-error.util.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'

const MAX_PROJECTS = parseInt(process.env.ROOM_VISUALIZER_MAX_PROJECTS, 10) || 10

export const listProjects = (userId, query) => roomProjectRepo.findByOwner(userId, query)

export const createProject = async (userId, { name, description }) => {
  for (let quotaSlot = 0; quotaSlot < MAX_PROJECTS; quotaSlot += 1) {
    try {
      return await RoomProject.create({ owner: userId, name, description, quotaSlot, quotaActive: true })
    } catch (error) {
      if (error?.code !== 11000) throw error
    }
  }
  throw new AppError('Đã đạt giới hạn số project', HTTP_STATUS.CONFLICT, 'PROJECT_LIMIT_EXCEEDED')
}

export const getProject = (projectId, userId) => roomProjectRepo.findByIdAndOwner(projectId, userId)

export const updateProject = async (projectId, userId, payload) => {
  await roomProjectRepo.findByIdAndOwner(projectId, userId)
  return roomProjectRepo.updateById(projectId, payload)
}

export const deleteProject = async (projectId, userId) => {
  await roomProjectRepo.findByIdAndOwner(projectId, userId)
  return roomProjectRepo.updateById(projectId, { status: 'archived', quotaActive: false })
}

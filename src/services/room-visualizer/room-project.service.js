import * as roomProjectRepo from '../../repositories/room-visualizer/room-project.repository.js'
import AppError from '../../utils/app-error.util.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'

const MAX_PROJECTS = parseInt(process.env.ROOM_VISUALIZER_MAX_PROJECTS, 10) || 10

export const listProjects = (userId, query) => roomProjectRepo.findByOwner(userId, query)

export const createProject = async (userId, { name, description }) => {
  const count = await roomProjectRepo.countByOwner(userId)
  if (count >= MAX_PROJECTS) {
    throw new AppError('Đã đạt giới hạn số project', HTTP_STATUS.BAD_REQUEST, 'PROJECT_LIMIT_EXCEEDED')
  }
  return roomProjectRepo.create({ owner: userId, name, description })
}

export const getProject = (projectId, userId) => roomProjectRepo.findByIdAndOwner(projectId, userId)

export const updateProject = async (projectId, userId, payload) => {
  await roomProjectRepo.findByIdAndOwner(projectId, userId)
  return roomProjectRepo.updateById(projectId, payload)
}

export const deleteProject = async (projectId, userId) => {
  await roomProjectRepo.findByIdAndOwner(projectId, userId)
  return roomProjectRepo.updateById(projectId, { status: 'archived' })
}

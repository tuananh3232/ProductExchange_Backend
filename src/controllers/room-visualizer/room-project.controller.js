import * as roomProjectService from '../../services/room-visualizer/room-project.service.js'
import { asyncHandler } from '../../utils/async-handler.util.js'
import { sendSuccess } from '../../utils/response.util.js'
import { getPaginationParams } from '../../utils/pagination.util.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'

export const list = asyncHandler(async (req, res) => {
  const { page, limit } = getPaginationParams(req.query)
  const { status } = req.query
  const result = await roomProjectService.listProjects(req.user._id, { page, limit, status })
  sendSuccess(res, {
    message: 'Lấy danh sách project thành công',
    data: { projects: result.data },
    meta: { pagination: { total: result.total, page: result.page, limit: result.limit } },
  })
})

export const create = asyncHandler(async (req, res) => {
  const project = await roomProjectService.createProject(req.user._id, req.body)
  sendSuccess(res, {
    message: 'Tạo project thành công',
    data: { project },
    statusCode: HTTP_STATUS.CREATED,
  })
})

export const getOne = asyncHandler(async (req, res) => {
  const project = await roomProjectService.getProject(req.params.projectId, req.user._id)
  sendSuccess(res, { message: 'Lấy chi tiết project thành công', data: { project } })
})

export const update = asyncHandler(async (req, res) => {
  const project = await roomProjectService.updateProject(req.params.projectId, req.user._id, req.body)
  sendSuccess(res, { message: 'Cập nhật project thành công', data: { project } })
})

export const remove = asyncHandler(async (req, res) => {
  await roomProjectService.deleteProject(req.params.projectId, req.user._id)
  sendSuccess(res, { message: 'Xóa project thành công' })
})

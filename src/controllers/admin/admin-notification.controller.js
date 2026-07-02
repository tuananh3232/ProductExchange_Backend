import * as adminNotificationService from '../../services/admin/admin-notification.service.js'
import { asyncHandler } from '../../utils/async-handler.util.js'
import { sendSuccess } from '../../utils/response.util.js'

export const getAdminNotifications = asyncHandler(async (req, res) => {
  const { notifications, meta } = await adminNotificationService.getAdminNotifications(req.query)
  sendSuccess(res, { message: 'Lấy danh sách thông báo quản trị thành công', data: { notifications }, meta })
})

export const sendAdminNotification = asyncHandler(async (req, res) => {
  const result = await adminNotificationService.sendAdminNotification(req.body, req.user)
  sendSuccess(res, { message: 'Gửi thông báo quản trị thành công', data: result })
})

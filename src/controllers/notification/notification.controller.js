import * as notificationService from '../../services/notification/notification.service.js'
import { asyncHandler } from '../../utils/async-handler.util.js'
import { sendSuccess } from '../../utils/response.util.js'

export const getMyNotifications = asyncHandler(async (req, res) => {
  const { notifications, pagination, unreadCount } = await notificationService.getMyNotifications(req.user._id, req.query)
  sendSuccess(res, {
    message: 'Lấy danh sách thông báo thành công',
    data: { notifications, unreadCount },
    meta: { pagination },
  })
})

export const getUnreadCount = asyncHandler(async (req, res) => {
  const unreadCount = await notificationService.getUnreadCount(req.user._id)
  sendSuccess(res, { message: 'Lấy số thông báo chưa đọc thành công', data: { unreadCount } })
})

export const markNotificationAsRead = asyncHandler(async (req, res) => {
  const notification = await notificationService.markNotificationAsRead(req.user._id, req.params.id)
  sendSuccess(res, { message: 'Đánh dấu thông báo đã đọc thành công', data: { notification } })
})

export const markAllNotificationsAsRead = asyncHandler(async (req, res) => {
  const result = await notificationService.markAllNotificationsAsRead(req.user._id)
  sendSuccess(res, { message: 'Đánh dấu tất cả thông báo đã đọc thành công', data: result })
})

export const deleteNotification = asyncHandler(async (req, res) => {
  await notificationService.deleteNotification(req.user._id, req.params.id)
  sendSuccess(res, { message: 'Xóa thông báo thành công' })
})


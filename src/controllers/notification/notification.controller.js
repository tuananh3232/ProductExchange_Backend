import * as notificationService from '../../services/notification/notification.service.js'
import { asyncHandler } from '../../utils/async-handler.util.js'
import { sendSuccess } from '../../utils/response.util.js'

export const getMyNotifications = asyncHandler(async (req, res) => {
  const { notifications, pagination, unreadCount } = await notificationService.getMyNotifications(req.user._id, req.query)
  sendSuccess(res, {
    message: 'Lay danh sach thong bao thanh cong',
    data: { notifications, unreadCount },
    meta: { pagination },
  })
})

export const getUnreadCount = asyncHandler(async (req, res) => {
  const unreadCount = await notificationService.getUnreadCount(req.user._id)
  sendSuccess(res, { message: 'Lay so thong bao chua doc thanh cong', data: { unreadCount } })
})

export const markNotificationAsRead = asyncHandler(async (req, res) => {
  const notification = await notificationService.markNotificationAsRead(req.user._id, req.params.id)
  sendSuccess(res, { message: 'Danh dau thong bao da doc thanh cong', data: { notification } })
})

export const markAllNotificationsAsRead = asyncHandler(async (req, res) => {
  const result = await notificationService.markAllNotificationsAsRead(req.user._id)
  sendSuccess(res, { message: 'Danh dau tat ca thong bao da doc thanh cong', data: result })
})

export const deleteNotification = asyncHandler(async (req, res) => {
  await notificationService.deleteNotification(req.user._id, req.params.id)
  sendSuccess(res, { message: 'Xoa thong bao thanh cong' })
})


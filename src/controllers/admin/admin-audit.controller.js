import * as adminAuditService from '../../services/admin/admin-audit.service.js'
import { asyncHandler } from '../../utils/async-handler.util.js'
import { sendSuccess } from '../../utils/response.util.js'

export const getAuditLogs = asyncHandler(async (req, res) => {
  const { auditLogs, meta } = await adminAuditService.getAuditLogs(req.query)
  sendSuccess(res, { message: 'Lấy nhật ký kiểm tra thành công', data: { logs: auditLogs }, meta })
})

export const getUserActivity = asyncHandler(async (req, res) => {
  const { auditLogs, meta } = await adminAuditService.getUserActivity(req.params.userId, req.query)
  sendSuccess(res, { message: 'Lấy lịch sử hoạt động của người dùng thành công', data: { activities: auditLogs }, meta })
})

export const getShopReviewHistory = asyncHandler(async (req, res) => {
  const { auditLogs, meta } = await adminAuditService.getTargetHistory({
    targetType: 'shop',
    targetId: req.params.id,
    query: req.query,
  })
  sendSuccess(res, { message: 'Lấy lịch sử xét duyệt cửa hàng thành công', data: { history: auditLogs }, meta })
})

export const getProductModerationHistory = asyncHandler(async (req, res) => {
  const { auditLogs, meta } = await adminAuditService.getTargetHistory({
    targetType: 'product',
    targetId: req.params.productId,
    query: req.query,
  })
  sendSuccess(res, { message: 'Lấy lịch sử kiểm duyệt sản phẩm thành công', data: { history: auditLogs }, meta })
})

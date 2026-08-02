import * as adminReportService from '../../services/admin/admin-report.service.js'
import { asyncHandler } from '../../utils/async-handler.util.js'
import { sendSuccess } from '../../utils/response.util.js'

export const previewReport = asyncHandler(async (req, res) => {
  const result = await adminReportService.previewAdminReport(req.query)
  return sendSuccess(res, {
    message: 'Xem trước báo cáo thành công',
    data: { columns: result.columns, rows: result.rows },
    meta: result.meta,
  })
})

export const exportReport = asyncHandler(async (req, res) => {
  const result = await adminReportService.exportAdminReport(req.query)
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`)
  res.setHeader('X-Export-Row-Count', String(result.rowCount))
  res.setHeader('X-Export-Max-Rows', String(result.maxRows))
  return res.status(200).send(result.content)
})

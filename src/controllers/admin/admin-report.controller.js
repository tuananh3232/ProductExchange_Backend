import * as adminReportService from '../../services/admin/admin-report.service.js'
import { asyncHandler } from '../../utils/async-handler.util.js'

export const exportReport = asyncHandler(async (req, res) => {
  const result = await adminReportService.exportAdminReport(req.query)
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`)
  res.setHeader('X-Export-Row-Count', String(result.rowCount))
  res.setHeader('X-Export-Max-Rows', String(result.maxRows))
  return res.status(200).send(result.content)
})

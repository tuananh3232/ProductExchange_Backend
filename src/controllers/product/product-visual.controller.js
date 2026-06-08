import * as productVisualService from '../../services/visual-assets/product-visual.service.js'
import { asyncHandler } from '../../utils/async-handler.util.js'
import AppError from '../../utils/app-error.util.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'

export const uploadSource = asyncHandler(async (req, res) => {
  const product = await productVisualService.uploadSourceImage(req.params.id, req.file.buffer, req.user)
  res.status(200).json({ success: true, product })
})


export const deleteCutout = asyncHandler(async (req, res) => {
  const { publicId } = req.query
  if (!publicId) throw new AppError('publicId là bắt buộc', HTTP_STATUS.BAD_REQUEST, 'MISSING_PUBLIC_ID')
  const product = await productVisualService.deleteCutout(req.params.id, publicId, req.user)
  res.status(200).json({ success: true, product })
})

export const previewCutout = asyncHandler(async (req, res) => {
  const { provider } = req.body
  if (!req.file) throw new AppError('File ảnh là bắt buộc', HTTP_STATUS.BAD_REQUEST, 'FILE_REQUIRED')
  const preview = await productVisualService.previewCutout(req.params.id, req.file.buffer, { provider }, req.user)
  res.status(200).json({ success: true, ...preview })
})

export const confirmCutout = asyncHandler(async (req, res) => {
  const product = await productVisualService.confirmCutout(req.params.id, req.body, req.user)
  res.status(200).json({ success: true, product })
})

export const updateVisualProfile = asyncHandler(async (req, res) => {
  const product = await productVisualService.updateVisualProfile(req.params.id, req.body, req.user)
  res.status(200).json({ success: true, product })
})

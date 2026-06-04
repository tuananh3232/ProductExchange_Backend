import * as productVisualService from '../../services/visual-assets/product-visual.service.js'
import { asyncHandler } from '../../utils/async-handler.util.js'
import AppError from '../../utils/app-error.util.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'

export const uploadSource = asyncHandler(async (req, res) => {
  const product = await productVisualService.uploadSourceImage(req.params.id, req.file.buffer, req.user)
  res.status(200).json({ success: true, product })
})

export const uploadCutout = asyncHandler(async (req, res) => {
  const { view, provider } = req.body
  if (provider && provider !== 'manual' && !req.file) {
    throw new AppError('File ảnh là bắt buộc khi dùng provider xử lý tự động', HTTP_STATUS.BAD_REQUEST, 'FILE_REQUIRED')
  }
  const product = await productVisualService.uploadCutout(
    req.params.id,
    req.file?.buffer,
    { view, provider },
    req.user
  )
  res.status(200).json({ success: true, product })
})

export const deleteCutout = asyncHandler(async (req, res) => {
  const { publicId } = req.query
  if (!publicId) throw new AppError('publicId là bắt buộc', HTTP_STATUS.BAD_REQUEST, 'MISSING_PUBLIC_ID')
  const product = await productVisualService.deleteCutout(req.params.id, publicId, req.user)
  res.status(200).json({ success: true, product })
})

export const updateVisualProfile = asyncHandler(async (req, res) => {
  const product = await productVisualService.updateVisualProfile(req.params.id, req.body, req.user)
  res.status(200).json({ success: true, product })
})

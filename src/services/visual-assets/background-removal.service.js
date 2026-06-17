import AppError from '../../utils/app-error.util.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'

const DEFAULT_PROVIDER = process.env.BACKGROUND_REMOVAL_PROVIDER || 'manual'

/**
 * Remove background from an image buffer.
 * @param {{ buffer: Buffer, provider?: string }} opts
 * @returns {Promise<{ buffer: Buffer, mimeType: string }>}
 */
export const removeBackground = async ({ buffer, provider = DEFAULT_PROVIDER }) => {
  switch (provider) {
    case 'manual':
      return { buffer, mimeType: 'image/png' }

    case 'remove_bg':
      return _removeWithRemoveBg(buffer)

    case 'clipdrop':
    default:
      throw new AppError(
        `Provider "${provider}" không được hỗ trợ`,
        HTTP_STATUS.BAD_REQUEST,
        'UNSUPPORTED_BG_REMOVAL_PROVIDER'
      )
  }
}

const _removeWithRemoveBg = async (buffer) => {
  const apiKey = process.env.REMOVE_BG_API_KEY
  if (!apiKey) {
    throw new AppError('REMOVE_BG_API_KEY chưa được cấu hình', HTTP_STATUS.SERVICE_UNAVAILABLE, 'PROVIDER_NOT_CONFIGURED')
  }

  const FormData = (await import('form-data')).default
  const form = new FormData()
  form.append('image_file', buffer, { filename: 'source.jpg', contentType: 'image/jpeg' })
  form.append('size', 'auto')

  const fetch = (await import('node-fetch')).default
  const response = await fetch('https://api.remove.bg/v1.0/removebg', {
    method: 'POST',
    headers: { 'X-Api-Key': apiKey, ...form.getHeaders() },
    body: form,
  })

  if (!response.ok) {
    let friendlyMessage = 'Không thể tách nền ảnh này. Vui lòng kiểm tra lại chất lượng ảnh.'
    let errorCode = 'BG_REMOVAL_FAILED'
    let statusCode = HTTP_STATUS.BAD_GATEWAY

    try {
      const errText = await response.text()
      const errJson = JSON.parse(errText)
      const primaryError = errJson.errors?.[0]

      if (primaryError) {
        const removeBgCode = primaryError.code

        const errorMapping = {
          roi_region_empty: 'Ảnh tải lên không chứa chủ thể (vật thể) rõ ràng hoặc bị trống. Vui lòng chọn ảnh khác.',
          image_missing_or_invalid: 'Định dạng ảnh tải lên không hợp lệ hoặc không được hỗ trợ.',
          insufficient_credits: 'Dịch vụ tách nền tự động đang tạm thời hết lượt sử dụng. Vui lòng thử lại sau.',
          api_key_invalid: 'Lỗi cấu hình hệ thống tách nền (API Key không hợp lệ).',
          rate_limit_exceeded: 'Hệ thống đang bận do có quá nhiều yêu cầu. Vui lòng thử lại sau vài giây.'
        }

        if (errorMapping[removeBgCode]) {
          friendlyMessage = errorMapping[removeBgCode]
        } else if (primaryError.title) {
          friendlyMessage = `Lỗi từ dịch vụ tách nền: ${primaryError.title}`
        }

        errorCode = removeBgCode ? `BG_REMOVAL_${removeBgCode.toUpperCase()}` : 'BG_REMOVAL_FAILED'

        if (removeBgCode === 'roi_region_empty' || removeBgCode === 'image_missing_or_invalid') {
          statusCode = HTTP_STATUS.BAD_REQUEST
        } else if (removeBgCode === 'insufficient_credits' || removeBgCode === 'api_key_invalid') {
          statusCode = HTTP_STATUS.SERVICE_UNAVAILABLE
        }
      }
    } catch {
      // Bỏ qua nếu response không phải là JSON
    }

    throw new AppError(friendlyMessage, statusCode, errorCode)
  }

  const resultBuffer = Buffer.from(await response.arrayBuffer())
  return { buffer: resultBuffer, mimeType: 'image/png' }
}

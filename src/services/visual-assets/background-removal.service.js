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
    const errText = await response.text()
    throw new AppError(
      `remove.bg lỗi: ${errText}`,
      HTTP_STATUS.BAD_GATEWAY,
      'BG_REMOVAL_FAILED'
    )
  }

  const resultBuffer = Buffer.from(await response.arrayBuffer())
  return { buffer: resultBuffer, mimeType: 'image/png' }
}

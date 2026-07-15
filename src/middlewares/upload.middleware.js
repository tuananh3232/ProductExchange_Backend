import multer from 'multer'
import AppError from '../utils/app-error.util.js'
import HTTP_STATUS from '../constants/http-status.constant.js'
import sharp from 'sharp'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

const imageFilter = (_req, file, cb) => {
  if (!file.mimetype.startsWith('image/')) {
    return cb(new AppError('Chỉ chấp nhận file ảnh', HTTP_STATUS.BAD_REQUEST, 'INVALID_FILE_TYPE'), false)
  }
  cb(null, true)
}

const storage = multer.memoryStorage()

const sanitizeImages = async (req, _res, next) => {
  try {
    const files = req.file ? [req.file] : req.files
      ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat())
      : []
    for (const file of files) {
      const image = sharp(file.buffer, { failOn: 'warning', limitInputPixels: 25_000_000 })
      const metadata = await image.metadata()
      if (!['jpeg', 'png', 'webp'].includes(metadata.format)) {
        throw new AppError('Định dạng ảnh không được hỗ trợ', HTTP_STATUS.BAD_REQUEST, 'INVALID_IMAGE_CONTENT')
      }
      const sanitized = metadata.hasAlpha
        ? await image.rotate().png({ compressionLevel: 9 }).toBuffer()
        : await image.rotate().jpeg({ quality: 90, mozjpeg: true }).toBuffer()
      file.buffer = sanitized
      file.size = sanitized.length
      file.mimetype = metadata.hasAlpha ? 'image/png' : 'image/jpeg'
    }
    next()
  } catch (error) {
    next(error instanceof AppError
      ? error
      : new AppError('Nội dung ảnh không hợp lệ', HTTP_STATUS.BAD_REQUEST, 'INVALID_IMAGE_CONTENT'))
  }
}

const base = multer({ storage, limits: { fileSize: MAX_FILE_SIZE }, fileFilter: imageFilter })

export const uploadKycImages = [base.fields([
  { name: 'frontImage', maxCount: 1 },
  { name: 'backImage', maxCount: 1 },
]), sanitizeImages]

export const uploadAvatarImage = [base.single('avatar'), sanitizeImages]

export const uploadProductImages = [base.array('images', 10), sanitizeImages]

export const uploadProductVisualImage = [base.single('image'), sanitizeImages]

export const uploadReviewImages = [base.array('images', 6), sanitizeImages]

const roomSceneBase = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: imageFilter })
export const uploadRoomSceneImage = [roomSceneBase.single('image'), sanitizeImages]

export const parseJsonFields = (fields) => (req, _res, next) => {
  for (const field of fields) {
    if (req.body[field] && typeof req.body[field] === 'string') {
      try {
        req.body[field] = JSON.parse(req.body[field])
      } catch {
        // để Joi validation bắt lỗi
      }
    }
  }
  next()
}

import multer from 'multer'
import AppError from '../utils/app-error.util.js'
import HTTP_STATUS from '../constants/http-status.constant.js'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

const imageFilter = (_req, file, cb) => {
  if (!file.mimetype.startsWith('image/')) {
    return cb(new AppError('Chỉ chấp nhận file ảnh', HTTP_STATUS.BAD_REQUEST, 'INVALID_FILE_TYPE'), false)
  }
  cb(null, true)
}

const storage = multer.memoryStorage()

const base = multer({ storage, limits: { fileSize: MAX_FILE_SIZE }, fileFilter: imageFilter })

export const uploadKycImages = base.fields([
  { name: 'frontImage', maxCount: 1 },
  { name: 'backImage', maxCount: 1 },
])

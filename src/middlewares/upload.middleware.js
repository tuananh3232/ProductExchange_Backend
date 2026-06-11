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

export const uploadAvatarImage = base.single('avatar')

export const uploadProductImages = base.array('images', 10)

export const uploadProductVisualImage = base.single('image')

const roomSceneBase = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: imageFilter })
export const uploadRoomSceneImage = roomSceneBase.single('image')

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

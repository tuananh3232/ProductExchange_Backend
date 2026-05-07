import { Router } from 'express'
import * as userController from '../../controllers/user/user.controller.js'
import { authenticate, requirePermissions } from '../../middlewares/auth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { uploadKycImages } from '../../middlewares/upload.middleware.js'
import PERMISSIONS from '../../constants/permission.constant.js'
import {
  changePasswordSchema,
  updateProfileSchema,
} from '../../validations/auth/auth.validation.js'

const router = Router()

/**
 * User endpoints (moved from /auth to /users)
 */
router.get('/me', authenticate, requirePermissions(PERMISSIONS.USER_READ), userController.getMe)

router.put(
  '/profile',
  authenticate,
  requirePermissions(PERMISSIONS.USER_UPDATE),
  validate(updateProfileSchema),
  userController.updateProfile
)

router.post(
  '/change-password',
  authenticate,
  requirePermissions(PERMISSIONS.USER_UPDATE),
  validate(changePasswordSchema),
  userController.changePassword
)

router.post(
  '/kyc',
  authenticate,
  requirePermissions(PERMISSIONS.USER_UPDATE),
  uploadKycImages,
  userController.submitKyc
)

router.get('/kyc', authenticate, requirePermissions(PERMISSIONS.USER_READ), userController.getMyKyc)

export default router

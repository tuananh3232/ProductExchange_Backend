import * as authController from '../../controllers/auth/auth.controller.js'

export const getMe = authController.getMe
export const updateProfile = authController.updateProfile
export const changePassword = authController.changePassword
export const submitKyc = authController.submitKyc
export const getMyKyc = authController.getMyKyc

export default {
  getMe,
  updateProfile,
  changePassword,
  submitKyc,
  getMyKyc,
}

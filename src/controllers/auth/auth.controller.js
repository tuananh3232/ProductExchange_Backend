import * as authService from '../../services/auth/auth.service.js'
import { sendSuccess } from '../../utils/response.util.js'
import MESSAGES from '../../constants/message.constant.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'

export const register = async (req, res, next) => {
  try {
    const user = await authService.register(req.body)
    sendSuccess(res, {
      message: MESSAGES.AUTH.REGISTER_SUCCESS,
      data: { user },
      statusCode: HTTP_STATUS.CREATED,
    })
  } catch (error) {
    next(error)
  }
}

export const login = async (req, res, next) => {
  try {
    const result = await authService.login(req.body)
    sendSuccess(res, { message: MESSAGES.AUTH.LOGIN_SUCCESS, data: result })
  } catch (error) {
    next(error)
  }
}

export const googleLogin = async (req, res, next) => {
  try {
    const result = await authService.loginWithGoogle(req.body)
    sendSuccess(res, { message: MESSAGES.AUTH.GOOGLE_LOGIN_SUCCESS, data: result })
  } catch (error) {
    next(error)
  }
}

export const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body
    const result = await authService.refreshToken(refreshToken)
    sendSuccess(res, { message: MESSAGES.AUTH.REFRESH_TOKEN_SUCCESS, data: result })
  } catch (error) {
    next(error)
  }
}

export const logout = async (req, res, next) => {
  try {
    await authService.logout(req.user._id)
    sendSuccess(res, { message: MESSAGES.AUTH.LOGOUT_SUCCESS })
  } catch (error) {
    next(error)
  }
}

export const getMe = async (req, res, next) => {
  try {
    const user = await authService.getProfile(req.user._id)
    sendSuccess(res, { message: MESSAGES.AUTH.PROFILE_FETCHED, data: { user } })
  } catch (error) {
    next(error)
  }
}

export const updateProfile = async (req, res, next) => {
  try {
    const user = await authService.updateProfile(req.user._id, req.body)
    sendSuccess(res, { message: MESSAGES.AUTH.PROFILE_UPDATED, data: { user } })
  } catch (error) {
    next(error)
  }
}

export const changePassword = async (req, res, next) => {
  try {
    await authService.changePassword(req.user._id, req.body)
    sendSuccess(res, { message: MESSAGES.AUTH.PASSWORD_CHANGED })
  } catch (error) {
    next(error)
  }
}

export const banUser = async (req, res, next) => {
  try {
    const user = await authService.banUser(req.params.userId)
    sendSuccess(res, { message: MESSAGES.USER.BANNED, data: { user } })
  } catch (error) {
    next(error)
  }
}

export const unbanUser = async (req, res, next) => {
  try {
    const user = await authService.unbanUser(req.params.userId)
    sendSuccess(res, { message: MESSAGES.USER.UNBANNED, data: { user } })
  } catch (error) {
    next(error)
  }
}

export const forgotPassword = async (req, res, next) => {
  try {
    const result = await authService.forgotPassword(req.body)
    const data = result.debugToken ? { debugToken: result.debugToken } : null
    sendSuccess(res, { message: MESSAGES.AUTH.FORGOT_PASSWORD_SENT, data })
  } catch (error) {
    next(error)
  }
}

export const resetPassword = async (req, res, next) => {
  try {
    await authService.resetPassword(req.body)
    sendSuccess(res, { message: MESSAGES.AUTH.PASSWORD_RESET_SUCCESS })
  } catch (error) {
    next(error)
  }
}

export const sendVerificationEmail = async (req, res, next) => {
  try {
    const result = await authService.sendVerificationEmail(req.body)

    if (result.alreadyVerified) {
      return sendSuccess(res, { message: MESSAGES.AUTH.EMAIL_ALREADY_VERIFIED })
    }

    const data = result.debugToken ? { debugToken: result.debugToken } : null
    return sendSuccess(res, { message: MESSAGES.AUTH.VERIFICATION_EMAIL_SENT, data })
  } catch (error) {
    next(error)
  }
}

export const verifyEmail = async (req, res, next) => {
  try {
    const user = await authService.verifyEmail(req.body)
    sendSuccess(res, { message: MESSAGES.AUTH.EMAIL_VERIFIED, data: { user } })
  } catch (error) {
    next(error)
  }
}

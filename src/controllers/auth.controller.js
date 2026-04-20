import * as authService from '../services/auth.service.js';
import { sendSuccess } from '../utils/response.util.js';
import MESSAGES from '../constants/message.constant.js';
import HTTP_STATUS from '../constants/http-status.constant.js';

export const register = async (req, res, next) => {
  try {
    const user = await authService.register(req.body);
    sendSuccess(res, {
      message: MESSAGES.AUTH.REGISTER_SUCCESS,
      data: { user },
      statusCode: HTTP_STATUS.CREATED,
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    sendSuccess(res, { message: MESSAGES.AUTH.LOGIN_SUCCESS, data: result });
  } catch (error) {
    next(error);
  }
};

export const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const result = await authService.refreshToken(refreshToken);
    sendSuccess(res, { message: MESSAGES.AUTH.REFRESH_TOKEN_SUCCESS, data: result });
  } catch (error) {
    next(error);
  }
};

export const logout = async (req, res, next) => {
  try {
    await authService.logout(req.user._id);
    sendSuccess(res, { message: MESSAGES.AUTH.LOGOUT_SUCCESS });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req, res, next) => {
  try {
    sendSuccess(res, { message: MESSAGES.AUTH.PROFILE_FETCHED, data: { user: req.user } });
  } catch (error) {
    next(error);
  }
};

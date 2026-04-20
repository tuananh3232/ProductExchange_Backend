import * as userRepo from '../repositories/user.repository.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../providers/jwt.provider.js';
import AppError from '../utils/app-error.util.js';
import ERRORS from '../constants/error.constant.js';
import HTTP_STATUS from '../constants/http-status.constant.js';

export const register = async ({ name, email, password }) => {
  const existingUser = await userRepo.findByEmail(email);
  if (existingUser) {
    throw new AppError('Email đã được sử dụng', HTTP_STATUS.CONFLICT, ERRORS.AUTH.EMAIL_ALREADY_EXISTS);
  }

  const user = await userRepo.create({ name, email, password });
  return user.toPublicJSON();
};

export const login = async ({ email, password }) => {
  const user = await userRepo.findByEmail(email); // select +password
  if (!user || !(await user.comparePassword(password))) {
    throw new AppError('Email hoặc mật khẩu không đúng', HTTP_STATUS.UNAUTHORIZED, ERRORS.AUTH.INVALID_CREDENTIALS);
  }

  if (!user.isActive) {
    throw new AppError('Tài khoản đã bị khóa', HTTP_STATUS.FORBIDDEN, ERRORS.AUTH.ACCOUNT_INACTIVE);
  }

  const payload = { userId: user._id.toString(), role: user.role };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  await userRepo.saveRefreshToken(user._id, refreshToken);

  return {
    user: user.toPublicJSON(),
    accessToken,
    refreshToken,
  };
};

export const refreshToken = async (token) => {
  let decoded;
  try {
    decoded = verifyRefreshToken(token);
  } catch {
    throw new AppError('Phiên làm việc không hợp lệ', HTTP_STATUS.UNAUTHORIZED, ERRORS.AUTH.REFRESH_TOKEN_INVALID);
  }

  const user = await userRepo.findByIdWithRefreshToken(decoded.userId);
  if (!user || user.refreshToken !== token) {
    throw new AppError('Phiên làm việc không hợp lệ', HTTP_STATUS.UNAUTHORIZED, ERRORS.AUTH.REFRESH_TOKEN_INVALID);
  }

  const payload = { userId: user._id.toString(), role: user.role };
  const newAccessToken = generateAccessToken(payload);
  const newRefreshToken = generateRefreshToken(payload);
  await userRepo.saveRefreshToken(user._id, newRefreshToken);

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
};

export const logout = async (userId) => {
  await userRepo.clearRefreshToken(userId);
};

export const changePassword = async (userId, { currentPassword, newPassword }) => {
  const user = await userRepo.findByEmail((await userRepo.findById(userId)).email);
  if (!(await user.comparePassword(currentPassword))) {
    throw new AppError('Mật khẩu hiện tại không đúng', HTTP_STATUS.BAD_REQUEST, ERRORS.AUTH.WRONG_PASSWORD);
  }
  user.password = newPassword;
  await user.save(); // Kích hoạt pre-save hook hash password
};

/**
 * Trả về response thành công
 * message: tiếng Việt
 * data: dữ liệu trả về
 */
export const sendSuccess = (res, { message, data = null, statusCode = 200, meta = null }) => {
  const response = { success: true, message };
  if (data !== null) response.data = data;
  if (meta !== null) response.meta = meta; // Thông tin phân trang
  return res.status(statusCode).json(response);
};

/**
 * Trả về response lỗi
 * message: tiếng Việt (thân thiện với người dùng)
 * error: tiếng Anh (cho developer/log)
 */
export const sendError = (res, { message, error, statusCode = 500, details = null }) => {
  const response = { success: false, message, error };
  if (details) response.details = details; // Lỗi validation chi tiết
  return res.status(statusCode).json(response);
};

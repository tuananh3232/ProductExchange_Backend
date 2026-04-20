class AppError extends Error {
  constructor(message, statusCode, errorCode = null) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = true; // Phân biệt lỗi có kiểm soát vs lỗi hệ thống
    Error.captureStackTrace(this, this.constructor);
  }
}

export default AppError;

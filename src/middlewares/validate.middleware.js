import HTTP_STATUS from '../constants/http-status.constant.js';

/**
 * Middleware validate Joi schema
 * Trả về lỗi tiếng Anh trong details, thông báo tiếng Việt ở message
 */
export const validate = (schema, source = 'body', statusCode = HTTP_STATUS.UNPROCESSABLE_ENTITY) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false, // Lấy tất cả lỗi cùng lúc
      stripUnknown: true, // Bỏ trường không khai báo trong schema
    });

    if (error) {
      const details = error.details.map((d) => ({
        field: d.path.join('.'),
        message: d.message,
      }));

      return res.status(statusCode).json({
        success: false,
        message: 'Dữ liệu đầu vào không hợp lệ',
        error: 'Validation failed',
        details,
      });
    }

    req[source] = value; // Gán lại giá trị đã được làm sạch
    next();
  };
};

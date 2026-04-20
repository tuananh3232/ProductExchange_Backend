export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500
}

export const RESPONSE_MESSAGE = {
  SUCCESS: 'Thành công',
  CREATED: 'Tạo mới thành công',
  UPDATED: 'Cập nhật thành công',
  DELETED: 'Xóa thành công',
  NOT_FOUND: 'Không tìm thấy tài nguyên',
  BAD_REQUEST: 'Yêu cầu không hợp lệ',
  UNAUTHORIZED: 'Chưa xác thực, vui lòng đăng nhập',
  FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này',
  INTERNAL_SERVER_ERROR: 'Lỗi hệ thống, vui lòng thử lại sau'
}

/**
 * @swagger
 * /admin/users/{userId}:
 *   get:
 *     tags: [Admin Users]
 *     summary: Lấy chi tiết người dùng dành cho quản trị viên
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Thông tin chi tiết người dùng, bao gồm vai trò, KYC, cửa hàng, ví và thống kê đơn hàng }
 *       400: { description: ObjectId không hợp lệ }
 *       401: { description: Chưa đăng nhập hoặc phiên đăng nhập không hợp lệ }
 *       403: { description: Không có quyền thực hiện thao tác này }
 *       404: { description: Không tìm thấy người dùng }
 * /admin/users/{userId}/status:
 *   patch:
 *     tags: [Admin Users]
 *     summary: Cập nhật trạng thái hoạt động của người dùng
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [isActive, reason]
 *             properties:
 *               isActive: { type: boolean, example: false }
 *               reason: { type: string, example: Vi phạm chính sách }
 *               adminNote: { type: string, example: Đã được quản trị viên xem xét }
 *     responses:
 *       200: { description: Đã cập nhật trạng thái người dùng }
 *       400: { description: Yêu cầu không hợp lệ hoặc quản trị viên đang tự khóa tài khoản của chính mình }
 *       401: { description: Chưa đăng nhập hoặc phiên đăng nhập không hợp lệ }
 *       403: { description: Không có quyền thực hiện thao tác này }
 *       404: { description: Không tìm thấy người dùng }
 */

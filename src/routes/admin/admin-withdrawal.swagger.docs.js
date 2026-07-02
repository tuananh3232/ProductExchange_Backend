/**
 * @swagger
 * /admin/shop-withdrawals:
 *   get:
 *     tags: [Admin Withdrawals]
 *     summary: Lấy danh sách yêu cầu rút tiền của cửa hàng
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Danh sách yêu cầu rút tiền đã được ẩn bớt dữ liệu nhạy cảm }
 *       400: { description: Tham số truy vấn không hợp lệ }
 *       401: { description: Chưa đăng nhập hoặc phiên đăng nhập không hợp lệ }
 *       403: { description: Không có quyền thực hiện thao tác này }
 * /admin/shop-withdrawals/{withdrawalId}:
 *   get:
 *     tags: [Admin Withdrawals]
 *     summary: Lấy chi tiết yêu cầu rút tiền của cửa hàng
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: withdrawalId, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Thông tin chi tiết yêu cầu rút tiền }
 *       400: { description: ObjectId không hợp lệ }
 *       401: { description: Chưa đăng nhập hoặc phiên đăng nhập không hợp lệ }
 *       403: { description: Không có quyền thực hiện thao tác này }
 *       404: { description: Không tìm thấy yêu cầu rút tiền }
 * /admin/user-withdrawals/{withdrawalId}:
 *   get:
 *     tags: [Admin Withdrawals]
 *     summary: Lấy chi tiết yêu cầu rút tiền của người dùng
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: withdrawalId, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Thông tin chi tiết yêu cầu rút tiền của người dùng }
 *       400: { description: ObjectId không hợp lệ }
 *       401: { description: Chưa đăng nhập hoặc phiên đăng nhập không hợp lệ }
 *       403: { description: Không có quyền thực hiện thao tác này }
 *       404: { description: Không tìm thấy yêu cầu rút tiền }
 */

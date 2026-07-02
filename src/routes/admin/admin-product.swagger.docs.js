/**
 * @swagger
 * /admin/products/{productId}:
 *   get:
 *     tags: [Admin Products]
 *     summary: Lấy chi tiết sản phẩm dành cho quản trị viên, bao gồm cả sản phẩm không hoạt động
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Thông tin chi tiết sản phẩm }
 *       400: { description: ObjectId không hợp lệ }
 *       401: { description: Chưa đăng nhập hoặc phiên đăng nhập không hợp lệ }
 *       403: { description: Không có quyền thực hiện thao tác này }
 *       404: { description: Không tìm thấy sản phẩm }
 * /admin/products/{productId}/status:
 *   patch:
 *     tags: [Admin Products]
 *     summary: Cập nhật trạng thái kiểm duyệt sản phẩm
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status, reason]
 *             properties:
 *               status: { type: string, enum: [available, pending, sold, hidden, active, inactive], example: hidden }
 *               reason: { type: string, example: Nội dung không phù hợp }
 *               adminNote: { type: string, example: Ẩn sản phẩm để xem xét }
 *     responses:
 *       200: { description: Đã cập nhật trạng thái sản phẩm }
 *       400: { description: Chuyển trạng thái không hợp lệ hoặc dữ liệu không hợp lệ }
 *       401: { description: Chưa đăng nhập hoặc phiên đăng nhập không hợp lệ }
 *       403: { description: Không có quyền thực hiện thao tác này }
 *       404: { description: Không tìm thấy sản phẩm }
 * /admin/products/{productId}/hide:
 *   patch:
 *     tags: [Admin Products]
 *     summary: Ẩn mềm một sản phẩm
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Đã ẩn sản phẩm }
 *       400: { description: ObjectId không hợp lệ }
 *       401: { description: Chưa đăng nhập hoặc phiên đăng nhập không hợp lệ }
 *       403: { description: Không có quyền thực hiện thao tác này }
 *       404: { description: Không tìm thấy sản phẩm }
 * /admin/products/{productId}/restore:
 *   patch:
 *     tags: [Admin Products]
 *     summary: Khôi phục một sản phẩm đã bị ẩn mềm
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Đã khôi phục sản phẩm }
 *       400: { description: ObjectId không hợp lệ }
 *       401: { description: Chưa đăng nhập hoặc phiên đăng nhập không hợp lệ }
 *       403: { description: Không có quyền thực hiện thao tác này }
 *       404: { description: Không tìm thấy sản phẩm }
 */

/**
 * @swagger
 * /admin/payments:
 *   get:
 *     tags: [Admin Payments]
 *     summary: Lấy danh sách thanh toán dành cho quản trị viên
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, minimum: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 100 } }
 *       - { in: query, name: paymentCode, schema: { type: string } }
 *       - { in: query, name: orderId, schema: { type: string } }
 *       - { in: query, name: userId, schema: { type: string } }
 *       - { in: query, name: provider, schema: { type: string } }
 *       - { in: query, name: paymentMethod, schema: { type: string } }
 *       - { in: query, name: status, schema: { type: string } }
 *     responses:
 *       200: { description: Danh sách thanh toán không bao gồm payload callback thô }
 *       400: { description: Tham số truy vấn không hợp lệ }
 *       401: { description: Chưa đăng nhập hoặc phiên đăng nhập không hợp lệ }
 *       403: { description: Không có quyền thực hiện thao tác này }
 * /admin/payments/{paymentId}:
 *   get:
 *     tags: [Admin Payments]
 *     summary: Lấy chi tiết thanh toán dành cho quản trị viên
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: paymentId, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Thông tin chi tiết thanh toán }
 *       400: { description: ObjectId không hợp lệ }
 *       401: { description: Chưa đăng nhập hoặc phiên đăng nhập không hợp lệ }
 *       403: { description: Không có quyền thực hiện thao tác này }
 *       404: { description: Không tìm thấy thanh toán }
 * /admin/payments/{paymentId}/status:
 *   patch:
 *     tags: [Admin Payments]
 *     summary: Cập nhật trạng thái thanh toán chưa hoàn tất kèm bằng chứng đối soát
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: paymentId, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status, evidence]
 *             properties:
 *               status: { type: string, enum: [failed, cancelled, refund_pending] }
 *               evidence: { type: string }
 *               adminNote: { type: string }
 *     responses:
 *       200: { description: Đã cập nhật trạng thái thanh toán }
 *       400: { description: Trạng thái không hợp lệ hoặc dữ liệu không hợp lệ }
 *       401: { description: Chưa đăng nhập hoặc phiên đăng nhập không hợp lệ }
 *       403: { description: Không có quyền thực hiện thao tác này }
 *       404: { description: Không tìm thấy thanh toán }
 * /admin/payments/{paymentId}/reconcile:
 *   post:
 *     tags: [Admin Payments]
 *     summary: Đối soát thanh toán theo cơ chế idempotent
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: paymentId, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Đã đối soát thanh toán }
 *       400: { description: Yêu cầu không hợp lệ }
 *       401: { description: Chưa đăng nhập hoặc phiên đăng nhập không hợp lệ }
 *       403: { description: Không có quyền thực hiện thao tác này }
 *       404: { description: Không tìm thấy thanh toán }
 */

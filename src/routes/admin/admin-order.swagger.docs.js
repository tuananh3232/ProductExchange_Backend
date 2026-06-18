/**
 * @swagger
 * /admin/orders:
 *   get:
 *     tags: [Admin Orders]
 *     summary: Lấy danh sách đơn hàng dành cho quản trị viên
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, minimum: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 100 } }
 *       - { in: query, name: orderCode, schema: { type: string } }
 *       - { in: query, name: buyerId, schema: { type: string } }
 *       - { in: query, name: shopId, schema: { type: string } }
 *       - { in: query, name: sellerId, schema: { type: string } }
 *       - { in: query, name: status, schema: { type: string } }
 *       - { in: query, name: paymentStatus, schema: { type: string } }
 *       - { in: query, name: paymentMethod, schema: { type: string } }
 *       - { in: query, name: createdFrom, schema: { type: string, format: date-time } }
 *       - { in: query, name: createdTo, schema: { type: string, format: date-time } }
 *       - { in: query, name: minTotal, schema: { type: number } }
 *       - { in: query, name: maxTotal, schema: { type: number } }
 *     responses:
 *       200: { description: Danh sách đơn hàng }
 *       400: { description: Tham số truy vấn không hợp lệ }
 *       401: { description: Chưa đăng nhập hoặc phiên đăng nhập không hợp lệ }
 *       403: { description: Không có quyền thực hiện thao tác này }
 * /admin/orders/{orderId}:
 *   get:
 *     tags: [Admin Orders]
 *     summary: Lấy chi tiết đơn hàng dành cho quản trị viên
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: orderId, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Thông tin chi tiết đơn hàng }
 *       400: { description: ObjectId không hợp lệ }
 *       401: { description: Chưa đăng nhập hoặc phiên đăng nhập không hợp lệ }
 *       403: { description: Không có quyền thực hiện thao tác này }
 *       404: { description: Không tìm thấy đơn hàng }
 * /admin/orders/{orderId}/status:
 *   patch:
 *     tags: [Admin Orders]
 *     summary: Cập nhật trạng thái đơn hàng kèm kiểm tra chuyển trạng thái nghiệp vụ
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: orderId, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [pending, confirmed, processing, shipped, delivered, cancelled] }
 *               reason: { type: string }
 *               adminNote: { type: string }
 *     responses:
 *       200: { description: Đã cập nhật trạng thái đơn hàng }
 *       400: { description: Chuyển trạng thái không hợp lệ hoặc dữ liệu không hợp lệ }
 *       401: { description: Chưa đăng nhập hoặc phiên đăng nhập không hợp lệ }
 *       403: { description: Không có quyền thực hiện thao tác này }
 *       404: { description: Không tìm thấy đơn hàng }
 * /admin/orders/{orderId}/cancel:
 *   patch:
 *     tags: [Admin Orders]
 *     summary: Hủy đơn hàng và tái sử dụng luồng hoàn kho hoặc hoàn tiền hiện có
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: orderId, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Đã hủy đơn hàng }
 *       400: { description: Chuyển trạng thái không hợp lệ }
 *       401: { description: Chưa đăng nhập hoặc phiên đăng nhập không hợp lệ }
 *       403: { description: Không có quyền thực hiện thao tác này }
 *       404: { description: Không tìm thấy đơn hàng }
 * /admin/orders/{orderId}/refund:
 *   patch:
 *     tags: [Admin Orders]
 *     summary: Hoàn tiền cho thanh toán bằng ví hoặc đánh dấu giao dịch cổng thanh toán là refund_pending
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: orderId, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Đã cập nhật trạng thái hoàn tiền }
 *       400: { description: Đơn hàng không thể hoàn tiền }
 *       401: { description: Chưa đăng nhập hoặc phiên đăng nhập không hợp lệ }
 *       403: { description: Không có quyền thực hiện thao tác này }
 *       404: { description: Không tìm thấy đơn hàng }
 */

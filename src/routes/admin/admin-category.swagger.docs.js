/**
 * @swagger
 * /admin/categories:
 *   get:
 *     tags: [Admin Categories]
 *     summary: Lấy danh sách danh mục, bao gồm cả danh mục không hoạt động
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Danh sách danh mục }
 *       400: { description: Tham số truy vấn không hợp lệ }
 *       401: { description: Chưa đăng nhập hoặc phiên đăng nhập không hợp lệ }
 *       403: { description: Không có quyền thực hiện thao tác này }
 *   post:
 *     tags: [Admin Categories]
 *     summary: Tạo danh mục trong namespace quản trị
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, example: Đồ trang trí }
 *               slug: { type: string, example: decor }
 *               description: { type: string }
 *               icon: { type: string }
 *               isActive: { type: boolean }
 *     responses:
 *       201: { description: Đã tạo danh mục }
 *       400: { description: Dữ liệu không hợp lệ }
 *       401: { description: Chưa đăng nhập hoặc phiên đăng nhập không hợp lệ }
 *       403: { description: Không có quyền thực hiện thao tác này }
 *       409: { description: Danh mục bị trùng }
 * /admin/categories/{categoryId}:
 *   get:
 *     tags: [Admin Categories]
 *     summary: Lấy chi tiết danh mục dành cho quản trị viên
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: categoryId, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Thông tin chi tiết danh mục }
 *       400: { description: ObjectId không hợp lệ }
 *       401: { description: Chưa đăng nhập hoặc phiên đăng nhập không hợp lệ }
 *       403: { description: Không có quyền thực hiện thao tác này }
 *       404: { description: Không tìm thấy danh mục }
 *   patch:
 *     tags: [Admin Categories]
 *     summary: Cập nhật các trường cho phép của danh mục
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: categoryId, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Đã cập nhật danh mục }
 *       400: { description: Dữ liệu không hợp lệ }
 *       401: { description: Chưa đăng nhập hoặc phiên đăng nhập không hợp lệ }
 *       403: { description: Không có quyền thực hiện thao tác này }
 *       404: { description: Không tìm thấy danh mục }
 *       409: { description: Danh mục bị trùng }
 * /admin/categories/{categoryId}/status:
 *   patch:
 *     tags: [Admin Categories]
 *     summary: Bật hoặc tắt trạng thái hoạt động của danh mục theo cơ chế ẩn mềm
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: categoryId, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [isActive]
 *             properties:
 *               isActive: { type: boolean }
 *               reason: { type: string }
 *               adminNote: { type: string }
 *     responses:
 *       200: { description: Đã cập nhật trạng thái danh mục }
 *       400: { description: Dữ liệu không hợp lệ }
 *       401: { description: Chưa đăng nhập hoặc phiên đăng nhập không hợp lệ }
 *       403: { description: Không có quyền thực hiện thao tác này }
 *       404: { description: Không tìm thấy danh mục }
 */

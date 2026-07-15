/**
 * @swagger
 * components:
 *   schemas:
 *     CommerceAmount:
 *       type: object
 *       properties:
 *         subtotal: { type: integer, format: int64 }
 *         discount: { type: integer, format: int64 }
 *         shippingFee: { type: integer, format: int64 }
 *         tax: { type: integer, format: int64 }
 *         total: { type: integer, format: int64 }
 *     ShippingAddressSnapshot:
 *       type: object
 *       required: [recipientName, phone, province, district, detail]
 *       properties:
 *         recipientName: { type: string }
 *         phone: { type: string }
 *         province: { type: string }
 *         district: { type: string }
 *         detail: { type: string }
 *     CheckoutItemRequest:
 *       type: object
 *       required: [productId, variantId, quantity]
 *       properties:
 *         productId: { type: string }
 *         variantId: { type: string }
 *         quantity: { type: integer, minimum: 1 }
 *     PaymentAttempt:
 *       type: object
 *       properties:
 *         _id: { type: string }
 *         checkout: { type: string }
 *         provider: { type: string, enum: [payos, vnpay, wallet] }
 *         amount: { type: integer, format: int64 }
 *         currency: { type: string, enum: [VND] }
 *         status: { type: string, enum: [created, pending, succeeded, failed, cancelled, expired] }
 *         checkoutUrl: { type: string, nullable: true }
 *
 * /checkouts:
 *   post:
 *     tags: [Commerce]
 *     summary: Tạo checkout và reservation theo từng shop hoặc seller
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: header
 *         name: Idempotency-Key
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [items, shippingAddress]
 *             properties:
 *               items: { type: array, items: { $ref: '#/components/schemas/CheckoutItemRequest' } }
 *               shippingAddress: { $ref: '#/components/schemas/ShippingAddressSnapshot' }
 *     responses:
 *       201: { description: Checkout được tạo }
 *       409: { description: Không đủ tồn kho }
 * /checkouts/{checkoutId}:
 *   get:
 *     tags: [Commerce]
 *     summary: Lấy checkout của buyer
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: checkoutId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Chi tiết checkout }
 * /payments:
 *   post:
 *     tags: [Commerce Payments]
 *     summary: Tạo payment attempt cho checkout
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: header
 *         name: Idempotency-Key
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [checkoutId, provider]
 *             properties:
 *               checkoutId: { type: string }
 *               provider: { type: string, enum: [payos, vnpay, wallet] }
 *     responses:
 *       201: { description: Payment attempt được tạo }
 * /payments/{paymentId}:
 *   get:
 *     tags: [Commerce Payments]
 *     summary: Lấy trạng thái payment attempt
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Trạng thái giao dịch }
 * /orders/{orderId}/ship:
 *   post:
 *     tags: [Commerce Fulfillment]
 *     summary: Merchant nhập carrier và tracking code
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Đơn đã chuyển sang shipped }
 * /orders/{orderId}/delivered:
 *   post:
 *     tags: [Commerce Fulfillment]
 *     summary: Ghi nhận đã giao và mở cửa sổ buyer xác nhận
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Đơn chờ buyer xác nhận }
 * /orders/{orderId}/confirm-received:
 *   post:
 *     tags: [Commerce Fulfillment]
 *     summary: Buyer xác nhận nhận hàng và giải ngân escrow
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Đơn hoàn tất }
 * /orders/{orderId}/cases:
 *   post:
 *     tags: [Commerce Cases]
 *     summary: Buyer mở return hoặc dispute
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Case được tạo và settlement bị giữ }
 * /admin/order-cases/{caseId}/resolve:
 *   patch:
 *     tags: [Commerce Admin]
 *     summary: Admin giải quyết case idempotently
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: header
 *         name: Idempotency-Key
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Case đã được giải quyết }
 * /admin/reconciliation/run:
 *   post:
 *     tags: [Commerce Admin]
 *     summary: Chạy đối soát payment, order và double-entry ledger
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Kết quả đối soát }
 */


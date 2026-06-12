Bạn là Senior Backend Engineer trong project ProductExchange_Backend dùng Node.js ESM, Express, MongoDB/Mongoose, Jest/Supertest.

Hãy đọc toàn bộ code hiện tại trước khi sửa. Chỉ xử lý phạm vi trong `Note/bug/be_improvements_report.md`, KHÔNG sửa phần `chat_shop.md` và KHÔNG sửa phần `phanquyen.md`.

Mục tiêu: hoàn thiện các API/contract còn thiếu để Frontend bỏ hardcode, bỏ local cart logic, checkout được nhiều item và dùng user DTO thống nhất.

## Phạm vi cần làm

### 1. Thêm `GET /combos/options`

Kiểm tra enum/constant/validation hiện có của combo, không hardcode trùng lặp nếu đã có constant.

Thêm route:

* `GET /api/v1/combos/options`

Response dạng:

```json
{
  "success": true,
  "data": {
    "styles": [
      { "value": "minimalist", "label": "Minimalist" }
    ],
    "roomTypes": [
      { "value": "bedroom", "label": "Bedroom" }
    ],
    "colorTones": [
      { "value": "warm", "label": "Warm" }
    ],
    "constraints": {
      "budgetMin": 1,
      "maxItemsMin": 1,
      "maxItemsMax": 20,
      "maxItemsDefault": 5
    }
  }
}
```

Yêu cầu:

* Dùng đúng enum đang validate trong combo.
* Không làm hỏng `POST /combos/generate`.
* Không làm hỏng `GET /combos/alternatives`.

---

### 2. Hoàn thiện cart server-driven

Hiện tại cart mới có `POST /cart/add-combo`. Hãy bổ sung đầy đủ các API sau:

* `GET /api/v1/cart`
* `PATCH /api/v1/cart/items/:productId`
* `DELETE /api/v1/cart/items/:productId`
* `DELETE /api/v1/cart`

Yêu cầu nghiệp vụ:

#### `GET /cart`

Trả về cart hiện tại của user đăng nhập.

Response nên gồm:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "productId": "...",
        "product": {},
        "quantity": 2,
        "unitPrice": 120000,
        "subtotal": 240000
      }
    ],
    "totalItems": 2,
    "subtotal": 240000
  }
}
```

#### `PATCH /cart/items/:productId`

Request:

```json
{
  "quantity": 3
}
```

Validation:

* `quantity` bắt buộc là số nguyên.
* `quantity >= 1`.
* Nếu product không có trong cart thì trả lỗi phù hợp.
* Nếu product không tồn tại hoặc không available thì trả lỗi phù hợp.
* Không cho quantity vượt stock nếu project đang quản lý stock.

#### `DELETE /cart/items/:productId`

* Xóa 1 item khỏi cart.
* Nếu item không tồn tại thì trả lỗi rõ ràng hoặc idempotent theo style hiện tại của project.

#### `DELETE /cart`

* Clear toàn bộ cart của user.
* Trả về cart rỗng hoặc message thành công.

Yêu cầu kỹ thuật:

* Giữ format response đang dùng trong project.
* Dùng middleware `authenticate` giống `add-combo`.
* Tái sử dụng service/helper hiện có nếu đã có cart model/service.
* Không phá logic merge item trùng của `POST /cart/add-combo`.
* Update Swagger nếu project đang có swagger docs cho cart.

---

### 3. Thêm checkout nhiều item

Ưu tiên làm:

* `POST /api/v1/cart/checkout`

Nếu kiến trúc hiện tại phù hợp hơn với order thì có thể chọn:

* `POST /api/v1/orders/bulk`

Nhưng ưu tiên `POST /cart/checkout` vì FE đang cần checkout từ cart.

Request đề xuất:

```json
{
  "paymentMethod": "PAYOS",
  "selectedProductIds": ["..."]
}
```

Nếu không truyền `selectedProductIds` thì checkout toàn bộ cart.

Yêu cầu nghiệp vụ:

* Lấy cart từ server theo user hiện tại.
* Validate cart không rỗng.
* Validate từng product còn tồn tại, active/available, đủ stock nếu có stock.
* Tính subtotal/total ở backend, không tin total từ FE.
* Tạo order hoặc nhiều order theo đúng model hiện tại của project.
* Nếu project hiện đang tạo order theo từng seller/shop thì giữ đúng logic owner/shop/seller hiện có.
* Nếu payment online thì trả `paymentUrl` nếu service payment hiện có hỗ trợ.
* Sau khi checkout thành công, xóa item đã checkout khỏi cart.
* Nếu có lỗi giữa chừng thì không clear cart bừa.
* Nếu đã có transaction/session MongoDB trong project thì dùng transaction cho bước tạo order và update cart/product.
* Nếu chưa dùng transaction thì code phải idempotent và có rollback tối thiểu, không để product/cart sai trạng thái.

Response đề xuất:

```json
{
  "success": true,
  "data": {
    "checkoutId": "...",
    "orders": [
      {
        "id": "...",
        "status": "PENDING_PAYMENT",
        "paymentStatus": "pending"
      }
    ],
    "paymentUrl": "https://..."
  }
}
```

Không làm hỏng flow payment callback/topup hiện tại.

---

### 4. Thêm options/filter-options theo domain

Thêm các endpoint metadata để FE bỏ hardcode:

* `GET /api/v1/products/filter-options`
* `GET /api/v1/orders/filter-options`
* `GET /api/v1/admin/users/filter-options`
* `GET /api/v1/shops/filter-options`
* `GET /api/v1/kyc/filter-options`
* `GET /api/v1/withdrawals/filter-options`
* `GET /api/v1/payments/options`

Yêu cầu:

* Lấy value từ constant/enum hiện có, tránh hardcode rải rác.
* Mỗi option có dạng `{ value, label }`.
* Label có thể là tiếng Việt hoặc tiếng Anh, nhưng phải nhất quán với project.
* Endpoint admin thì giữ middleware phân quyền hiện tại nếu route admin đang yêu cầu admin.
* Endpoint public/product thì không bắt auth nếu filter đó đang dùng cho trang public.
* Không làm thay đổi behavior filter list hiện tại.

Response ví dụ `GET /products/filter-options`:

```json
{
  "success": true,
  "data": {
    "listingTypes": [
      { "value": "SELL", "label": "Bán" }
    ],
    "conditions": [
      { "value": "NEW", "label": "Mới" }
    ],
    "statuses": [
      { "value": "AVAILABLE", "label": "Đang bán" }
    ],
    "sortOptions": [
      { "value": "newest", "label": "Mới nhất" },
      { "value": "price_asc", "label": "Giá tăng dần" },
      { "value": "price_desc", "label": "Giá giảm dần" }
    ]
  }
}
```

Response ví dụ `GET /payments/options`:

```json
{
  "success": true,
  "data": {
    "methods": [
      { "value": "PAYOS", "label": "PayOS" },
      { "value": "VNPAY", "label": "VNPay" },
      { "value": "WALLET", "label": "Ví nội bộ" }
    ],
    "statuses": [
      { "value": "pending", "label": "Chờ thanh toán" },
      { "value": "paid", "label": "Đã thanh toán" },
      { "value": "cancelled", "label": "Đã hủy" },
      { "value": "failed", "label": "Thất bại" }
    ]
  }
}
```

---

### 5. Chuẩn hóa user DTO dùng chung

Tìm helper `toUserResponse()` hoặc helper tương đương.

Mục tiêu: login, refresh, `GET /users/me`, update profile trả về user thống nhất.

DTO đề xuất:

```json
{
  "id": "...",
  "email": "user@example.com",
  "name": "Nguyen Van A",
  "fullName": "Nguyen Van A",
  "avatarUrl": "https://...",
  "phone": "0900000000",
  "address": "...",
  "roles": ["member"],
  "primaryRole": "member",
  "status": "active",
  "isActive": true,
  "createdAt": "...",
  "updatedAt": "..."
}
```

Yêu cầu:

* Không làm mất field FE đang dùng cũ như `name`, `roles`.
* Nếu project dùng `fullName` thì map cả `name` và `fullName` để tương thích.
* `primaryRole` lấy theo thứ tự ưu tiên hợp lý: admin > shop_owner > staff > seller > member, hoặc theo logic role hiện tại của project.
* Dùng helper này cho login/register nếu có trả user, refresh token, `/users/me`, update profile.
* Không trả password, OTP, token nhạy cảm.

---

### 6. Chuẩn hóa product media/upload contract ở mức an toàn

Không rewrite toàn bộ upload nếu không cần. Chỉ chuẩn hóa response ảnh.

Mỗi image item nên có dạng:

```json
{
  "url": "https://...",
  "publicId": "products/abc",
  "isPrimary": true
}
```

Yêu cầu:

* Nếu image cũ chưa có `isPrimary`, default image đầu tiên là `isPrimary: true`, các ảnh còn lại `false`.
* Khi add image mới, nếu product chưa có ảnh primary thì ảnh mới là primary.
* Khi remove ảnh primary, tự set ảnh còn lại đầu tiên làm primary nếu còn ảnh.
* Không phá route create product multipart hiện tại.
* Không phá route add/remove image hiện tại.
* Update serializer/response để FE nhận contract thống nhất.

---

## Test và kiểm tra bắt buộc

Sau khi sửa, chạy tối thiểu:

```bash
node --check src/routes/combo/combo.route.js
node --check src/routes/cart/cart.route.js
node --check src/routes/payment/payment.route.js
npm test -- tests/combo.test.js --runInBand
npm test -- tests/product.test.js --runInBand
npm test -- tests/order.test.js --runInBand
npm test -- tests/payment.test.js --runInBand
git diff --check
```

Nếu project có test cart riêng thì chạy thêm:

```bash
npm test -- tests/cart.test.js --runInBand
```

Nếu test toàn project fail do lỗi cũ ngoài phạm vi, hãy ghi rõ:

* test nào pass
* test nào fail
* lý do fail
* file fail có liên quan đến phần sửa này không

---

## Yêu cầu báo cáo sau khi sửa

Khi hoàn thành, báo cáo theo format:

1. Đã thêm/sửa endpoint nào.
2. File đã chỉnh.
3. Contract request/response chính.
4. Test đã chạy và kết quả.
5. Những phần chưa làm được hoặc cần FE confirm.
6. Không nói chung chung, phải nêu rõ route và file.

Lưu ý:

* Không sửa chat actor `USER/SHOP`.
* Không sửa RBAC permission matrix.
* Không sửa category permission trong prompt này.
* Không đổi nghiệp vụ payment callback/topup đang chạy.
* Không đổi tên route cũ.
* Ưu tiên backward compatible để FE cũ không vỡ.

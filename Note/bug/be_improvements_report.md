# Báo Cáo Cải Thiện Backend Cho FE ANH-DECOR

## Mục đích

Tài liệu này tổng hợp các điểm cần phía Backend bổ sung hoặc chuẩn hóa để Frontend của ANH-DECOR có thể vận hành hoàn toàn theo dữ liệu thật từ hệ thống, hạn chế tối đa việc suy luận hoặc hardcode ở FE.

Phạm vi đánh giá dựa trên các yêu cầu đã rà soát trong quá trình tích hợp:

- Notification bell và danh sách thông báo
- Combo generator dùng API thật
- Cart, checkout, order, payment
- Upload ảnh khi tạo sản phẩm
- Hệ filter/search trên toàn hệ thống
- Đồng bộ contract dữ liệu `user`

Mục tiêu không phải thay đổi nghiệp vụ hiện tại của BE, mà là xác định các API hoặc contract còn thiếu để FE có thể:

- bỏ mock/hardcode
- giảm xử lý logic nghiệp vụ ở FE
- tăng tính ổn định và khả năng bảo trì
- hạn chế gọi API không cần thiết
- tránh lệch enum hoặc contract giữa FE và BE

---

## Tóm tắt nhanh

Hiện tại Backend đã có nền tảng tốt cho một số luồng chính như:

- generate combo
- alternatives cho combo
- add combo vào cart
- notifications cơ bản
- payment/topup callback
- room visualizer
- product visual assets

Tuy nhiên vẫn còn một số khoảng trống khiến FE buộc phải xử lý tạm:

- hardcode option cho nhiều filter
- giữ cart cục bộ ở FE
- tự quản lý một số enum hiển thị
- tự suy luận dữ liệu `user` khi BE trả về chưa nhất quán
- chưa thể triển khai trọn vẹn luồng cart server-driven

Ưu tiên lớn nhất cần BE hỗ trợ thêm là:

1. API metadata/options theo từng domain để loại bỏ hardcode ở FE
2. Bộ API cart đầy đủ để bỏ local cart logic
3. Contract checkout rõ ràng cho giỏ hàng nhiều sản phẩm
4. Chuẩn hóa dữ liệu `user` và product media

---

## 1. Thiếu API metadata/options cho Combo Generator

### Hiện trạng

FE hiện đang gọi được:

- `POST /combos/generate`
- `GET /combos/alternatives`
- `POST /cart/add-combo`

Phần này cho thấy Backend đã xử lý tốt logic sinh combo và gợi ý thay thế.

Tuy nhiên form tiêu chí đầu vào của combo hiện cần các thuộc tính:

```json
{
  "style": "minimalist",
  "roomType": "bedroom",
  "colorTone": "warm",
  "budget": 1,
  "maxItems": 5
}
```

Trong đó:

- `budget`, `maxItems`: người dùng nhập
- `style`, `roomType`, `colorTone`: nên là danh sách chọn từ dữ liệu BE

### Vấn đề

Backend hiện có validate cho các enum này, nhưng chưa có API để FE lấy danh sách option hợp lệ một cách động.

Hệ quả:

- FE phải hardcode `style`
- FE phải hardcode `roomType`
- FE phải hardcode `colorTone`
- nguy cơ lệch giữa enum validate của BE và option đang hiển thị ở FE
- khó bảo trì nếu BE đổi tên enum hoặc thêm giá trị mới

### Đề xuất API

`GET /combos/options`

Response đề xuất:

```json
{
  "success": true,
  "data": {
    "styles": [
      { "value": "minimalist", "label": "Minimalist" },
      { "value": "modern", "label": "Modern" },
      { "value": "vintage", "label": "Vintage" }
    ],
    "roomTypes": [
      { "value": "bedroom", "label": "Bedroom" },
      { "value": "living_room", "label": "Living room" },
      { "value": "kitchen", "label": "Kitchen" }
    ],
    "colorTones": [
      { "value": "warm", "label": "Warm" },
      { "value": "cool", "label": "Cool" },
      { "value": "neutral", "label": "Neutral" }
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

### Vì sao cần làm

- Giúp FE bỏ hoàn toàn hardcode option combo
- Tránh sai lệch dữ liệu khi enum ở BE thay đổi
- Hỗ trợ dễ hơn cho đa ngôn ngữ hoặc đổi label hiển thị
- Tạo nền tảng cho UI filter/criteria thống nhất theo dữ liệu thật

---

## 2. Thiếu bộ API Cart đầy đủ theo hướng server-driven

### Hiện trạng

Backend hiện mới đủ rõ cho:

- `POST /cart/add-combo`

Trong khi một giỏ hàng hoàn chỉnh ở FE cần nhiều thao tác hơn:

- xem giỏ hàng hiện tại
- cập nhật số lượng
- xóa một item
- xóa toàn bộ giỏ
- đồng bộ trạng thái giỏ sau khi thêm/sửa/xóa

### Vấn đề

Do thiếu API cart đầy đủ, FE buộc phải:

- giữ một phần logic cart ở local state hoặc local storage
- tự đồng bộ cảm tính giữa UI và server
- phát sinh nguy cơ sai lệch dữ liệu giữa client và backend
- khó triển khai chuẩn các trường hợp như refresh trang, đăng nhập lại, đổi thiết bị

### Đề xuất API

`GET /cart`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "productId": "p1",
        "quantity": 2,
        "unitPrice": 1200000,
        "subtotal": 2400000
      }
    ],
    "totalItems": 2,
    "subtotal": 2400000
  }
}
```

`PATCH /cart/items/:productId`

Ví dụ request:

```json
{
  "quantity": 3
}
```

`DELETE /cart/items/:productId`

`DELETE /cart`

### Vì sao cần làm

- FE có thể bỏ local cart logic
- Giỏ hàng trở thành nguồn dữ liệu thống nhất từ server
- Dễ cache bằng React Query/Zustand mà không cần vá nhiều lớp đồng bộ
- Tránh bug về số lượng, giá, item tồn tại nhưng server không biết

---

## 3. Thiếu API checkout toàn bộ cart hoặc bulk order

### Hiện trạng

FE hiện có thể thanh toán theo từng sản phẩm hoặc theo từng order riêng lẻ. Tuy nhiên với trải nghiệm người dùng thông thường, giỏ hàng thường yêu cầu:

- chọn nhiều sản phẩm
- thanh toán một lần
- nhận về kết quả thống nhất cho toàn bộ phiên checkout

### Vấn đề

Nếu Backend chỉ hỗ trợ tạo order đơn lẻ, FE sẽ phải:

- tự lặp qua từng item để tạo order
- tự quản lý rollback nếu một item thất bại
- tự ghép nhiều response rời rạc thành một phiên checkout

Điều này không an toàn về mặt nghiệp vụ và rất dễ phát sinh lỗi.

### Đề xuất API

Một trong hai hướng sau:

`POST /cart/checkout`

Hoặc:

`POST /orders/bulk`

Ví dụ request:

```json
{
  "items": [
    { "productId": "p1", "quantity": 1 },
    { "productId": "p2", "quantity": 2 }
  ],
  "paymentMethod": "PAYOS"
}
```

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "checkoutId": "chk_001",
    "orders": [
      { "id": "o1", "status": "PENDING_PAYMENT" },
      { "id": "o2", "status": "PENDING_PAYMENT" }
    ],
    "paymentUrl": "https://..."
  }
}
```

### Vì sao cần làm

- FE không nên tự dựng nghiệp vụ checkout nhiều sản phẩm
- Backend cần là nơi đảm bảo tính toàn vẹn của giao dịch
- Dễ xử lý khuyến mãi, tổng tiền, phí, rollback, timeout, lỗi thanh toán
- Giảm đáng kể độ phức tạp ở FE

---

## 4. Thiếu metadata/options API cho các filter khác ngoài Combo

### Hiện trạng

Qua rà soát FE, nhiều filter đang dùng giá trị hardcode hoặc copy lại enum từ BE vì chưa có API lấy option động.

Các nhóm dễ gặp tình trạng này:

- orders status
- users role/status
- product status/condition/listing type/sort option
- shop status
- KYC status
- withdrawal status
- một số payment method hoặc payment status hiển thị ở FE

### Vấn đề

Khi không có endpoint options riêng cho từng domain:

- FE phải hardcode danh sách select
- FE dễ lệch label với nghiệp vụ thật
- khi BE thêm trạng thái mới, FE không tự cập nhật được
- việc bảo trì nhiều màn hình trở nên tốn kém

### Đề xuất API theo từng domain

`GET /orders/filter-options`

Ví dụ:

```json
{
  "success": true,
  "data": {
    "statuses": [
      { "value": "PENDING", "label": "Chờ xử lý" },
      { "value": "CONFIRMED", "label": "Đã xác nhận" },
      { "value": "CANCELLED", "label": "Đã hủy" }
    ]
  }
}
```

`GET /admin/users/filter-options`

Ví dụ:

```json
{
  "success": true,
  "data": {
    "roles": [
      { "value": "ADMIN", "label": "Quản trị viên" },
      { "value": "CUSTOMER", "label": "Khách hàng" }
    ],
    "statuses": [
      { "value": "ACTIVE", "label": "Đang hoạt động" },
      { "value": "INACTIVE", "label": "Ngưng hoạt động" }
    ]
  }
}
```

`GET /products/filter-options`

Ví dụ:

```json
{
  "success": true,
  "data": {
    "listingTypes": [
      { "value": "SELL", "label": "Bán" },
      { "value": "RENT", "label": "Cho thuê" }
    ],
    "conditions": [
      { "value": "NEW", "label": "Mới" },
      { "value": "USED", "label": "Đã qua sử dụng" }
    ],
    "statuses": [
      { "value": "AVAILABLE", "label": "Đang bán" },
      { "value": "SOLD", "label": "Đã bán" }
    ],
    "sortOptions": [
      { "value": "newest", "label": "Mới nhất" },
      { "value": "price_asc", "label": "Giá tăng dần" }
    ]
  }
}
```

`GET /shops/filter-options`

`GET /kyc/filter-options`

`GET /withdrawals/filter-options`

### Vì sao cần làm

- Bỏ hardcode ở FE
- Đồng bộ một nguồn sự thật cho enum hiển thị
- Cho phép BE kiểm soát label hiển thị nghiệp vụ
- Hỗ trợ mở rộng nhanh mà không phải sửa nhiều chỗ ở FE

---

## 5. Những phần FE hiện vẫn buộc phải hardcode do BE chưa hỗ trợ đủ

### Hardcode đã xác định trong FE

1. Combo criteria
- `style`
- `roomType`
- `colorTone`

2. Product-related filters
- `sortBy`
- một số `listingType`
- một số `condition`
- một số `status`

3. Order/Admin filters
- order status
- user role
- user status
- KYC status
- shop status
- withdrawal status

### Ý nghĩa của việc ghi nhận các điểm hardcode này

Việc này không nhằm đánh giá FE làm sai, mà để xác định chính xác phần nào FE đang phải “gánh tạm” vì thiếu contract từ BE.

Nếu BE chưa có API options theo từng domain thì FE gần như bắt buộc phải:

- hardcode
- hoặc copy enum từ swagger/model/validation

Cả hai cách đều không tối ưu về lâu dài.

---

## 6. Cần chuẩn hóa contract `user` ổn định hơn

### Hiện trạng

Team BE đã thay đổi nhẹ thuộc tính user, khiến FE phải điều chỉnh phần patch/merge state để không làm mất dữ liệu hiện có.

Trong thực tế, FE thường cần dữ liệu `user` nhất quán giữa:

- login response
- `GET /users/me`
- update profile response
- refresh session

### Vấn đề

Nếu mỗi endpoint trả về một cấu trúc `user` khác nhau hoặc thiếu trường cốt lõi, FE sẽ phải:

- merge thủ công
- suy luận `role` từ `roles[]`
- giữ lại dữ liệu cũ để tránh mất state

Điều này tăng độ mong manh của session management.

### Đề xuất

Backend nên chuẩn hóa thống nhất một DTO `user` dùng chung cho các endpoint chính.

Ví dụ:

```json
{
  "id": "u1",
  "email": "user@example.com",
  "fullName": "Nguyen Van A",
  "avatarUrl": "https://...",
  "phone": "0900000000",
  "roles": ["CUSTOMER"],
  "primaryRole": "CUSTOMER",
  "status": "ACTIVE"
}
```

### Vì sao cần làm

- FE không cần merge thủ công quá nhiều
- Giảm nguy cơ mất field sau refresh hoặc patch profile
- Dễ duy trì auth store/session store ổn định

---

## 7. Cần làm rõ và thống nhất contract product media/upload

### Hiện trạng

Phần tạo sản phẩm đã được chuyển sang upload ảnh theo contract BE. Tuy nhiên trước đó từng có sự khác biệt giữa:

- kiểu gửi URL/publicId dạng JSON
- kiểu upload file multipart

### Vấn đề

Nếu các route liên quan ảnh sản phẩm không thống nhất:

- FE khó tái sử dụng form
- dễ phát sinh nhầm lẫn giữa tạo mới, cập nhật, thêm ảnh, xóa ảnh
- dễ gây lỗi khi team khác tiếp tục mở rộng tính năng media

### Đề xuất

Backend nên xác nhận và giữ ổn định rõ:

1. Route nào nhận `multipart/form-data`
2. Route nào nhận JSON metadata
3. Response trả về ảnh theo cấu trúc nào

Ví dụ một item ảnh:

```json
{
  "url": "https://...",
  "publicId": "products/abc",
  "isPrimary": true
}
```

### Vì sao cần làm

- FE dễ xây dựng form create/edit thống nhất
- dễ triển khai gallery nhiều ảnh
- giảm rủi ro sai kiểu payload giữa các route

---

## 8. Payment nên có metadata rõ hơn nếu muốn FE bỏ hardcode hiển thị

### Hiện trạng

Payment flow chính hiện tương đối dùng được. Tuy nhiên nếu muốn đồng bộ hoàn toàn theo BE, các thông tin như:

- payment methods
- payment statuses
- topup channels

cũng nên có options từ BE nếu những giá trị này có thể thay đổi theo môi trường hoặc nghiệp vụ.

### Đề xuất API

`GET /payments/options`

Ví dụ:

```json
{
  "success": true,
  "data": {
    "methods": [
      { "value": "COD", "label": "Thanh toán khi nhận hàng" },
      { "value": "PAYOS", "label": "PayOS" },
      { "value": "WALLET", "label": "Ví nội bộ" }
    ],
    "statuses": [
      { "value": "PENDING", "label": "Chờ thanh toán" },
      { "value": "PAID", "label": "Đã thanh toán" },
      { "value": "FAILED", "label": "Thất bại" }
    ]
  }
}
```

### Vì sao nên cân nhắc

- FE không cần tự duy trì label thanh toán
- dễ thay đổi kênh thanh toán trong tương lai
- thuận tiện khi thêm nhà cung cấp thanh toán mới

Lưu ý: đây là nhóm cải thiện “nên có”, mức ưu tiên thấp hơn cart và combo metadata.

---

## 9. Những phần Backend hiện đã hỗ trợ khá tốt

Đây là các phần BE đã có nền tảng đủ tốt để FE tích hợp tương đối ổn:

- `POST /combos/generate`
- `GET /combos/alternatives`
- `POST /cart/add-combo`
- nhóm notifications cơ bản
- callback/return/cancel/webhook cho topup payment
- room projects/scenes
- product visual assets

Điều này cho thấy hướng phát triển backend đang đúng. Phần cần làm thêm chủ yếu là:

- metadata/options
- contract ổn định
- cart/checkout đầy đủ hơn

---

## 10. Hướng chuẩn hóa nên ưu tiên

Thay vì để FE đọc enum từ code hoặc hardcode lại, Backend nên ưu tiên cung cấp metadata theo từng domain nghiệp vụ.

### Hướng đề xuất

1. `GET /combos/options`
2. `GET /products/filter-options`
3. `GET /orders/filter-options`
4. `GET /admin/users/filter-options`
5. `GET /shops/filter-options`
6. `GET /kyc/filter-options`
7. `GET /withdrawals/filter-options`
8. `GET /payments/options`

### Vì sao cách này phù hợp hơn

- Rõ ràng theo từng module nghiệp vụ
- Dễ phân quyền và bảo trì
- Không làm phình một endpoint lớn
- FE chỉ gọi đúng dữ liệu cần dùng theo từng màn hình

---

## 11. Thứ tự ưu tiên đề xuất cho team BE

### Mức ưu tiên 1

1. `GET /cart`
2. `PATCH /cart/items/:productId`
3. `DELETE /cart/items/:productId`
4. `DELETE /cart`
5. `POST /cart/checkout` hoặc `POST /orders/bulk`

Lý do:

- tác động trực tiếp đến luồng mua hàng
- giúp bỏ local cart logic ở FE
- ảnh hưởng lớn đến tính đúng đắn nghiệp vụ

### Mức ưu tiên 2

1. `GET /combos/options`
2. `GET /products/filter-options`
3. `GET /orders/filter-options`
4. `GET /admin/users/filter-options`
5. `GET /kyc/filter-options`
6. `GET /shops/filter-options`
7. `GET /withdrawals/filter-options`

Lý do:

- giúp loại bỏ hardcode
- tăng tính thống nhất giữa FE và BE
- hỗ trợ UI vận hành hoàn toàn theo dữ liệu thật

### Mức ưu tiên 3

1. Chuẩn hóa DTO `user`
2. Chuẩn hóa contract product media/upload
3. `GET /payments/options`

Lý do:

- tăng độ ổn định và dễ mở rộng
- không cấp bách bằng cart và metadata filter

---

## Kết luận

Frontend hiện đã tích hợp được nhiều phần theo Backend thật, nhưng để đạt mục tiêu “không dùng mockdata, không hardcode, không xử lý nghiệp vụ thay BE”, thì Backend cần bổ sung thêm một số API và chuẩn hóa contract ở các điểm trọng yếu.

Trọng tâm lớn nhất là:

- hoàn thiện cart theo hướng server-driven
- bổ sung options API theo từng domain để bỏ hardcode filter
- chuẩn hóa dữ liệu `user`
- làm rõ contract media/upload và một số metadata thanh toán

Nếu các phần trên được bổ sung, FE có thể:

- dùng hook/store hiệu quả hơn
- giảm số lần gọi API thừa
- tăng độ chính xác dữ liệu
- triển khai UI/UX nhất quán và bền vững hơn về lâu dài

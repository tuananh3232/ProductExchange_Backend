Bạn là Senior Fullstack Engineer trong project ProductExchange / ANH-DECOR.

Hãy đọc kỹ code hiện tại trước khi sửa. Nhiệm vụ lần này chỉ xử lý scope `Note/bug/chat_shop.md`.

KHÔNG sửa:

* `be_improvements_report.md`
* cart/checkout/options/filter-options
* RBAC permission matrix
* category permission
* payment/order/product nếu không liên quan trực tiếp đến chat

Mục tiêu chính: sửa chat workspace shop theo mô hình giống fanpage. Nghĩa là:

* Storefront chat: user gửi với tư cách `USER`.
* Workspace chat: owner/staff trả lời với tư cách `SHOP`.
* Một user có nhiều shop thì inbox workspace phải biết đang đứng ở shop nào.
* Staff/owner chỉ được trả lời bằng đúng shop mình có quyền.
* FE phải render được message là từ user cá nhân hay từ shop/page.

## 1. Sửa Backend: thêm actor cho Message

Tìm model `Message`.

Hiện tại message chỉ có `senderId`. Hãy bổ sung các field sau:

```js
senderType: {
  type: String,
  enum: ['USER', 'SHOP'],
  default: 'USER'
},
senderUserId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'User',
  default: null
},
senderShopId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Shop',
  default: null
}
```

Yêu cầu:

* Không xóa `senderId` ngay để giữ backward compatible.
* Message cũ chỉ có `senderId` vẫn đọc được.
* Khi serialize message cũ:

  * `senderType = 'USER'`
  * `senderUserId = senderId`
  * `senderShopId = null`
* Message mới phải lưu đủ:

  * `senderId = currentUser._id`
  * `senderUserId = currentUser._id`
  * `senderType`
  * `senderShopId` nếu gửi với tư cách shop

Response message cần có dạng:

```json
{
  "id": "...",
  "conversationId": "...",
  "content": "Xin chào",
  "messageType": "TEXT",
  "senderType": "SHOP",
  "senderUserId": "...",
  "senderShopId": "...",
  "sender": {
    "id": "...",
    "name": "Staff A"
  },
  "shopActor": {
    "id": "...",
    "name": "Decor X",
    "avatarUrl": "..."
  },
  "createdAt": "..."
}
```

## 2. Sửa Backend: thêm actor vào Conversation.lastMessage

Tìm model `Conversation`.

Mở rộng `lastMessage` để lưu thêm actor:

```js
lastMessage: {
  content: String,
  messageType: String,
  senderId: ObjectId,
  senderType: {
    type: String,
    enum: ['USER', 'SHOP']
  },
  senderUserId: ObjectId,
  senderShopId: ObjectId,
  createdAt: Date
}
```

Yêu cầu:

* Khi gửi message mới, update `lastMessage` đầy đủ actor.
* Conversation cũ thiếu actor không được crash.
* FE nhìn `lastMessage.senderType` phải biết tin cuối đến từ user hay shop.

## 3. Sửa Backend: list conversation theo `scope` và `shopId`

Cập nhật endpoint hiện tại:

```http
GET /api/v1/conversations
```

Hỗ trợ query mới:

```http
GET /api/v1/conversations?scope=main
GET /api/v1/conversations?scope=workspace&shopId=SHOP_ID
```

Quy tắc:

### `scope=main`

Đây là inbox cá nhân của user.

Chỉ trả:

* DIRECT conversations mà user là participant.
* SHOP conversations mà user là `customerId`.

Không trả:

* conversation workspace của shop mà user chỉ là owner/staff.

### `scope=workspace&shopId=...`

Đây là inbox của shop/page.

Bắt buộc:

* Có `shopId`.
* `shopId` hợp lệ.
* Current user là owner shop, staff có quyền chat shop, hoặc admin nếu project đang cho admin bypass.

Chỉ trả:

* Conversation type `SHOP`.
* `conversation.shopId` đúng bằng `shopId`.

Không trả:

* direct conversation cá nhân.
* conversation của shop khác.

Nếu FE cũ chưa truyền `scope`, giữ backward compatible bằng cách default `scope=main`.

Response conversation cần có:

```json
{
  "id": "...",
  "type": "SHOP",
  "shopId": "...",
  "customerId": "...",
  "context": "workspace",
  "lastMessage": {
    "content": "...",
    "messageType": "TEXT",
    "senderType": "SHOP",
    "senderUserId": "...",
    "senderShopId": "...",
    "createdAt": "..."
  },
  "unreadCount": 3
}
```

## 4. Sửa Backend: gửi message với `actingAs`

Cập nhật endpoint gửi message hiện tại, ví dụ:

```http
POST /api/v1/conversations/:conversationId/messages
```

Body mới:

```json
{
  "content": "Xin chào, shop có thể hỗ trợ bạn",
  "messageType": "TEXT",
  "attachments": [],
  "actingAs": "SHOP",
  "shopId": "..."
}
```

Body khi gửi từ storefront:

```json
{
  "content": "Xin chào shop",
  "messageType": "TEXT",
  "attachments": [],
  "actingAs": "USER"
}
```

Quy tắc:

### Nếu `actingAs = USER`

* Default nếu FE không truyền `actingAs`.
* `senderType = 'USER'`.
* `senderUserId = currentUser._id`.
* `senderShopId = null`.
* Cho phép customer gửi trong SHOP conversation.
* Cho phép participant gửi trong DIRECT conversation.

### Nếu `actingAs = SHOP`

Bắt buộc:

* Có `shopId`.
* Conversation phải là type `SHOP`.
* `conversation.shopId` phải trùng `shopId`.
* Current user phải là:

  * owner của shop đó, hoặc
  * staff của shop đó có quyền `shop:chat_manage`, hoặc
  * admin nếu logic hiện tại cho admin bypass.

Khi lưu:

* `senderType = 'SHOP'`
* `senderUserId = currentUser._id`
* `senderShopId = shopId`
* `senderId = currentUser._id` để backward compatible.

Phải chặn:

* Staff shop B reply conversation shop A.
* User không thuộc shop reply với tư cách shop.
* Gửi `actingAs=SHOP` nhưng không truyền `shopId`.
* Gửi `actingAs=SHOP` vào DIRECT conversation.
* Gửi message rỗng nếu `messageType = TEXT`.

## 5. Sửa Backend: ACL chat shop

Kiểm tra và hoàn thiện helper hiện có như:

* `hasShopChatPermission()`
* `canAccessConversation()`
* service list/send/read message

Các case bắt buộc:

1. Customer của conversation SHOP được đọc/gửi với `actingAs=USER`.
2. Owner shop được đọc/gửi workspace với `actingAs=SHOP`.
3. Staff có quyền `shop:chat_manage` được đọc/gửi workspace với `actingAs=SHOP`.
4. Staff không có quyền chat bị chặn.
5. Staff shop B không được đọc/gửi conversation shop A.
6. User không liên quan không được đọc conversation.
7. DIRECT conversation chỉ participant mới được đọc/gửi.
8. Owner tự chat shop của mình phải phân biệt được:

   * ở storefront là `USER`
   * ở workspace là `SHOP`

## 6. Sửa Backend: socket chat

Tìm socket event hiện có như:

* `join_conversation`
* `send_message`
* `typing_start`
* `typing_stop`
* `mark_as_read`

Cập nhật `send_message` socket để nhận payload:

```json
{
  "conversationId": "...",
  "content": "Xin chào",
  "messageType": "TEXT",
  "attachments": [],
  "actingAs": "SHOP",
  "shopId": "..."
}
```

Yêu cầu:

* Socket phải dùng chung service gửi message với HTTP, không duplicate ACL.
* Khi `actingAs=SHOP`, validate đúng `shopId` và quyền chat shop.
* Emit message mới có đủ:

  * `senderType`
  * `senderUserId`
  * `senderShopId`
  * `shopActor`
* Không làm vỡ client cũ nếu chưa truyền `actingAs`.

Typing event nên emit thêm context:

```json
{
  "conversationId": "...",
  "userId": "...",
  "actingAs": "SHOP",
  "shopId": "..."
}
```

## 7. Sửa Backend: validation

Cập nhật validation schema cho:

### List conversations query

```json
{
  "scope": "main | workspace",
  "shopId": "ObjectId optional"
}
```

Rule:

* `scope` chỉ nhận `main` hoặc `workspace`.
* Nếu `scope=workspace` thì `shopId` bắt buộc.
* `shopId` phải là ObjectId hợp lệ.

### Send message body

```json
{
  "content": "string",
  "messageType": "TEXT | IMAGE | FILE",
  "attachments": [],
  "actingAs": "USER | SHOP",
  "shopId": "ObjectId optional"
}
```

Rule:

* `actingAs` chỉ nhận `USER` hoặc `SHOP`.
* Nếu không truyền thì default `USER`.
* Nếu `actingAs=SHOP` thì `shopId` bắt buộc.
* Nếu `messageType=TEXT` thì `content` không được rỗng.

## 8. Sửa FE workspace chat nếu repo hiện tại có FE

Nếu đang sửa cả FE, hãy cập nhật workspace inbox.

### 8.1. Thêm chọn shop trong trang tin nhắn workspace

Trang `Tin nhắn khách hàng` cần dùng:

* `useShopStore`
* `activeShopId`
* `SellerShopSelector`

Yêu cầu:

* Nếu user có nhiều shop thì phải chọn shop active.
* Conversation list đổi theo `activeShopId`.
* Thread đang mở phải thuộc shop active.
* Nếu chưa có `activeShopId`, hiển thị cảnh báo chọn shop trước khi xem tin nhắn.

### 8.2. Truyền `scope` và `shopId` xuống chat API

Trong `useChatCenter` hoặc hook tương đương:

Khi ở workspace:

```ts
listConversations({
  scope: 'workspace',
  shopId: activeShopId,
})
```

Khi ở main/user inbox:

```ts
listConversations({
  scope: 'main',
})
```

### 8.3. Gửi message với đúng actor

Khi ở workspace:

```ts
sendMessage(conversationId, {
  content,
  messageType: 'TEXT',
  actingAs: 'SHOP',
  shopId: activeShopId,
})
```

Khi ở storefront/main chat:

```ts
sendMessage(conversationId, {
  content,
  messageType: 'TEXT',
  actingAs: 'USER',
})
```

### 8.4. Sửa mapper chat

Không được xác định message của mình chỉ bằng `senderId === currentUserId`.

Mapper phải xét thêm:

* `scope`
* `activeShopId`
* `senderType`
* `senderUserId`
* `senderShopId`

Rule gợi ý:

Trong `scope=main`:

* Message của mình nếu `senderType=USER` và `senderUserId=currentUserId`.

Trong `scope=workspace`:

* Message của mình nếu `senderType=SHOP` và `senderShopId=activeShopId`.

### 8.5. Hiển thị rõ actor context

Trong workspace inbox cần hiển thị:

* Tên shop active.
* Badge: `Đang trả lời với tư cách shop`.
* Message bubble/label thể hiện tin nhắn đến từ `USER` hay `SHOP`.

## 9. Swagger/API docs

Nếu project có Swagger, cập nhật:

* `GET /conversations?scope=main`
* `GET /conversations?scope=workspace&shopId=...`
* `POST /conversations/:conversationId/messages`
* Body mới có `actingAs`, `shopId`
* Response message có `senderType`, `senderUserId`, `senderShopId`, `shopActor`
* Response conversation có `lastMessage.senderType`, `lastMessage.senderShopId`

## 10. Test bắt buộc

Thêm/cập nhật test chat.

Các case cần có:

1. Customer tạo shop conversation từ storefront.
2. Customer gửi message với `actingAs=USER`.
3. Owner shop reply với `actingAs=SHOP`.
4. Staff có `shop:chat_manage` reply với `actingAs=SHOP`.
5. Staff không có quyền chat bị chặn.
6. Staff shop B không được reply conversation shop A.
7. `GET /conversations?scope=main` chỉ trả inbox cá nhân.
8. `GET /conversations?scope=workspace&shopId=...` chỉ trả inbox của shop đó.
9. Message response có đủ `senderType`, `senderUserId`, `senderShopId`.
10. `lastMessage` lưu đúng actor.
11. Không truyền `actingAs` vẫn hoạt động như `USER` để backward compatible.
12. Owner tự chat shop của mình:

    * storefront message là `USER`
    * workspace reply là `SHOP`

Chạy tối thiểu:

```bash
npm test -- tests/chat.test.js --runInBand
git diff --check
```

Nếu test path khác thì chạy đúng test chat hiện tại, ví dụ:

```bash
npm test -- tests/integration/chat.test.js --runInBand
```

Nếu có lint:

```bash
npx eslint src --ext .js
```

Nếu lint toàn project fail do lỗi cũ, báo rõ lỗi nào ngoài scope.

## 11. Báo cáo sau khi sửa

Báo cáo theo format:

1. Endpoint đã thêm/sửa.
2. File đã chỉnh.
3. Model field đã thêm.
4. Contract request/response chính.
5. ACL đã enforce.
6. Test đã chạy và kết quả.
7. Những phần chưa làm được hoặc cần FE confirm.

Lưu ý:

* Không sửa phần cart/checkout/options.
* Không sửa RBAC matrix/category permission.
* Không đổi tên route cũ.
* Ưu tiên backward compatible.
* Không làm hỏng notification khi gửi chat message.
* Không làm hỏng direct chat hiện tại.

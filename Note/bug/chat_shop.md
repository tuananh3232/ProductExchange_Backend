# Phân tích lỗi chat workspace shop và hướng xử lý

## 1. Bối cảnh nghiệp vụ mong muốn

Hệ thống cần hỗ trợ mô hình tương tự `fanpage Facebook`:

- Một tài khoản cá nhân có thể tạo `nhiều shop`.
- Tài khoản cá nhân đó có thể dùng vai trò `khách hàng` để nhắn tin cho chính shop mình tạo.
- Khi vào `workspace` của từng shop, người dùng phải có thể `trả lời với tư cách shop đó`, không phải với tư cách tài khoản cá nhân.
- Nếu một người có nhiều shop, hệ thống phải biết rõ đang đứng ở `shop nào` để mở đúng hộp thư và trả lời đúng ngữ cảnh.
- Staff của shop cũng phải trả lời được với tư cách `shop`, không phải với tư cách `user cá nhân`.

Nói ngắn gọn:

- `storefront chat` là chat với vai trò `user cá nhân`
- `workspace chat` là chat với vai trò `shop/page`

Hiện tại hệ thống chưa tách được 2 vai trò này một cách đúng nghĩa.

---

## 2. Vấn đề hiện tại

### 2.1. Workspace chat chưa gắn với shop đang chọn

Hiện tại trang `Tin nhắn khách hàng` trong workspace chỉ render giao diện chat chung, nhưng không truyền `shopId` đang active vào logic lấy conversation hoặc gửi tin nhắn.

Hệ quả:

- Nếu một user có nhiều shop, hệ thống không biết đang rep dưới shop nào.
- Danh sách chat trong workspace có nguy cơ là danh sách tổng hợp không rõ context.
- Không thể đảm bảo câu trả lời được gửi với đúng “danh tính shop”.

### 2.2. Gửi tin nhắn hiện tại vẫn đang gửi bằng tài khoản cá nhân

Payload gửi tin nhắn hiện tại chỉ chứa:

- `content`
- `messageType`
- `attachments`

Không có:

- `shopId`
- `actingAs`
- `senderType`
- `workspaceContext`

Hệ quả:

- Backend chỉ có thể hiểu là `user` hiện tại đang rep.
- Không thể tạo mô hình “shop trả lời khách”.
- Message lưu xuống sẽ mang dấu vết của tài khoản cá nhân, không phải của shop.

### 2.3. Data model conversation/message chưa mô hình hóa actor kiểu page

Hiện tại `ApiChatMessage.senderId` đang là `ApiUser | string`.

Điều đó có nghĩa là:

- Người gửi đang được xem như `user`
- Chưa có khái niệm người gửi là `shop`
- Chưa có trường phân biệt `senderType = USER | SHOP`

Hệ quả:

- FE không thể hiển thị “Shop A đã trả lời”.
- Không thể audit chính xác ai đang rep với tư cách gì.
- Không phù hợp với nghiệp vụ nhiều shop/page.

### 2.4. Trường hợp chủ shop tự nhắn cho shop của mình bị sai ngữ cảnh

Ví dụ:

- User A tạo shop `Decor X`
- User A dùng tài khoản cá nhân vào trang sản phẩm của `Decor X`
- User A bấm `Chat với shop`

Trong trường hợp này:

- Ở storefront, user A phải là `customer`
- Ở workspace của `Decor X`, user A phải là `shop`

Nhưng hiện tại hệ thống đang dựa quá nhiều vào `currentUserId` để xác định vai trò trong conversation.

Hệ quả:

- Cùng một user id nhưng ở hai ngữ cảnh khác nhau lại không được phân biệt đúng.
- FE dễ render sai tiêu đề conversation.
- BE nếu cũng suy luận theo user id thì sẽ rep sai actor.

### 2.5. `scope = workspace` hiện tại gần như chỉ là nhãn UI

Hiện tại phần `ChatCenter` có `scope: 'main' | 'workspace'`, nhưng scope này chủ yếu mới dùng cho:

- cache key
- tiêu đề/trình bày giao diện

Chưa dùng để:

- filter API theo workspace
- gắn `shopId`
- gửi tin nhắn theo actor của shop
- tách biệt logic read/send/socket

Hệ quả:

- `main chat` và `workspace chat` đang cùng bản chất dữ liệu
- chỉ khác hình thức hiển thị
- chưa đạt mô hình page/shop inbox thực thụ

---

## 3. Các lỗi cụ thể phía FE

### 3.1. Không có bộ chọn shop trong trang inbox workspace

FE đã có sẵn:

- `shopStore` với `activeShopId`
- `SellerShopSelector` để chọn shop active

Nhưng trang `Tin nhắn khách hàng` chưa dùng chúng.

Điều này là lỗi FE rõ ràng vì:

- user có nhiều shop nhưng inbox workspace không cho chọn shop
- không hiển thị shop active đang được dùng để rep
- không có chỗ đổi context giữa các shop

### 3.2. Hook chat chưa truyền context workspace xuống API

Trong `useChatCenter`:

- `list conversations` không truyền `shopId`
- `sendMessage` không truyền `shopId`
- `markAsRead` không truyền `shopId`

Vấn đề này khiến FE không thể yêu cầu backend xử lý theo từng shop.

### 3.3. FE mapper conversation chưa nhận actor context

Mapper hiện tại đang suy luận:

- nếu `customer.id === currentUserId` thì coi như đang ở phía khách

Suy luận này không đủ cho nghiệp vụ page/shop vì:

- cùng một user có thể vừa là customer vừa là owner/staff
- vai trò phụ thuộc vào `context đang mở`, không phải chỉ phụ thuộc `user id`

### 3.4. FE chưa hiển thị rõ “đang trả lời với tư cách shop nào”

Trong mô hình fanpage, inbox cần thể hiện rõ:

- đang đứng ở page/shop nào
- đang reply với tư cách ai

Hiện tại chưa có:

- badge shop active
- header hiển thị shop hiện tại
- cảnh báo nếu chưa chọn shop

---

## 4. Các lỗi cụ thể phía BE

### 4.1. API chat chưa có context actor kiểu shop/page

Các API hiện tại thiếu khả năng biểu diễn:

- gửi tin nhắn với tư cách `shop`
- lấy danh sách conversation theo `shopId`
- phân quyền theo `shopId`

Nếu backend không nhận thêm context thì FE không thể tự sửa dứt điểm.

### 4.2. Model message chưa phân biệt `USER` và `SHOP`

Hiện tại sender mới có dạng gần giống:

- `senderId = user`

Trong mô hình đúng nên có ít nhất:

- `senderType: 'USER' | 'SHOP'`
- `senderUserId?: string`
- `senderShopId?: string`

Nếu không có các trường này:

- không thể lưu đúng actor gửi tin
- không thể render đúng transcript chat
- không thể làm inbox kiểu page

### 4.3. API list conversation chưa tách `main inbox` và `shop inbox`

Hiện backend cần hỗ trợ tối thiểu hai kiểu list:

- `main inbox`: conversation của user cá nhân
- `workspace inbox`: conversation thuộc một shop cụ thể

Nếu vẫn chỉ có một API chung không có filter theo `shopId/context`, dữ liệu sẽ luôn bị mơ hồ.

### 4.4. Backend chưa đủ ACL để chặn rep sai tư cách

Ví dụ:

- user có 2 shop A, B
- conversation thuộc shop A

Backend phải chặn:

- reply bằng tư cách shop B
- reply bằng tư cách shop nếu user không có quyền ở shop đó

Nếu BE chưa validate chặt:

- rất dễ phát sinh reply sai workspace
- sai audit log
- sai phân quyền staff/shop owner

---

## 5. Tác động nghiệp vụ nếu giữ nguyên

Nếu không sửa, hệ thống sẽ gặp các vấn đề:

- Chủ shop có nhiều shop nhưng không quản lý tách biệt inbox theo shop.
- Chủ shop tự nhắn shop của mình sẽ gây rối vai trò gửi/nhận.
- Staff rep khách hàng bằng danh nghĩa tài khoản cá nhân thay vì shop.
- Log message không thể truy vết đúng là ai rep, rep dưới shop nào.
- Sau này nếu mở rộng nhiều staff cùng xử lý inbox thì rất khó kiểm soát.
- Trải nghiệm không đạt mô hình `page inbox`, nên khó scale về quản trị vận hành.

---

## 6. Hướng xử lý đề xuất

## 6.1. Mục tiêu kiến trúc

Tách rõ 2 context chat:

### A. Chat storefront

- Actor gửi: `USER`
- Dùng khi user đang ở phần client thông thường
- Ví dụ: từ trang chi tiết sản phẩm bấm `Chat với shop`

### B. Chat workspace shop

- Actor gửi: `SHOP`
- Dùng khi owner/staff mở hộp thư trong workspace
- Rep với tư cách `shop/page`

Đây là mấu chốt quan trọng nhất.

---

## 6.2. Hướng xử lý BE

### 6.2.1. Cập nhật model conversation/message

Đề xuất bổ sung vào message:

```ts
type MessageActorType = 'USER' | 'SHOP'

type ChatMessage = {
  _id: string
  conversationId: string
  senderType: MessageActorType
  senderUserId?: string | null
  senderShopId?: string | null
  content: string
  messageType: 'TEXT' | 'IMAGE' | 'FILE'
  attachments: Attachment[]
  createdAt: string
  updatedAt: string
}
```

Đề xuất bổ sung vào conversation:

```ts
type Conversation = {
  _id: string
  type: 'DIRECT' | 'SHOP'
  shopId?: string | null
  customerId?: string | null
  participants?: string[]
  lastMessage?: {
    senderType?: 'USER' | 'SHOP'
    senderUserId?: string | null
    senderShopId?: string | null
    content?: string
    messageType?: 'TEXT' | 'IMAGE' | 'FILE'
    sentAt?: string | null
  }
}
```

### 6.2.2. Cập nhật API list conversation

Đề xuất:

```http
GET /conversations?scope=main
GET /conversations?scope=workspace&shopId=SHOP_ID
```

Ý nghĩa:

- `scope=main`: list conversation của user cá nhân
- `scope=workspace`: list conversation của một shop cụ thể

### 6.2.3. Cập nhật API gửi tin nhắn

Đề xuất:

```http
POST /conversations/:conversationId/messages
```

Payload:

```json
{
  "content": "Xin chào",
  "messageType": "TEXT",
  "actingAs": "SHOP",
  "shopId": "..."
}
```

Hoặc khi gửi từ storefront:

```json
{
  "content": "Xin chào shop",
  "messageType": "TEXT",
  "actingAs": "USER"
}
```

### 6.2.4. Thêm kiểm tra phân quyền backend

Khi `actingAs = SHOP`, backend phải kiểm tra:

- conversation có thuộc `shopId` đó không
- user hiện tại có phải `shop owner` của shop đó không
- hoặc user có phải `staff` có quyền xử lý inbox không

Nếu không đạt điều kiện thì reject request.

### 6.2.5. Cập nhật socket event

Event realtime nên trả thêm:

```json
{
  "senderType": "SHOP",
  "senderShopId": "..."
}
```

để FE render đúng actor khi message tới realtime.

---

## 6.3. Hướng xử lý FE

### 6.3.1. Thêm chọn shop trong trang inbox workspace

Trang `Tin nhắn khách hàng` cần dùng:

- `useShopStore`
- `activeShopId`
- `SellerShopSelector`

Yêu cầu UI:

- nếu có nhiều shop active thì bắt buộc chọn shop
- conversation list phải đổi theo `activeShopId`
- thread đang mở cũng phải thuộc shop đã chọn

### 6.3.2. Truyền `shopId` và `scope` xuống API

Trong `useChatCenter`, khi `scope = workspace` cần truyền:

- `scope=workspace`
- `shopId=activeShopId`

vào các action:

- list conversations
- get messages
- send message
- mark as read

### 6.3.3. Gửi message với đúng actor context

Khi ở workspace:

```ts
sendMessage(conversationId, {
  content,
  actingAs: 'SHOP',
  shopId: activeShopId,
})
```

Khi ở storefront:

```ts
sendMessage(conversationId, {
  content,
  actingAs: 'USER',
})
```

### 6.3.4. Cập nhật mapper chat

Mapper không nên chỉ dựa vào `currentUserId`.

Cần dựa thêm:

- `scope`
- `activeShopId`
- `senderType`
- `senderShopId`

để xác định đúng:

- conversation title
- subtitle
- label “shop trả lời”
- bubble trái/phải

### 6.3.5. Hiển thị rõ ngữ cảnh reply

Trong workspace inbox nên có:

- tên shop active
- badge `Đang trả lời với tư cách shop`
- cảnh báo nếu chưa chọn shop

Ví dụ:

- `Shop đang xử lý: Decor X`
- `Bạn đang trả lời với tư cách shop này`

### 6.3.6. Xử lý owner tự chat shop của mình

FE phải coi đây là hai context khác nhau:

- `/messages`: user cá nhân
- `/shop/messages`: shop workspace

Không được dùng chung một rule suy luận actor chỉ dựa trên user id.

---

## 7. Đề xuất lộ trình triển khai

## Giai đoạn 1: Sửa backend contract

- Bổ sung `senderType`, `senderShopId`
- Bổ sung `actingAs`, `shopId` cho send message
- Bổ sung filter `scope`, `shopId` cho list conversation
- Bổ sung ACL theo shop

## Giai đoạn 2: Sửa FE workspace inbox

- Gắn `SellerShopSelector` vào workspace messages
- Truyền `activeShopId` vào hook chat
- Chỉ load conversation của shop active
- Gửi message với `actingAs: SHOP`

## Giai đoạn 3: Hoàn thiện UX

- Badge shop active
- Header actor context
- Tối ưu trường hợp owner chat shop của chính mình
- Bổ sung test cho multi-shop và self-chat

---

## 8. Kết luận

Lỗi hiện tại không phải chỉ là lỗi giao diện.

Đây là lỗi ở cả:

- `thiết kế actor chat`
- `contract API`
- `phân quyền workspace`
- `hiển thị ngữ cảnh FE`

Nếu chỉ sửa FE để “cho chọn shop” nhưng backend vẫn lưu sender là user cá nhân thì bài toán vẫn chưa đúng.

Muốn đạt mô hình giống `fanpage Facebook`, bắt buộc phải:

- cho phép `chat với tư cách shop`
- tách biệt `user inbox` và `shop inbox`
- gắn mọi action chat workspace với `shopId` cụ thể

---

## 9. Tóm tắt ngắn gọn cho dev FE

Những gì FE có thể kết luận chắc chắn ngay bây giờ:

- FE hiện tại chưa cho chọn shop trong inbox workspace.
- FE hiện tại chưa truyền `shopId` khi list/send/mark read chat workspace.
- FE hiện tại chưa có cơ chế gửi tin với tư cách `shop`.
- Backend hiện tại cũng chưa expose contract đủ để hỗ trợ page/shop actor đúng nghĩa.

Nói cách khác:

- `Lỗi FE`: thiếu chọn workspace shop và thiếu context khi gọi chat API
- `Lỗi BE`: thiếu actor model + thiếu API context + thiếu ACL theo shop


# Báo cáo đánh giá Backend ProductExchange cho MVP sàn thương mại điện tử

**Ngày đánh giá:** 14/07/2026  
**Phạm vi:** `E:\Code_Ky8\EXE201\ProductExchange_Backend`  
**Mục tiêu:** đánh giá nghiệp vụ hiện tại, tính đúng đắn của các luồng xử lý và phần còn thiếu để có thể phát hành MVP sàn thương mại điện tử. Phần frontend không nằm trong phạm vi báo cáo này.

---

## 1. Kết luận điều hành

Backend hiện tại là một **prototype có độ phủ tính năng rộng**, không còn là CRUD đơn giản. Hệ thống đã có tài khoản, xác thực email/Google, KYC, shop và staff, RBAC, sản phẩm, giỏ hàng, đơn hàng, PayOS/VNPay, ví người dùng, ví shop, ledger, rút tiền, đánh giá, chat, thông báo, trao đổi, cho thuê, VIP, admin và room visualizer.

Tuy nhiên, backend **chưa phù hợp để phát hành MVP có giao dịch tiền thật**. Nguyên nhân không phải thiếu nhiều màn hình hay API, mà do các bất biến quan trọng của marketplace đang bị vi phạm:

1. PayOS return URL có thể đánh dấu đơn đã thanh toán chỉ dựa vào query trả về, không xác minh lại với PayOS.
2. Tiền shop được ghi có ngay khi người mua thanh toán, trái với mô hình escrow được mô tả là chỉ giải ngân sau khi giao hàng.
3. Tồn kho và giữ chỗ không an toàn; có thể tạo nhiều đơn cho cùng một sản phẩm, `stock` không được trừ, và sản phẩm có số lượng lớn hơn 1 không được vận hành đúng.
4. Các thao tác ví/ledger quan trọng chưa có transaction và idempotency đủ chặt, có nguy cơ trừ/hoàn/ghi có tiền hai lần hoặc lệch số dư khi một bước trung gian lỗi.
5. Luồng hoàn tiền qua cổng thanh toán mới dừng ở `refund_pending`, chưa thực hiện refund thật, chưa có trạng thái hoàn tất và đối soát đầy đủ.
6. Seller cá nhân có thể bán nhưng tiền bán bị giữ trong ledger mà không có luồng giải ngân cho seller.

**Khuyến nghị Go/No-Go:** `NO-GO` cho production hoặc pilot dùng tiền thật. Có thể dùng để demo nội bộ với dữ liệu giả sau khi khóa các endpoint thanh toán nhạy cảm. Muốn đạt MVP, cần ưu tiên hoàn thiện lõi mua–bán–thanh toán–giao hàng–hoàn tiền–đối soát trước; trao đổi, cho thuê, VIP và room visualizer nên tạm coi là ngoài phạm vi phát hành đầu tiên.

---

## 2. Phương pháp và phạm vi kiểm tra

Đánh giá được thực hiện trên các lớp route, controller, service, repository, model, validation, middleware, scheduler và test hiện có. Trọng tâm là:

- Kiểm kê toàn bộ miền nghiệp vụ đang được expose qua API.
- Đọc state machine và các phép ghi dữ liệu của từng luồng.
- Theo dấu xuyên suốt từ sản phẩm → giỏ hàng → đơn → thanh toán → ledger → ví → rút tiền → hoàn tiền.
- Kiểm tra quyền truy cập, KYC, shop/staff, callback thanh toán và dữ liệu nhạy cảm.
- Đối chiếu với những năng lực tối thiểu của một marketplace MVP.
- Chạy kiểm tra tĩnh và unit test hiện có.

Kết quả kiểm tra kỹ thuật:

- `npm run test:unit`: **7/7 suite, 85/85 test passed**.
- `npm run lint`: **failed với 392 error và 9 warning**. Phần lớn error là lệch quy tắc dấu chấm phẩy, nhưng việc CI không xanh vẫn là rủi ro phát hành.
- Không chạy integration test vì bộ test sử dụng MongoDB thật và có thao tác xóa dữ liệu trong database test; tại thời điểm audit không có một môi trường test biệt lập được xác nhận để cho phép mutation.

Lưu ý: unit test pass chỉ chứng minh các case đã viết; nó không phủ các race condition, callback giả mạo, transaction failure và luồng xuyên miền được nêu trong báo cáo.

---

## 3. Bản đồ tính năng hiện có

| Miền | Năng lực hiện có | Đánh giá ngắn |
|---|---|---|
| Auth/User | Đăng ký, email OTP, login, Google login, refresh token, logout, quên/đặt lại mật khẩu, hồ sơ, avatar | Khá đầy đủ cho MVP |
| KYC | Người dùng gửi CCCD, admin duyệt/từ chối, cấp role seller/shop owner theo luồng | Có nền tảng; còn thiếu kiểm soát dữ liệu nhạy cảm và vận hành |
| RBAC | Role/permission từ DB, admin bypass, quyền theo shop, owner/staff | Tốt về ý tưởng, cần kiểm thử ma trận toàn diện |
| Shop | Draft, submit review, approve/reject/suspend, quota theo VIP, chuyển owner, staff/invitation/permission | Phủ rộng; có vài vấn đề liên kết với catalog/order |
| Catalog | Category, sản phẩm shop/seller, hình ảnh, tìm kiếm/lọc, điều kiện, trạng thái, visual assets | Đủ cho catalog đơn giản; thiếu SKU/variant và tồn kho chuẩn |
| Cart/Checkout | Giỏ hàng, thêm combo, cập nhật số lượng, chọn item checkout, tạo nhiều order | Chưa an toàn và checkout nhiều order qua cổng chưa hoàn chỉnh |
| Order | Tạo, xác nhận, processing, shipped, delivered, cancel, history, admin action | State machine cơ bản có, nhưng fulfillment/return/escrow sai hoặc thiếu |
| Payment | VNPay, PayOS, callback/webhook, payment record, wallet payment | Có lỗ hổng PayOS return và idempotency chưa đủ |
| User wallet | Top-up PayOS, thanh toán đơn, thanh toán nhiều đơn, hoàn ví, rút tiền | Rộng nhưng transaction boundary và idempotency chưa đạt chuẩn tài chính |
| Shop wallet | Ghi có doanh thu, lịch sử, yêu cầu rút, admin duyệt/từ chối/hoàn tất | Có, nhưng đang nhận tiền quá sớm so với escrow |
| Fee/Ledger | Chính sách phí, snapshot, platform wallets, ledger entries, reconciliation view/export | Nền tảng tốt; posting time và tính nguyên tử đang sai |
| Review | Chỉ buyer của order delivered được review; rating aggregate; reply | Phù hợp MVP cơ bản |
| Chat/Notification | Direct/shop conversation, socket, unread/read, notification | Phù hợp hỗ trợ giao dịch; chưa phải blocker |
| Exchange | Offer/counter/accept, tiền bù, ship/receive, dispute/admin resolve | Chức năng nâng cao, nhiều phép ghi tiền không nguyên tử |
| Rental | Listing, booking, overlap check, wallet hold, handover/return, claim, admin settle | Rất rộng nhưng phức tạp, race condition và ledger risk cao |
| Subscription/VIP | Gói tháng/năm, PayOS/wallet, kích hoạt VIP, quota shop | Có cùng rủi ro transaction/idempotency của ví |
| Room visualizer | Project/scene/calibration/placement/visual asset, VIP gate | Tính năng bổ trợ, không thuộc lõi commerce MVP |
| Admin/Reporting | User/KYC/shop/product/order/payment/withdrawal, audit, stats, reports, ledger | Độ phủ tốt; cần dữ liệu đúng trước khi dashboard có giá trị |

---

## 4. Luồng mua bán thực tế đang chạy

Luồng hiện tại có dạng:

1. Buyer thêm sản phẩm vào cart hoặc gọi tạo order trực tiếp.
2. `createOrder` lấy giá hiện tại của product, tạo một order cho một product, sau đó đổi toàn bộ product sang `pending`.
3. Buyer thanh toán bằng ví, VNPay hoặc PayOS.
4. Khi thanh toán thành công, `settlePaidOrder` tính phí và:
   - ghi tăng platform clearing;
   - tách phí sang platform revenue;
   - ghi giảm clearing;
   - ghi tăng ngay ví shop nếu order thuộc shop.
5. Shop xác nhận, xử lý, giao và tự đánh dấu `delivered`.
6. Khi `delivered`, code chỉ đổi product sang `sold`; không có bước release escrow vì tiền đã được chuyển từ bước 4.
7. Shop có thể yêu cầu rút số dư đã được ghi có.

Luồng này mâu thuẫn trực tiếp với mô tả kiến trúc trong `CLAUDE.md`: buyer trả trước, platform giữ tiền và seller/shop chỉ được nhận sau `DELIVERED`.

Luồng đúng tối thiểu nên là:

`order created` → `inventory reserved` → `payment authorized/captured` → `escrow held` → `seller confirms` → `shipment` → `buyer confirms delivery hoặc auto-complete` → `settlement released` → `withdrawable balance`.

Nếu cancel/refund/dispute trước settlement, tiền phải quay về nguồn thanh toán hoặc ví buyer mà không cần thu hồi từ số dư khả dụng của shop.

---

## 5. Phát hiện mức P0 — bắt buộc sửa trước khi dùng tiền thật

### P0-01. PayOS return URL có thể tự đánh dấu thanh toán thành công

**Bằng chứng**

- Route công khai: `src/routes/payment/payment.route.js:116` và `:128` gọi cùng controller return/cancel, không yêu cầu authenticate.
- `src/services/payment/payment.service.js:695-735` lấy `orderCode`, `cancel`, `code` trực tiếp từ query.
- Nếu payment đang `pending_payment`, `code === '00'` được chuyển thành `paid`, order được cập nhật và ledger được settlement.
- Không có verify signature và không gọi `payos.paymentRequests.get(orderCode)` trong luồng order payment này. Trong khi top-up (`:638-690`) và subscription (`subscription.service.js:173-215`) đã có bước query lại PayOS.

**Tác động**

Người biết hoặc đoán được `orderCode` có thể gọi return URL với `code=00`, làm đơn thành paid và kích hoạt ghi có ví shop mà không có tiền thật. Đây là lỗ hổng trực tiếp gây thất thoát tài chính.

**Yêu cầu sửa/tiêu chí nghiệm thu**

- Return URL chỉ dùng để điều hướng UX, tuyệt đối không phải nguồn sự thật tài chính.
- Chỉ webhook đã verify signature hoặc server-to-server query PayOS mới được chuyển sang `paid`.
- So khớp `orderCode`, amount, currency, trạng thái, merchant account và payment record.
- Test bắt buộc: query giả `code=00` không thay đổi payment/order/ledger; replay callback không tạo thêm ledger.

### P0-02. Escrow bị phá vỡ: shop nhận tiền ngay khi buyer thanh toán

**Bằng chứng**

- `src/services/payment/payment.service.js:367-369`, `:494-504`, `:727-734` gọi `ledgerService.settlePaidOrder` ngay khi payment được coi là paid.
- `src/services/user-wallet/user-wallet.service.js:138` và `:219` cũng gọi settlement ngay sau khi trừ ví buyer.
- `src/services/ledger/ledger.service.js:258-375` đặt `SETTLED` cho order thuộc shop, trừ clearing và tăng `Wallet.balance` ngay lập tức.
- `src/services/order/order.service.js:466-468` khi delivered chỉ đổi product sang `sold`, không release settlement.
- Shop wallet cho phép tạo withdrawal từ `balance` hiện có.

**Tác động**

Shop có thể rút tiền trước khi giao hàng. Khi buyer hủy hoặc admin refund, hệ thống phải cố thu hồi từ ví shop; nếu shop đã rút hoặc không đủ số dư, reversal lỗi. Đây không còn là escrow và tạo nghĩa vụ bù tiền cho platform.

**Yêu cầu sửa/tiêu chí nghiệm thu**

- Payment success chỉ tạo ledger transaction `HELD` và tăng clearing/escrow liability; chưa tăng withdrawable shop balance.
- Release settlement chỉ chạy một lần sau buyer confirm delivery hoặc auto-complete có thời hạn.
- Có `availableBalance` và `pendingBalance`/held riêng cho shop.
- Dispute/return phải đóng băng settlement.
- Không cho withdrawal lấy từ pending/held balance.

### P0-03. Các phép ghi ví và ledger không có transaction boundary an toàn

**Bằng chứng**

- Wallet payment đơn: trừ ví ở `user-wallet.service.js:96-103`, sau đó mới update order (`:107-113`), tạo transaction (`:115-125`) và tạo ledger (`:138`). Bất kỳ bước sau nào lỗi đều có thể làm mất tiền nhưng order chưa paid hoặc thiếu chứng từ.
- Wallet payment nhiều order có cùng vấn đề tại `:170-219`.
- Refund kiểm tra tồn tại trước, sau đó credit ví và mới tạo transaction (`:226-251`); hai request đồng thời có thể cùng qua bước kiểm tra.
- Top-up credit có pattern tương tự tại `:446-468`.
- Yêu cầu rút tiền trừ balance trước rồi mới tạo withdrawal (`:264-301`); tạo record lỗi sẽ giữ tiền không có hồ sơ.
- Shop withdrawal có cùng pattern tại `wallet.service.js:101-142`.
- `runMongoTransaction` tại `src/utils/mongo-transaction.util.js:21-27` tự fallback chạy không session nếu MongoDB không hỗ trợ transaction. Với nghiệp vụ tiền, fallback này làm mất đảm bảo atomicity.
- `UserWalletTransaction` không có unique compound index cho `(order,type)` hoặc `topup`, nên idempotency bằng “find trước rồi create” không chống được concurrency.

**Tác động**

Có thể double charge, double refund, double top-up credit, số dư lệch lịch sử, hoặc transaction/ledger thiếu một nửa khi service crash/network error.

**Yêu cầu sửa/tiêu chí nghiệm thu**

- Production bắt buộc Mongo replica set/transaction; tiền không được fallback non-transaction.
- Mỗi command tài chính có idempotency key và unique index ở DB.
- Dùng conditional update theo trạng thái hiện tại, không chỉ đọc rồi ghi.
- Balance update, business state, wallet transaction và ledger entries nằm trong cùng transaction.
- Có reconciliation job phát hiện và sửa/đưa vào manual review các giao dịch lệch.
- Test concurrency: 10 request thanh toán/hoàn/top-up đồng thời chỉ phát sinh một kết quả tài chính.

### P0-04. Tồn kho và reservation không đúng

**Bằng chứng**

- Product có `stock`, cart có kiểm tra stock, nhưng `order.service.js:153-216` không select `stock`, không kiểm tra `quantity <= stock`, không trừ stock.
- Sau khi tạo order, toàn bộ product được đổi sang `pending` (`:216`) bất kể stock là 1 hay 100.
- Kiểm tra status và tạo order là hai thao tác rời, không atomic. Hai request đồng thời có thể cùng thấy `available` và cùng tạo order.
- Cancel đổi product về `available` không xét có order khác đang active/paid (`:425`, `:470-472`).
- Delivered đổi product thành `sold` thay vì giảm stock theo quantity (`:466-468`).

**Tác động**

Oversell khi concurrent, không bán được nhiều đơn cho sản phẩm stock > 1, trạng thái sản phẩm sai sau cancel và không có cơ chế hết hạn giữ hàng khi buyer không thanh toán.

**Yêu cầu sửa/tiêu chí nghiệm thu**

- Xác định rõ mô hình: mỗi listing là hàng độc bản (`stock=1`) hoặc hàng nhiều số lượng. Không trộn hai mô hình.
- Nếu nhiều số lượng: có `availableStock`, `reservedStock`, atomic reserve với điều kiện đủ hàng, release khi timeout/cancel, deduct khi paid/confirmed theo policy.
- Reservation có `expiresAt` và background job idempotent.
- Không dùng product status `pending` để đại diện cho reservation của một order.
- Test concurrent checkout và payment timeout.

### P0-05. Hoàn tiền cổng thanh toán chưa hoàn chỉnh và có thể làm trạng thái dở dang

**Bằng chứng**

- Cancel order paid bằng VNPay/PayOS chỉ đặt `refund_pending` (`order.service.js:413-420`).
- `refundAdminOrder` với gateway cũng chỉ đặt `refund_pending` cho order/payment (`:519-546`), không gọi refund API, không có refund entity, amount, provider refund id, completed/failed state.
- `PAYMENT_STATUS` không có `refunded`.
- Trong cancel, order đã được đổi thành `cancelled` trước khi `reverseOrderSettlement` chạy (`:423-428`). Nếu reversal lỗi do ví shop thiếu tiền, request lỗi nhưng order đã cancel và ledger chưa đảo.

**Tác động**

Người dùng không thực sự nhận lại tiền, vận hành không biết refund nào đã chuyển, và dữ liệu có thể ở trạng thái nửa hoàn tất.

**Yêu cầu sửa/tiêu chí nghiệm thu**

- Có `Refund`/`PaymentAdjustment` model riêng: requested, processing, succeeded, failed, manual_required; amount, reason, provider reference, evidence, timestamps.
- Tích hợp refund provider nếu khả dụng; nếu manual thì workflow và bằng chứng chuyển khoản bắt buộc.
- Chỉ đóng order/refund sau khi command được ghi nhận nguyên tử; retry không tạo refund thứ hai.
- Reversal phải lấy tiền từ escrow held nếu chưa settlement; không phụ thuộc ví shop trong giai đoạn đó.

---

## 6. Phát hiện mức P1 — cần hoàn thiện để MVP vận hành đúng

### P1-01. Seller cá nhân bán được nhưng không có đường nhận tiền

`ledger.service.js:258-259` chỉ settlement vào wallet khi `order.shop` tồn tại. Order seller cá nhân được đặt `HELD`, nhưng không có release vào user wallet của seller khi delivered. Điều này làm mô hình `SELLER` không hoàn thành vòng đời.

**Quyết định cần chốt:** MVP chỉ cho shop bán, hoặc hỗ trợ seller cá nhân đầy đủ. Nếu hỗ trợ, cần seller settlement account, pending/available balance, KYC, withdrawal và tax/audit tương đương shop.

### P1-02. Shop tự đánh dấu delivered; buyer không có xác nhận nhận hàng

State update do phía shop thực hiện. Không có:

- mã vận đơn/carrier/tracking events;
- bằng chứng giao hàng;
- buyer `confirm-received`;
- cửa sổ khiếu nại;
- auto-complete job;
- chống shop tự chuyển nhanh từ confirmed → processing → shipped → delivered.

Nếu settlement sửa về đúng thời điểm delivered mà vẫn giữ quyền như hiện tại, shop có thể tự giải ngân. MVP cần buyer confirmation hoặc carrier confirmation + thời gian chờ, và dispute phải chặn release.

### P1-03. Checkout nhiều sản phẩm qua VNPay/PayOS chưa hoạt động

`cart.service.js:255-270` với nhiều order chỉ đổi các order sang `pending_payment`; không tạo `Payment`, không tạo payment URL và không gọi API batch nào. Response không có cách để buyer hoàn tất thanh toán. Trong khi model/payment webhook có hỗ trợ `orders[]`, không có service tạo batch payment tương ứng.

Wallet có endpoint thanh toán nhiều order, nhưng checkout cart hiện cũng không gọi `payOrdersWithWallet`; nó chỉ đánh dấu pending cho nhiều order. Đây là lỗi chức năng trực tiếp.

### P1-04. Checkout không atomic

Cart checkout tạo order tuần tự (`cart.service.js:231-240`). Nếu item thứ ba lỗi, hai order đầu đã tạo và product đã `pending`; cart chưa được cập nhật. Nếu tạo payment link lỗi, orders vẫn tồn tại và sản phẩm bị giữ. Cần transaction/saga với trạng thái checkout và khả năng rollback/retry.

### P1-05. Payment attempt và retry chưa được mô hình hóa đúng

- Payment model có unique sparse index trên `order`, nên mỗi order chỉ có một payment record.
- Khi đổi phương thức, code update record cũ và có thể tái sử dụng transaction reference không tương thích.
- `createPayosPayment` parse `existingPayment.transactionRef`; nếu record cũ là VNPay, parse có thể cho `NaN`.
- Callback lặp có thể ghi đè status của Payment từ paid thành failed/cancelled; order có một số guard không downgrade, nhưng payment và order/ledger sẽ lệch.
- `Date.now() % 1_000_000_000` có nguy cơ collision và không phải idempotency key nghiệp vụ.

MVP cần `PaymentAttempt` nhiều bản ghi cho một order/order group, terminal-state guard và unique provider reference.

### P1-06. Order model quá mỏng cho một giao dịch thương mại điện tử

Mỗi order chỉ có một product; thiếu order item snapshot đầy đủ. Các dữ liệu còn thiếu hoặc chưa chuẩn:

- tên/SKU/hình/thuộc tính sản phẩm tại thời điểm mua;
- người nhận và số điện thoại;
- địa chỉ chuẩn hóa đầy đủ;
- shipping method, shipping fee, tracking code;
- subtotal, discount, tax, grand total;
- seller/shop snapshot;
- cancellation actor/reason chuẩn hóa;
- fulfillment và return riêng.

Hiện admin detail còn hard-code `discount: 0`, `shipping: 0`, cho thấy dữ liệu chưa tồn tại thực chất.

### P1-07. Shop suspended vẫn có thể còn sản phẩm công khai và nhận order

Public product query chỉ lọc product `isActive/status`; không ràng buộc shop phải `active`. `createOrder` cũng không load/check shop status. Khi admin suspend shop, không có cascade hide/block checkout. Cần chặn checkout và xác định cách xử lý order đang mở.

### P1-08. Không có return/dispute cho đơn mua bán thông thường

Exchange/rental có dispute, nhưng order sale không có yêu cầu trả hàng, bằng chứng, seller response, admin resolution, partial refund hoặc reason policy. Cancel chỉ hợp lệ đến `processing`; sau shipped buyer không có cơ chế khiếu nại chuẩn.

MVP marketplace tối thiểu cần dispute/return đơn giản, kể cả giai đoạn đầu xử lý thủ công bởi admin.

### P1-09. Job nền không phù hợp triển khai nhiều instance

Scheduler dùng `setInterval` trong mỗi process, không có distributed lock, retry queue, dead-letter hay job history. Khi scale nhiều instance, rental maintenance có thể chạy trùng. Hệ thống cũng chưa có job cho payment expiry, inventory reservation expiry, auto-complete delivery, settlement, refund retry và reconciliation.

### P1-10. Các module exchange/rental/subscription có cùng rủi ro tài chính

Exchange và rental trực tiếp trừ/ghi có user wallet, platform wallet, ledger entry và cập nhật entity qua nhiều lệnh không transaction. Overlap booking là “check rồi create”, nên hai booking đồng thời vẫn có thể trùng lịch. Subscription wallet trừ tiền trước rồi mới tạo order/transaction/kích hoạt VIP. Các module này không nên đưa vào MVP tiền thật trước khi nền tảng money command/idempotency dùng chung được hoàn thiện.

---

## 7. Phát hiện mức P2 — chất lượng, bảo mật và vận hành

### 7.1. Lint/format và encoding không đồng nhất

Lint hiện fail 392 lỗi. Nhiều file dùng semicolon trong khi ESLint cấm; một số text hiển thị mojibake khi đọc theo môi trường hiện tại và có thông báo không dấu như `Gio hang dang trong`. Cần chuẩn UTF-8 thống nhất và CI bắt buộc lint/test xanh.

### 7.2. Upload chỉ tin vào MIME do client gửi

`upload.middleware.js` chỉ kiểm tra `file.mimetype.startsWith('image/')`. Cần kiểm tra magic bytes, decode/re-encode ảnh, giới hạn pixel, loại metadata, chống image bomb và có policy riêng cho ảnh KYC.

### 7.3. Dữ liệu KYC và ngân hàng cần governance rõ

Hệ thống có masking ở một số list response, nhưng cần kiểm tra toàn bộ detail/export/log, quyền xem ảnh CCCD, thời hạn lưu, xóa dữ liệu, audit truy cập, URL private/signed và mã hóa dữ liệu nhạy cảm. Đây là yêu cầu vận hành và tuân thủ, không chỉ UI.

### 7.4. Cấu hình production chưa fail-fast đủ

Production chỉ bắt buộc Mongo/JWT secrets. Payment, Cloudinary, SMTP và allowed origins có thể thiếu nhưng server vẫn khởi động một phần. RBAC seed lỗi chỉ log rồi tiếp tục. Với MVP nên có validation theo feature flag và readiness check cho DB/dependency.

### 7.5. HTTP/observability chưa sẵn sàng

- `morgan('dev')` được dùng cả production; chưa có structured logs/correlation id.
- Health check chỉ trả `ok`, không kiểm tra DB, queue/job, provider config.
- Chưa thấy metrics/alert cho callback failure, ledger drift, refund pending lâu, stuck settlement.
- API docs bật CSP off cho toàn app thay vì cấu hình riêng cho Swagger.
- Chưa có 404 JSON middleware thống nhất theo error contract.

### 7.6. Rate limiting chưa phù hợp webhook và tài khoản

Global limiter đếm failed requests theo IP. Webhook payment dùng chung limiter có thể bị làm nhiễu/DoS; auth limiter thuần IP có thể ảnh hưởng người dùng chung NAT và chưa có limit theo email/account/device. Cần policy riêng cho callback, login và money command.

### 7.7. Documentation và code bị lệch

Swagger order ghi rằng ví shop được cộng khi delivered, nhưng code cộng khi paid. README rất ngắn so với hệ thống. Tài liệu state machine, invariants, webhook contract và runbook chưa có nguồn sự thật duy nhất.

### 7.8. Test coverage chưa tập trung vào rủi ro cao nhất

Unit test hiện có chủ yếu cho conversation, subscription, ledger, shop, fee và eligibility. Còn thiếu test trực tiếp cho:

- PayOS return giả mạo/replay;
- concurrency payment/refund/top-up/withdrawal;
- inventory reservation/oversell;
- escrow hold/release;
- batch checkout/payment;
- rollback khi bước giữa lỗi;
- shop suspend trong khi có order;
- refund provider và reconciliation.

---

## 8. Những gì còn thiếu để hoàn thiện MVP

### 8.1. Phạm vi MVP đề xuất

Để giảm rủi ro, MVP nên chỉ gồm:

1. Buyer account + email verification.
2. Seller/shop onboarding + KYC + admin approval.
3. Catalog sản phẩm bán (`sell`) và tồn kho rõ ràng.
4. Cart + checkout.
5. Một cổng thanh toán chính (ưu tiên PayOS) và có thể wallet nếu ledger đã an toàn.
6. Order fulfillment, tracking thủ công, buyer confirm received.
7. Escrow hold/release, phí platform, shop payout.
8. Cancel trước ship; return/dispute/refund tối thiểu sau ship.
9. Review sau completed.
10. Admin vận hành: order/payment/refund/dispute/payout/reconciliation/audit.

Tạm tắt bằng feature flag khỏi production MVP:

- exchange;
- rental;
- subscription/VIP payment;
- room visualizer;
- personal seller sale nếu chưa có settlement/payout riêng;
- VNPay nếu không đủ nguồn lực bảo trì đồng thời hai provider.

### 8.2. Domain model tối thiểu cần bổ sung/chỉnh sửa

**OrderGroup/Checkout**

- Một checkout có thể tách thành nhiều order theo shop.
- Có idempotency key và trạng thái `created/payment_pending/paid/expired/failed`.

**Order + OrderItem**

- Nhiều item hoặc ít nhất item snapshot chuẩn.
- Giá, tên, SKU, hình, thuộc tính, quantity tại thời điểm mua.
- Amount breakdown: subtotal, discount, shipping, tax, total.
- Recipient/address/phone snapshot.

**InventoryReservation**

- product/SKU, quantity, checkout/order, expiresAt, status.
- Atomic reserve/release/consume.

**PaymentAttempt**

- Nhiều attempt trên một checkout/order group.
- Provider, method, idempotency key, amount, currency, provider reference, terminal state, verified payload hash.

**Fulfillment/Shipment**

- carrier, tracking code, shippedAt, deliveredAt, proof, history.

**Settlement**

- held amount, fee snapshot, releaseAt, releasedAt, dispute hold.
- Tách pending và available balance.

**Refund/Return/Dispute**

- Return request, evidence, response, resolution.
- Refund amount, source, provider status, provider reference, retries.

**Payout/Withdrawal**

- Chỉ dùng available balance.
- Unique command/idempotency, maker-checker nếu có thể, evidence và reconciliation.

### 8.3. State machine MVP đề xuất

**Order**

`payment_pending` → `paid_held` → `seller_confirmed` → `processing` → `shipped` → `delivered_pending_confirmation` → `completed`

Nhánh lỗi:

- `payment_pending` → `expired/cancelled` và release inventory.
- Trước shipped → `cancelled` + refund/release hold.
- Sau shipped → `return_requested/disputed` → `refunded/partially_refunded/completed`.

**Payment**

`created` → `pending` → `succeeded | failed | cancelled | expired`

Terminal state không được downgrade bởi callback lặp.

**Settlement**

`pending` → `held` → `released | refunded | disputed`

Không dùng `settled` tại thời điểm payment capture.

**Refund**

`requested` → `processing` → `succeeded | failed | manual_required`

### 8.4. Yêu cầu phi chức năng tối thiểu

- MongoDB production chạy replica set và transaction bắt buộc.
- Idempotency key cho checkout, payment callback, wallet command, refund, settlement, withdrawal.
- Unique indexes tương ứng với business command.
- Structured log + request/correlation id.
- Metrics/alert cho payment/refund/ledger/reconciliation.
- Daily automated reconciliation giữa payment provider, payment DB, order, ledger và wallet.
- Backup/restore drill và migration strategy.
- CI: lint, unit, integration, security scan; không deploy nếu fail.
- Secrets management; không dùng default secret/provider credential ở production.
- Runbook cho callback mất, refund manual, ledger drift và payout lỗi.

---

## 9. Backlog ưu tiên làm cơ sở lập kế hoạch

### Nhóm A — Security stop-the-bleeding

1. Vô hiệu hóa việc cập nhật paid từ PayOS return/cancel query.
2. Chỉ webhook verified/server query được ghi nhận payment success.
3. Khóa withdrawal từ số dư phát sinh trước khi escrow được sửa.
4. Thêm feature flags để tắt exchange/rental/subscription payment ở production MVP.

### Nhóm B — Commerce core correctness

1. Chốt mô hình inventory và xây reservation atomic.
2. Thiết kế lại checkout/order group/order item snapshot.
3. Xây payment attempt + idempotent callback.
4. Sửa ledger thành hold lúc paid, release lúc completed.
5. Bổ sung buyer confirm received/auto-complete/dispute window.
6. Xây refund entity và workflow thật.
7. Hoàn thiện settlement cho seller cá nhân hoặc loại khỏi MVP.

### Nhóm C — Financial safety

1. Đưa toàn bộ wallet/ledger command vào transaction.
2. Bỏ fallback non-transaction cho production money flow.
3. Unique indexes chống duplicate command.
4. Reconciliation job và admin exception queue.
5. Phân tách pending/available balance.
6. Harden withdrawal/payout và evidence.

### Nhóm D — Operations and quality gate

1. Sửa lint và chuẩn hóa UTF-8.
2. Viết test P0/P1, đặc biệt concurrency và replay.
3. Dedicated test DB trong CI; chạy integration serial.
4. Structured logging, readiness, metrics, alerts.
5. Security hardening upload/KYC/callback/rate limit.
6. Đồng bộ Swagger, state machine và runbook.

---

## 10. Tiêu chí “Backend MVP Ready”

Backend chỉ nên được coi là sẵn sàng khi đạt đồng thời:

- Không thể tạo `paid` nếu provider chưa xác nhận hợp lệ.
- Một payment/callback replay chỉ tạo một payment success và một ledger hold.
- Không oversell trong test concurrent.
- Buyer payment được giữ, shop không rút được trước completed.
- Completed chỉ xảy ra qua buyer/carrier/auto-complete có dispute window.
- Cancel/refund trả tiền đúng một lần và có trạng thái theo dõi đến khi thành công.
- Tổng payment captured = escrow held + released + refunded + fee, không có drift ngoài ngưỡng 0.
- Seller/shop nhận đúng net amount theo fee snapshot.
- Withdrawal chỉ trừ available balance đúng một lần.
- Shop suspended không nhận order mới.
- P0/P1 integration test xanh, lint xanh, CI xanh.
- Có dashboard/alert và runbook xử lý payment/refund/ledger exception.

---

## 11. Đánh giá cuối cùng theo nhóm

| Nhóm | Mức sẵn sàng | Nhận định |
|---|---|---|
| Auth/RBAC/KYC | Gần MVP | Nền tảng tốt, cần hardening và governance |
| Shop/Catalog | Gần MVP | Cần chặn suspended shop và sửa inventory |
| Cart/Checkout | Chưa đạt | Batch checkout và atomicity chưa hoàn chỉnh |
| Order/Fulfillment | Chưa đạt | Thiếu buyer confirmation, shipment, return/dispute |
| Payment | Không đạt | PayOS return là P0, attempt/idempotency chưa chuẩn |
| Wallet/Ledger/Escrow | Không đạt | Posting time sai và transaction safety chưa đủ |
| Refund/Payout | Không đạt | Refund gateway chưa thực thi, payout phụ thuộc balance sai |
| Review/Chat/Notification | Đạt mức MVP cơ bản | Không phải blocker chính |
| Exchange/Rental/VIP | Chưa nên phát hành | Nâng cao, tăng bề mặt rủi ro tài chính |
| Admin/Reporting | Có nền tảng | Chỉ đáng tin sau khi dữ liệu lõi được sửa |
| Test/Operations | Chưa đạt | Unit pass nhưng lint fail và thiếu test rủi ro cao |

**Kết luận:** Kiến trúc và độ phủ hiện tại đủ tốt để làm nền cho một marketplace, nhưng ưu tiên đã bị dàn trải sang nhiều tính năng nâng cao trước khi lõi tài chính và fulfillment được khóa chặt. Hướng đúng cho MVP là thu hẹp phạm vi, sửa toàn bộ P0, hoàn thành P1 của luồng mua bán, rồi mới mở lại exchange/rental/VIP. Báo cáo này có thể dùng trực tiếp làm đầu vào để tách epic, dependency và kế hoạch triển khai backend ở bước tiếp theo.

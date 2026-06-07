Tạo lại seed data đồng bộ cho project ProductExchange_Backend.

Mục tiêu:

* Xóa toàn bộ data cũ trong database dev/local trước khi seed.
* Tạo data seed mới đồng bộ cho user, role, permission, category, shop, staff, seller, member, product, cart, order, payment, wallet, notification nếu model hiện có.
* Không sửa business logic.
* Không refactor Order/Payment/Wallet.
* Không đổi schema model.
* Chỉ sửa/tạo file seed.
* Chỉ được chạy seed ở môi trường development/test/local, tuyệt đối không chạy production.

Yêu cầu an toàn:

* Nếu NODE_ENV === "production" thì throw error và dừng.
* Nếu MONGO_URI hoặc database name chứa "prod", "production", "railway", "render" thì dừng.
* Chỉ cho phép xóa data khi ALLOW_SEED_RESET=true.
* Trước khi xóa, console.log database name và danh sách collection sẽ xóa.
* Không dùng dropDatabase nếu không cần, dùng deleteMany({}) theo từng model/collection.

File cần tạo hoặc cập nhật:

* scripts/seed-product-data.js
* Nếu package.json chưa có script seed thì thêm:
  "seed": "node scripts/seed-product-data.js"

Password:

* Tất cả tài khoản dùng password: 123456
* Tất cả tài khoản đều đã xác minh:
  isVerified = true
  emailVerifiedAt = new Date()
  isActive = true
* Password phải được hash đúng theo cơ chế hiện tại của User model. Nếu User model có pre-save hash thì tạo user bằng User.create/save để middleware chạy.

Danh sách tài khoản cần seed:

1. Admin

* [admin@gmail.com](mailto:admin@gmail.com)
* name: Admin
* roles: ["admin"]

2. Shop owners: 7 tài khoản

* [shop1@gmail.com](mailto:shop1@gmail.com)
* [shop2@gmail.com](mailto:shop2@gmail.com)
* [shop3@gmail.com](mailto:shop3@gmail.com)
* [shop4@gmail.com](mailto:shop4@gmail.com)
* [shop5@gmail.com](mailto:shop5@gmail.com)
* [shop6@gmail.com](mailto:shop6@gmail.com)
* [shop7@gmail.com](mailto:shop7@gmail.com)
* name lần lượt: Shop Owner 1, Shop Owner 2, ...
* roles: ["member", "shop_owner"]
* KYC approved nếu model có KYC:
  kyc.status = "approved"

3. Staff: 7 tài khoản

* [staff1@gmail.com](mailto:staff1@gmail.com)
* [staff2@gmail.com](mailto:staff2@gmail.com)
* [staff3@gmail.com](mailto:staff3@gmail.com)
* [staff4@gmail.com](mailto:staff4@gmail.com)
* [staff5@gmail.com](mailto:staff5@gmail.com)
* [staff6@gmail.com](mailto:staff6@gmail.com)
* [staff7@gmail.com](mailto:staff7@gmail.com)
* name lần lượt: Staff 1, Staff 2, ...
* roles: ["member", "staff"]

4. Sellers: 5 tài khoản

* [seller1@gmail.com](mailto:seller1@gmail.com)
* [seller2@gmail.com](mailto:seller2@gmail.com)
* [seller3@gmail.com](mailto:seller3@gmail.com)
* [seller4@gmail.com](mailto:seller4@gmail.com)
* [seller5@gmail.com](mailto:seller5@gmail.com)
* name lần lượt: Seller 1, Seller 2, ...
* roles: ["member", "seller"]
* KYC approved nếu model có KYC:
  kyc.status = "approved"

5. Members: 2 tài khoản

* [member1@gmail.com](mailto:member1@gmail.com)
* [member2@gmail.com](mailto:member2@gmail.com)
* name lần lượt: Member 1, Member 2
* roles: ["member"]

Roles và Permissions:

* Tạo đủ roles nếu model Role/Permission đang tồn tại:
  member
  admin
  seller
  shop_owner
  staff
* Tạo permissions cơ bản theo pattern hiện có trong project.
* Nếu project đã có hàm/script seed RBAC thì tái sử dụng, tránh tạo sai enum.

Shops:

* Tạo 7 shop active, mỗi shop gắn với 1 tài khoản shop owner tương ứng.
* [shop1@gmail.com](mailto:shop1@gmail.com) sở hữu Shop 1.
* [shop2@gmail.com](mailto:shop2@gmail.com) sở hữu Shop 2.
* ...
* [shop7@gmail.com](mailto:shop7@gmail.com) sở hữu Shop 7.
* Mỗi shop:
  name: "Decor Shop 1", "Decor Shop 2", ...
  slug: "decor-shop-1", "decor-shop-2", ...
  owner: user shop tương ứng
  status: "active"
  isActive: true
  phone, email, address có dữ liệu mẫu
* Gán staff tương ứng:
  staff1 vào Shop 1
  staff2 vào Shop 2
  ...
  staff7 vào Shop 7
* Nếu model có staffPermissions thì tạo quyền cơ bản cho staff theo schema hiện tại.
* Nếu có ShopInvitation model thì tạo invitation accepted cho từng staff tương ứng.

Categories:
Tạo 20 category decor sau, slug tiếng Anh/kebab-case:

1. Furniture
2. Wall Decor
3. Lighting
4. Home Textile
5. Plant & Vase
6. Storage & Organizer
7. Kitchen Decor
8. Bedroom Decor
9. Living Room Decor
10. Bathroom Decor
11. Office Decor
12. Outdoor Decor
13. Candle & Aroma
14. Handmade Decor
15. Seasonal Decor
16. Kids Room Decor
17. Pet Decor
18. Art & Collectibles
19. Mirror & Glass Decor
20. Party & Event Decor

Products:

* Mỗi category có đúng 10 sản phẩm mẫu theo danh sách bên dưới.
* Tổng cộng 20 category x 10 product = 200 products.
* Product phải hợp lệ để hiển thị/add cart/combo/order:
  isActive = true
  status = "available"
  stock >= 10
  price > 0
  listingType = "sell" nếu schema yêu cầu
  condition = một trong enum hợp lệ, ưu tiên "new" hoặc "like_new"
  ownerType rõ ràng: "SHOP" hoặc "SELLER"
* Phân bổ owner:
  + 70% product thuộc SHOP, chia đều cho 7 shop.
  + 30% product thuộc SELLER, chia đều cho 5 seller.
* Nếu ownerType = "SHOP":

  * owner là shop owner
  * shop là shop tương ứng
  * seller để null/undefined nếu schema yêu cầu
* Nếu ownerType = "SELLER":

  * owner là seller user
  * seller là seller user
  * shop để null/undefined nếu schema yêu cầu
* Mỗi product có:
  title
  description tiếng Việt ngắn
  price ngẫu nhiên hợp lý từ 50000 đến 5000000
  stock từ 10 đến 50
  category
  images nếu schema có, dùng url placeholder hợp lệ:
  https://picsum.photos/seed/{slug}/600/600
* Nếu product model có decor metadata thì thêm:
  style
  roomType
  colorTone
  decorRole
  comboPriority
* decorRole phân bổ theo loại sản phẩm:

  * Furniture: main_item
  * Lighting: lighting
  * Wall Decor: wall_decor
  * Home Textile: textile
  * Candle & Aroma: fragrance
  * các category còn lại: accent_item
* style/roomType/colorTone phải dùng enum đúng trong constants hiện tại. Nếu không chắc enum, đọc constants trước rồi chọn giá trị hợp lệ.

Danh sách sản phẩm theo category:

Furniture:

* Bàn trà gỗ tối giản
* Ghế sofa đơn phòng khách
* Kệ TV hiện đại
* Bàn làm việc gỗ công nghiệp
* Ghế mây thư giãn
* Tủ đầu giường mini
* Kệ sách đứng 5 tầng
* Bàn console trang trí
* Ghế đôn bọc vải
* Tủ giày phong cách Bắc Âu

Wall Decor:

* Tranh canvas phong cảnh
* Tranh abstract treo tường
* Đồng hồ treo tường decor
* Gương tròn viền gỗ
* Khung ảnh treo tường
* Bộ poster phong cách vintage
* Kệ treo tường mini
* Macrame treo tường handmade
* Decal dán tường hoa lá
* Bảng quote trang trí

Lighting:

* Đèn bàn làm việc hiện đại
* Đèn ngủ ánh sáng vàng
* Đèn cây phòng khách
* Đèn thả trần decor
* Đèn LED dây trang trí
* Đèn mây tre handmade
* Đèn tường phong cách industrial
* Đèn nến điện tử
* Đèn cảm ứng đầu giường
* Đèn trang trí hình cầu

Home Textile:

* Thảm lông phòng ngủ
* Thảm vintage phòng khách
* Rèm cửa linen
* Rèm voan trắng
* Gối tựa sofa màu be
* Gối ôm decor
* Khăn trải bàn caro
* Chăn sofa dệt len
* Vỏ gối họa tiết Bohemian
* Thảm chùi chân decor

Plant & Vase:

* Cây giả monstera
* Cây lưỡi hổ mini
* Cây sen đá để bàn
* Chậu cây xi măng nhỏ
* Bình hoa thủy tinh trong suốt
* Bình gốm trắng decor
* Hoa khô lavender
* Cành lá giả eucalyptus
* Chậu cây treo ban công
* Bộ bình hoa phong cách Nordic

Storage & Organizer:

* Hộp đựng đồ vải canvas
* Giỏ mây đựng đồ
* Khay gỗ để bàn
* Kệ góc nhà tắm
* Hộp nhựa trong suốt
* Kệ để gia vị nhà bếp
* Khay đựng trang sức
* Giá treo chìa khóa
* Tủ ngăn kéo mini
* Hộp đựng mỹ phẩm để bàn

Kitchen Decor:

* Bộ lọ gia vị thủy tinh
* Khay gỗ đựng ly
* Kệ bếp mini 2 tầng
* Ly gốm phong cách Hàn Quốc
* Đĩa decor ceramic
* Bình nước thủy tinh
* Khăn trải bàn ăn
* Giỏ đựng trái cây bằng mây
* Kệ treo dụng cụ bếp
* Bình cắm hoa bàn ăn

Bedroom Decor:

* Đèn ngủ đầu giường
* Tủ đầu giường mini
* Tranh treo phòng ngủ
* Gương đứng toàn thân
* Thảm lông cạnh giường
* Bộ ga gối màu pastel
* Kệ sách nhỏ cạnh giường
* Nến thơm thư giãn
* Rèm cửa chống nắng
* Đồng hồ báo thức decor

Living Room Decor:

* Bàn trà mặt kính
* Sofa vải màu xám
* Thảm phòng khách hiện đại
* Tranh canvas treo sofa
* Đèn cây đứng phòng khách
* Kệ TV gỗ trắng
* Gối tựa sofa họa tiết
* Bình hoa đặt bàn trà
* Đồng hồ treo tường lớn
* Tượng decor để kệ

Bathroom Decor:

* Kệ nhà tắm inox
* Gương phòng tắm viền đen
* Khay đựng xà phòng gốm
* Bộ chai chiết dầu gội
* Thảm chống trượt nhà tắm
* Giỏ mây đựng khăn
* Kệ góc dán tường
* Hộp đựng bàn chải
* Nến thơm phòng tắm
* Rèm nhà tắm chống nước

Office Decor:

* Đèn bàn làm việc
* Kệ laptop gỗ
* Khay đựng bút để bàn
* Đồng hồ mini để bàn
* Cây xanh mini để bàn
* Bảng ghi chú gỗ
* Kệ sách để bàn
* Lót chuột da decor
* Giá đỡ điện thoại
* Tượng decor bàn làm việc

Outdoor Decor:

* Bàn ghế sân vườn
* Đèn năng lượng mặt trời
* Chậu cây ngoài trời
* Ghế xếp ban công
* Đèn dây trang trí ban công
* Kệ cây cảnh ngoài trời
* Thảm ban công chống nước
* Xích đu sân vườn
* Tượng trang trí sân vườn
* Ô che nắng ban công

Candle & Aroma:

* Nến thơm hương vanilla
* Nến thơm hương lavender
* Máy khuếch tán tinh dầu
* Tinh dầu sả chanh
* Tinh dầu bạc hà
* Bộ que khuếch tán hương
* Nến tealight decor
* Đèn xông tinh dầu
* Sáp thơm phòng ngủ
* Bình tinh dầu treo xe

Handmade Decor:

* Macrame treo tường
* Giỏ mây handmade
* Bình hoa đan len
* Tranh thêu tay
* Lót ly handmade
* Đèn mây tre thủ công
* Tượng đất sét mini
* Khung ảnh gỗ handmade
* Chậu cây vẽ tay
* Dây treo ảnh handmade

Seasonal Decor:

* Cây thông Noel mini
* Dây đèn Noel
* Vòng nguyệt quế treo cửa
* Bao lì xì trang trí Tết
* Đèn lồng Tết
* Hoa mai giả decor
* Hoa đào giả decor
* Bí ngô Halloween decor
* Backdrop sinh nhật
* Dây treo trang trí tiệc

Kids Room Decor:

* Đèn ngủ hình thú
* Thảm chơi cho bé
* Tranh treo tường hoạt hình
* Kệ đồ chơi mini
* Gối ôm hình thú
* Rèm cửa phòng trẻ em
* Bảng chữ cái decor
* Đồng hồ treo tường trẻ em
* Lều vải mini trong phòng
* Hộp đựng đồ chơi

Pet Decor:

* Giường ngủ cho mèo
* Nhà gỗ cho thú cưng
* Kệ leo trèo cho mèo
* Bát ăn decor cho thú cưng
* Thảm nằm cho chó mèo
* Lều vải mini cho thú cưng
* Khay đựng đồ thú cưng
* Bảng tên thú cưng decor
* Sofa mini cho chó mèo
* Tủ đựng phụ kiện thú cưng

Art & Collectibles:

* Tượng decor nghệ thuật
* Mô hình nhà mini
* Tượng gốm trừu tượng
* Bộ figure trang trí
* Đĩa sứ trang trí
* Tranh sơn dầu mini
* Bình gốm nghệ thuật
* Mô hình xe cổ decor
* Tượng động vật bằng gỗ
* Bộ sưu tập khung ảnh cổ điển

Mirror & Glass Decor:

* Gương tròn viền vàng
* Gương đứng toàn thân
* Gương oval treo tường
* Gương decor phong cách vintage
* Gương viền mây tre
* Bình thủy tinh trong suốt
* Lọ thủy tinh cắm hoa
* Khay kính trang trí
* Hộp kính đựng trang sức
* Đèn thủy tinh decor

Party & Event Decor:

* Backdrop sinh nhật
* Bóng bay trang trí
* Dây treo chữ Happy Birthday
* Đèn LED tiệc
* Khăn trải bàn tiệc
* Cổng hoa giả
* Nến sinh nhật decor
* Standee trang trí sự kiện
* Hoa giấy trang trí
* Bộ phụ kiện chụp ảnh tiệc

Cart:

* Tạo cart cho [member1@gmail.com](mailto:member1@gmail.com) gồm 3 sản phẩm available, stock đủ.
* Tạo cart cho [member2@gmail.com](mailto:member2@gmail.com) gồm 2 sản phẩm available, stock đủ.
* unitPrice khớp product.price.
* Không dùng product sold/hidden/pending/out-of-stock cho cart.

Orders:

* Tạo một số order mẫu theo schema hiện tại, vì hiện tại Order là 1 order = 1 product.
* Tạo ít nhất:

  * pending unpaid
  * pending paid
  * confirmed paid
  * processing paid
  * shipped paid
  * delivered paid
  * cancelled unpaid
* Không dùng các product đang nằm trong cart để set sold/pending nếu điều đó làm hỏng cart.
* Mỗi order:
  buyer là member1 hoặc member2
  product hợp lệ
  shop hoặc seller đúng theo product
  quantity hợp lệ
  unitPrice = product.price
  totalAmount = unitPrice * quantity
  status/paymentStatus đồng bộ

Payments:

* Tạo payment 1-1 với một số order.
* amount = order.totalAmount
* buyer = order.buyer
* transactionRef unique
* status đồng bộ với order.paymentStatus.
* Nếu payment paid thì order.paymentStatus = "paid", paidAt có giá trị, paymentRef khớp transactionRef.

Wallet:

* Tạo wallet cho 7 shop active.
* Tạo wallet transaction mẫu nếu model có.
* Shop đã có delivered paid order thì wallet có thể có balance/totalEarned tương ứng.

UserWallet:

* Tạo user wallet cho member1 và member2.
* member1 có balance đủ để test thanh toán ví.
* member2 có balance thấp để test lỗi không đủ tiền.
* Tạo user wallet transaction/topup/withdrawal mẫu nếu model có.

Notifications:

* Tạo notification mẫu cho admin, shop owner, staff, seller, member.
* Có cả isRead true và false.
* targetType dùng enum hợp lệ theo constants hiện tại.

Conversations/Messages:

* Tạo 1 direct conversation giữa member1 và seller1.
* Tạo 1 shop conversation giữa member1 và Shop 1.
* Tạo vài messages TEXT.
* Nếu schema hỗ trợ attachments thì thêm 1 message IMAGE mẫu.

Output cuối khi chạy seed:

* In database name.
* In số lượng document đã xóa từng collection.
* In số lượng document đã tạo từng collection.
* In danh sách tài khoản test:

[admin@gmail.com](mailto:admin@gmail.com) / 123456

[shop1@gmail.com](mailto:shop1@gmail.com) / 123456
[shop2@gmail.com](mailto:shop2@gmail.com) / 123456
[shop3@gmail.com](mailto:shop3@gmail.com) / 123456
[shop4@gmail.com](mailto:shop4@gmail.com) / 123456
[shop5@gmail.com](mailto:shop5@gmail.com) / 123456
[shop6@gmail.com](mailto:shop6@gmail.com) / 123456
[shop7@gmail.com](mailto:shop7@gmail.com) / 123456

[staff1@gmail.com](mailto:staff1@gmail.com) / 123456
[staff2@gmail.com](mailto:staff2@gmail.com) / 123456
[staff3@gmail.com](mailto:staff3@gmail.com) / 123456
[staff4@gmail.com](mailto:staff4@gmail.com) / 123456
[staff5@gmail.com](mailto:staff5@gmail.com) / 123456
[staff6@gmail.com](mailto:staff6@gmail.com) / 123456
[staff7@gmail.com](mailto:staff7@gmail.com) / 123456

[seller1@gmail.com](mailto:seller1@gmail.com) / 123456
[seller2@gmail.com](mailto:seller2@gmail.com) / 123456
[seller3@gmail.com](mailto:seller3@gmail.com) / 123456
[seller4@gmail.com](mailto:seller4@gmail.com) / 123456
[seller5@gmail.com](mailto:seller5@gmail.com) / 123456

[member1@gmail.com](mailto:member1@gmail.com) / 123456
[member2@gmail.com](mailto:member2@gmail.com) / 123456

Sau khi code xong, chạy:

* node --check scripts/seed-product-data.js
* git diff --check

Không tự chạy seed thật nếu chưa được yêu cầu. Nếu cần chạy seed thật thì dùng:

PowerShell:
$env:NODE_ENV="development"
$env:ALLOW_SEED_RESET="true"
npm run seed

CMD:
set NODE_ENV=development
set ALLOW_SEED_RESET=true
npm run seed

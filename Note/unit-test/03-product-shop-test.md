# Prompt: `tests/integration/product-shop.test.js`

Ban la Senior Backend Engineer. Hay viet hoac hoan thien test cho dung mot file:

`tests/integration/product-shop.test.js`

## Pham vi bat buoc

- Chi sua file `tests/integration/product-shop.test.js`.
- Khong sua file test khac.
- Khong import, copy, hoac phu thuoc vao `tests/_legacy`.
- Khong phu thuoc du lieu legacy hoac du lieu co san trong DB chinh.
- Dung helper san co trong `tests/setup`.
- Neu helper thieu, chi bo sung toi thieu trong `tests/setup` va giai thich ro.
- Khong sua business logic trong `src` de lam test pass.

## Noi dung can test

- Shop owner tao shop thanh cong.
- Shop submit review neu flow hien co.
- Admin approve shop neu endpoint hien co.
- Shop owner tao product thuoc shop.
- Seller tao product ca nhan neu role seller duoc phep.
- Member khong duoc tao product.
- Public list product chi thay product active/available theo behavior hien tai.
- Seller/shop owner khong quan ly product khong thuoc quyen minh.

## Huong dan thuc hien

- Doc route/controller/service cua shop va product truoc khi viet assertion.
- Chi dung role/status/phuong thuc tao product theo code hien tai.
- Tao category/shop/product fixture toi thieu neu endpoint yeu cau.
- Khong assert cung ID, ten, status tu DB chinh.
- Neu approval/review flow khong co endpoint public trong code hien tai, khong tao endpoint moi; test behavior gan nhat dang co.

## Kiem tra sau khi sua

Chay rieng file:

```bash
npm test -- tests/integration/product-shop.test.js --runInBand
```

Chay full test:

```bash
npm test -- --runInBand
```

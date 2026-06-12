# Prompt: `tests/integration/admin-stats.test.js`

Ban la Senior Backend Engineer. Hay viet hoac hoan thien test cho dung mot file:

`tests/integration/admin-stats.test.js`

## Pham vi bat buoc

- Chi sua file `tests/integration/admin-stats.test.js`.
- Khong sua file test khac.
- Khong import, copy, hoac phu thuoc vao `tests/_legacy`.
- Khong phu thuoc du lieu legacy hoac du lieu co san trong DB chinh.
- Dung helper san co trong `tests/setup`.
- Neu helper thieu, chi bo sung toi thieu trong `tests/setup` va giai thich ro.
- Khong sua business logic trong `src` de lam test pass.

## Noi dung can test

- Admin goi duoc API danh sach user hoac API admin chinh dang co.
- Khong token goi API admin nhan `401`.
- Member goi API admin nhan `403`.
- Admin xem danh sach product/shop/category neu endpoint hien co.
- Admin xem stats neu endpoint hien co.
- Khong assert cung du lieu tu DB chinh.
- Neu endpoint stats can du lieu, tu tao fixture toi thieu.

## Huong dan thuc hien

- Doc `src/routes/admin/`, route stats, controller stats, va middleware auth/RBAC hien tai.
- Chi test endpoint that su ton tai trong codebase hien tai.
- Neu mot endpoint trong danh sach khong ton tai, khong tao route moi; bo qua co chu thich ngan trong test hoac chon endpoint admin tuong duong dang co.
- Fixture nen nho, doc lap, va cleanup theo helper hien co.

## Kiem tra sau khi sua

Chay rieng file:

```bash
npm test -- tests/integration/admin-stats.test.js --runInBand
```

Chay full test:

```bash
npm test -- --runInBand
```

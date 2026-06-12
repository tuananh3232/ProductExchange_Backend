# Prompt: `tests/integration/auth-rbac.test.js`

Ban la Senior Backend Engineer. Hay viet hoac hoan thien test cho dung mot file:

`tests/integration/auth-rbac.test.js`

## Pham vi bat buoc

- Chi sua file `tests/integration/auth-rbac.test.js`.
- Khong sua file test khac.
- Khong import, copy, hoac phu thuoc vao `tests/_legacy`.
- Khong phu thuoc du lieu legacy hoac du lieu co san trong DB chinh.
- Dung helper san co trong `tests/setup`.
- Neu helper thieu, chi bo sung toi thieu trong `tests/setup` va giai thich ro.
- Khong sua business logic trong `src` de lam test pass.

## Noi dung can test

- Register member thanh cong.
- Login user chua verify bi chan neu he thong hien tai yeu cau verify.
- Login user da verified thanh cong va tra access token.
- Khong token goi protected API nhan `401`.
- Member goi API admin nhan `403`.
- Admin goi API admin thanh cong.
- Email test phai unique cho moi lan chay.
- Khong de rate limit lam test fail `429` trong `NODE_ENV=test`.

## Huong dan thuc hien

- Doc route/controller/service hien tai de chon endpoint that su ton tai.
- Uu tien tao fixture bang factory/helper trong `tests/setup`.
- Neu behavior verify email co dieu kien theo code hien tai, assert theo behavior hien tai thay vi ep code.
- Khong hard-code token/user tu DB chinh.
- Dam bao cleanup/isolated data theo pattern test hien co.

## Kiem tra sau khi sua

Chay rieng file:

```bash
npm test -- tests/integration/auth-rbac.test.js --runInBand
```

Chay full test:

```bash
npm test -- --runInBand
```

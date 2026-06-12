# Prompt: `tests/integration/wallet.test.js`

Ban la Senior Backend Engineer. Hay viet hoac hoan thien test cho dung mot file:

`tests/integration/wallet.test.js`

## Pham vi bat buoc

- Chi sua file `tests/integration/wallet.test.js`.
- Khong sua file test khac.
- Khong import, copy, hoac phu thuoc vao `tests/_legacy`.
- Khong assert balance cung tu DB chinh.
- Dung helper san co trong `tests/setup`.
- Neu helper thieu, chi bo sung toi thieu trong `tests/setup` va giai thich ro.
- Khong sua business logic trong `src` de lam test pass.

## Noi dung can test

- User/member xem wallet cua minh neu endpoint hien co.
- Shop owner xem shop wallet neu endpoint hien co.
- Tao topup/withdraw request theo behavior hien tai.
- Admin approve/reject withdrawal neu endpoint hien co.
- Khong goi payment provider that; mock neu can.
- Khong assert balance cung tu DB chinh.
- Tu tao user/shop/wallet fixture can thiet.

## Huong dan thuc hien

- Doc wallet route/controller/service, user-wallet route/controller/service, va constant lien quan.
- Neu project co ca shop wallet va user wallet, test dung endpoint dang active.
- Tao fixture toi thieu cho user/shop/wallet/withdrawal theo model hien tai.
- Mock payment provider neu code tao topup co goi provider.
- Assertion nen tap trung vao status code, ownership, response shape, va thay doi du lieu do test tao ra.

## Kiem tra sau khi sua

Chay rieng file:

```bash
npm test -- tests/integration/wallet.test.js --runInBand
```

Chay full test:

```bash
npm test -- --runInBand
```

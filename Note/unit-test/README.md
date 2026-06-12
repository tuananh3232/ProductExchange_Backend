# Unit Test Prompt Pack

## Muc tieu

Thu muc nay chua cac prompt doc lap dung de viet lai hoac hoan thien tung file test active trong `tests/integration/` va `tests/unit/`.

Ten thu muc dang la `unit-test` vi lich su cleanup, nhung noi dung gom ca integration test va unit test. Day khong phai thu muc chi danh rieng cho unit test.

Muc tieu la xu ly tung file test mot cach co kiem soat, tranh de AI code lai toan bo test suite hoac dua lai du lieu/test legacy.

## Thu tu su dung prompt

1. `01-auth-rbac-test.md`
2. `02-admin-stats-test.md`
3. `03-product-shop-test.md`
4. `04-cart-order-payment-test.md`
5. `05-wallet-test.md`
6. `06-notification-chat-test.md`
7. `07-shop-service-unit-test.md`

## Quy tac su dung

- Moi lan chi dung dung mot prompt.
- Chi sua dung file test duoc prompt chi dinh.
- Khong import, copy, hoac phu thuoc vao `tests/_legacy`.
- Khong sua business logic trong `src` de lam test pass.
- Uu tien helper san co trong `tests/setup`.
- Neu helper thieu, chi bo sung toi thieu trong `tests/setup`.
- Sau khi mot file test pass, tao commit rieng cho file do va helper lien quan neu co.

## Lenh kiem tra

```bash
npm test -- --listTests
npm test -- tests/integration/<file>.test.js --runInBand
npm test -- --runInBand
npm run test:coverage
npm run test:coverage:serial
```

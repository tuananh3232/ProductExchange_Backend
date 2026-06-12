# Prompt: `tests/unit/shop.service.unit.test.js`

Ban la Senior Backend Engineer. Hay viet hoac hoan thien unit test cho dung mot file:

`tests/unit/shop.service.unit.test.js`

## Pham vi bat buoc

- Chi sua file `tests/unit/shop.service.unit.test.js`.
- Khong sua file test khac.
- Khong import, copy, hoac phu thuoc vao `tests/_legacy`.
- Khong goi MongoDB that neu co the mock hop ly.
- Dung helper san co trong `tests/setup` neu can.
- Neu helper thieu, chi bo sung toi thieu trong `tests/setup` va giai thich ro.
- Khong sua business logic trong `src` de lam test pass.

## Noi dung can test

- Unit test service shop, khong goi MongoDB that neu co the mock.
- Mock repository/model/mail util neu service dang phu thuoc.
- Test create shop draft.
- Test submit shop for review.
- Test approve/reject shop neu service co.
- Test invite staff bang email neu service co.
- Test transfer owner neu service co.
- Khong sua business logic de test pass.
- Neu service hien tai kho unit test, ghi ro phan nao can integration test thay vi ep mock qua muc.

## Huong dan thuc hien

- Doc `src/services/shop/shop.service.js` va cac repository/util ma service import.
- Mock o boundary gan service nhat, uu tien repository/util thay vi mock sau vao Mongoose khi khong can.
- Test ca happy path va permission/validation error quan trong ma service dang xu ly.
- Giu unit test nho, doc lap, khong dung DB connection.
- Neu mot method phu thuoc nhieu side effect kho mock, de lai nhan xet ngan trong test hoac tach thanh integration test sau.

## Kiem tra sau khi sua

Chay rieng file:

```bash
npm test -- tests/unit/shop.service.unit.test.js --runInBand
```

Chay full test:

```bash
npm test -- --runInBand
```

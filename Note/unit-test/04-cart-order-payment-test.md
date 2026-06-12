# Prompt: `tests/integration/cart-order-payment.test.js`

Ban la Senior Backend Engineer. Hay viet hoac hoan thien test cho dung mot file:

`tests/integration/cart-order-payment.test.js`

## Pham vi bat buoc

- Chi sua file `tests/integration/cart-order-payment.test.js`.
- Khong sua file test khac.
- Khong import, copy, hoac phu thuoc vao `tests/_legacy`.
- Khong phu thuoc order/payment legacy.
- Dung helper san co trong `tests/setup`.
- Neu helper thieu, chi bo sung toi thieu trong `tests/setup` va giai thich ro.
- Khong sua business logic trong `src` de lam test pass.

## Noi dung can test

- Member add product vao cart.
- Update quantity cart item.
- Remove cart item.
- Tao order tu cart neu endpoint hien co.
- Buyer cancel order restore product neu behavior hien tai co.
- Payment cancel/fail restore product pending neu flow hien co.
- Khong goi VNPay/PayOS that; mock neu can.
- Khong phu thuoc order/payment legacy.

## Huong dan thuc hien

- Doc cart/order/payment routes va services hien tai de xac dinh flow that.
- Tao fixture user, seller/shop owner, category, product toi thieu.
- Neu payment provider duoc goi trong service, mock provider/module o muc test.
- Khong dung network that, webhook that, payment key that, hoac external provider.
- Neu endpoint tao order tu cart khong ton tai, khong tao endpoint moi; test flow cart va order hien co.

## Kiem tra sau khi sua

Chay rieng file:

```bash
npm test -- tests/integration/cart-order-payment.test.js --runInBand
```

Chay full test:

```bash
npm test -- --runInBand
```

# Test Cleanup Report

## Archived Legacy Files

- `admin.test.js`
- `auth.test.js`
- `cart.test.js`
- `chat.test.js`
- `combo.test.js`
- `notification.test.js`
- `order.test.js`
- `payment.test.js`
- `product.test.js`
- `rbac.test.js`
- `shop-permissions.test.js`
- `shop.service.unit.test.js`
- `shop.test.js`
- `stats.test.js`
- `user-wallet.test.js`
- `wallet.test.js`
- `fixtures/testData.js`
- `jest.setup.js`
- `jest.setup-after-env.js`

## Merged Files

- `auth.test.js` + `rbac.test.js` -> `tests/integration/auth-rbac.test.js`
- `product.test.js` + `shop.test.js` + `shop-permissions.test.js` -> `tests/integration/product-shop.test.js`
- `cart.test.js` + `combo.test.js` + `order.test.js` + `payment.test.js` -> `tests/integration/cart-order-payment.test.js`
- `wallet.test.js` + `user-wallet.test.js` -> `tests/integration/wallet.test.js`
- `admin.test.js` + `stats.test.js` -> `tests/integration/admin-stats.test.js`
- `notification.test.js` + `chat.test.js` -> `tests/integration/notification-chat.test.js`
- `shop.service.unit.test.js` -> `tests/unit/shop.service.unit.test.js`

## Delete Decisions

No legacy test was deleted. The old files were moved into `tests/_legacy` so their coverage and behavior remain auditable while the active Jest entrypoints are consolidated.

## Replacement Notes

The new integration/unit entrypoints import archived suites from `_legacy`. This keeps the existing assertions intact while allowing Jest discovery, setup, helper code, and future maintenance to use the cleaner `tests/setup`, `tests/integration`, and `tests/unit` structure.

Legacy tests are archived for audit only. Active test files no longer import or execute legacy test suites.

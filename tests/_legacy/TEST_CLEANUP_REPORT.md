# Test Cleanup Report

## Final Status

Legacy tests are archived in `tests/_legacy/` for audit and reference only. They are not imported or executed by the active Jest suite.

Active Jest scans only:

- `tests/integration/**/*.test.js`
- `tests/unit/**/*.test.js`

The root `tests/` directory no longer contains direct `.test.js` files. Active tests live only in `tests/integration/` and `tests/unit/`; archived legacy tests live only in `tests/_legacy/`.

## Active Test Files

- `tests/integration/auth-rbac.test.js`
- `tests/integration/admin-stats.test.js`
- `tests/integration/product-shop.test.js`
- `tests/integration/cart-order-payment.test.js`
- `tests/integration/wallet.test.js`
- `tests/integration/notification-chat.test.js`
- `tests/unit/shop.service.unit.test.js`

Total active tests: 44.

## Archived Legacy Files

- `admin.test.js`
- `auth.test.js`
- `background-removal.unit.test.js`
- `cart.test.js`
- `chat.test.js`
- `combo.test.js`
- `notification.test.js`
- `order.test.js`
- `payment.test.js`
- `product-visual.test.js`
- `product.test.js`
- `rbac.test.js`
- `room-visualizer.test.js`
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
- `admin.test.js` + `stats.test.js` -> `tests/integration/admin-stats.test.js`
- `product.test.js` + `shop.test.js` + `shop-permissions.test.js` -> `tests/integration/product-shop.test.js`
- `cart.test.js` + `combo.test.js` + `order.test.js` + `payment.test.js` -> `tests/integration/cart-order-payment.test.js`
- `wallet.test.js` + `user-wallet.test.js` -> `tests/integration/wallet.test.js`
- `notification.test.js` + `chat.test.js` -> `tests/integration/notification-chat.test.js`
- `shop.service.unit.test.js` -> `tests/unit/shop.service.unit.test.js`

## Additional Files Moved To Legacy

- `tests/background-removal.unit.test.js`
- `tests/product-visual.test.js`
- `tests/room-visualizer.test.js`

## Removed Temporary Result Files

- `auth-result.json`
- `product-result.json`
- `product-refactor-result.json`
- `tests-result.json`

## Current Notes

- Active test files contain real tests, not placeholder-only suites.
- Active tests no longer import or execute `_legacy`.
- Test DB setup has a `_test` database-name guard.
- The suite may still depend on the configured MongoDB service. Prefer local MongoDB, Docker MongoDB, or `mongodb-memory-server` later to reduce DNS/network flakiness.
- `tests/_legacy` is intentionally kept for audit and may be removed in a separate PR after team approval.

## Final Command Results

- `npm test -- --listTests`: pass. Jest lists only the 7 active files.
- `npm test -- --runInBand`: pass. 7 suites, 44 tests.
- `npm run test:coverage:serial`: failed in this environment while connecting to MongoDB Atlas with `querySrv ETIMEOUT _mongodb._tcp.cluster0.tlye7u0.mongodb.net`. This is an environment/DB connectivity issue, not an assertion failure. Use local MongoDB, Docker MongoDB, or `mongodb-memory-server` later to make coverage stable.

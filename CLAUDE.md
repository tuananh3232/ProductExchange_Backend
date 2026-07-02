# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

ProductExchange is a Node.js/Express/MongoDB REST API backend for EXE202 (FPTU Term8) — a marketplace for buying, selling, renting, and exchanging products (home decor focus). The platform acts as an escrow: buyers pay up front (wallet/VNPay/PayOS), the platform holds funds, and sellers/shops are paid only after an order is DELIVERED.

ESM modules throughout (`"type": "module"`). All user-facing text is Vietnamese; developer-facing error codes are English.

## Commands

```bash
npm run dev              # nodemon dev server (reads .env)
npm start                # production start
npm run lint             # eslint src/**/*.js
npm run lint:fix         # eslint --fix
npm run format           # prettier --write src/**/*.js

# Tests (Jest, two projects: "unit" and "integration")
npm run test:unit                       # all unit tests
npm run test:integration                # integration tests, run serially file-by-file
npm test                                # unit then integration
npm run test:coverage                   # coverage report

# Run a single unit test file
node --experimental-vm-modules node_modules/jest/bin/jest.js --selectProjects unit --runTestsByPath tests/unit/<file>.test.js

# Run a single integration test file (must be serial / --runInBand against the test DB)
node --experimental-vm-modules node_modules/jest/bin/jest.js --selectProjects integration --runInBand --runTestsByPath tests/integration/<file>.test.js

# Data / DB
npm run seed             # seed sample product data into the main DB
npm run seed:decor       # seed decor data
npm run init:empty-db    # initialize an empty DB structure
npm run migrate:user-roles
npm run test:copy-db     # copy main DB -> test DB (anhdecor_test)
```

ESLint config (`.eslintrc.json`) enforces **no semicolons** and **single quotes** — match this. Jest needs `--experimental-vm-modules` because the project is ESM.

## Architecture

Strict 4-layer separation. A request flows:

**Route → Controller → Service → Repository → Model**

- **Routes** (`src/routes/`) — Express routers, one folder per domain, registered in `src/routes/index.js` under `API_PREFIX` (default `/api/v1`). Routes attach middleware (auth, validate, upload) and contain inline Swagger JSDoc annotations.
- **Controllers** (`src/controllers/`) — thin HTTP adapters. Wrap handlers in `asyncHandler` (`src/utils/async-handler.util.js`) so thrown errors reach the error middleware without try/catch. Parse the request, call a service, respond via `sendSuccess`/`sendError` (`src/utils/response.util.js`). No business logic here.
- **Services** (`src/services/`) — all business logic. Throw `AppError(messageVi, statusCode, errorCode)` (`src/utils/app-error.util.js`) for operational errors. Multi-document writes use `runMongoTransaction` (`src/utils/mongo-transaction.util.js`), which gracefully falls back to no-session when the deployment lacks replica-set transactions.
- **Repositories** (`src/repositories/`) — Mongoose data access only.
- **Models** (`src/models/`) — Mongoose schemas. Flat directory; ~35 models.

Keep this layering intact — do not call repositories from controllers or put DB queries in services that bypass the repository layer where one exists.

### Error handling contract

`src/middlewares/error.middleware.js` is the single global error handler. It special-cases `AppError` (operational), Mongoose duplicate-key (11000), CastError, and JWT errors. Responses always have shape `{ success, message (Vietnamese), error (English/code) }`. In `development` it leaks the stack; in production it does not.

### Auth & RBAC

JWT auth in `src/middlewares/auth.middleware.js`:
- `authenticate` — verifies Bearer token, loads the user, attaches `req.user` (`{ _id, roles, isActive, vip }`).
- `authorize(...roles)` / `requireRoles` — role gate; **admin always passes**.
- `requirePermissions(...keys)` — database-driven RBAC; resolves the user's roles → permission keys from the DB (`role` + `permission` models). Admin gets `['*']`.
- `requireShopPermission(key, shopIdParam)` — shop-scoped: owner always allowed, staff need the permission.
- `requireVip`, `requireShopOwnerProductVisual` — feature gates.

Roles (`src/constants/role.constant.js`): `member`, `admin`, `seller`, `shop_owner`, `staff`. RBAC seed data (roles + permissions) is ensured on server boot and on test bootstrap via `ensureRbacSeedData` (`src/services/rbac/rbac-seed.service.js`). Permission/role definitions live in `src/constants/` (`permission.constant.js`, `rbac-matrix.constant.js`).

### Money flows (escrow model)

The platform holds funds and releases them only after delivery. Two distinct wallet systems exist — do not conflate them:
- **User wallet** (`user-wallet*` models/services) — personal balance: top-up via VNPay/PayOS, pay orders instantly, auto-refund on cancel.
- **Shop wallet** (`wallet*` models/services) — shop earnings: order DELIVERED → credit shop wallet minus platform fee → withdrawal request → admin approve/complete.

A double-entry **ledger** (`ledger-*` models, `src/services/ledger/`) plus `fee-policy`/`fee-snapshot` models record transactions and fees. New payment/payout features must preserve the escrow invariant (buyer pays first, seller paid only post-delivery).

Payment providers: **VNPay** (HMAC-SHA512 signed query) and **PayOS** (`@payos/node` SDK). Config in `src/configs/env.config.js` under `env.payment`. Return/IPN URLs are env-driven.

### Other cross-cutting pieces

- **Real-time chat** — `src/sockets/chat.socket.js` (socket.io), accessed via `src/sockets/socket-hub.js`. Sockets are disabled under the test runtime.
- **Domains beyond products**: exchange (barter offers), rental (bookings/claims/inspections), combo, subscription (VIP), room-visualizer (room scenes/projects + visual assets), cart, conversation, notification, admin/stats/analytics.
- **Uploads** — Multer + Cloudinary (`src/middlewares/upload.middleware.js`, `src/utils/cloudinary.util.js`).
- **Validation** — Joi schemas in `src/validations/`, applied via `validate` middleware; ObjectId params via `validateObjectId`.
- **Swagger** — served at `/api-docs`; spec built from JSDoc in route files (`src/configs/swagger.config.js`).
- Constants are centralized in `src/constants/` (HTTP status, messages, error codes, statuses, fees). Prefer these over string literals.

## Testing

Two Jest projects defined in `jest.config.js`: `unit` (`tests/unit/`) and `integration` (`tests/integration/`). `tests/_legacy/` is ignored.

- **Integration tests hit a real MongoDB**, hard-pinned to the database named exactly `anhdecor_test`. `tests/setup/test-db.js` and `tests/setup/jest.setup.js` **refuse to run if the DB name is anything else** — this is a safety guard against wiping a real DB. The DB name is forced via env in test setup.
- Integration tests must run **serially** (`--runInBand`); `scripts/test/run-integration-serial.js` runs each integration file in its own Jest process to isolate shared DB state. Do not parallelize them.
- `clearTestCollections` wipes collections between tests but **preserves `permissions` and `roles`** (RBAC seed is expensive and shared). RBAC is seeded once per run (`JEST_RBAC_SEEDED`).
- Shared helpers: `tests/setup/auth.js` (auth/token helpers), `tests/setup/factories.js` (data factories).

## Environment

Copy `.env.example` → `.env`. `src/configs/env.config.js` centralizes all config (never read `process.env` directly outside it). Required in production: `MONGODB_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET`. The Mongo URI is normalized to append `DB_NAME` when the path is empty or `test`. Note the default `DB_NAME` is `anhdecor`.

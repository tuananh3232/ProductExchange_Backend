# ProductExchange_Backend

## Setup

Create `.env` from `.env.example` and point MongoDB to the main database:

```env
MONGODB_URI=mongodb+srv://username:password@cluster0.example.mongodb.net/productexchange
DB_NAME=productexchange
```

Run the API:

```bash
npm install
npm run dev
```

Seed sample decor data into the database configured by `.env`:

```bash
npm run seed
```

This command now runs `scripts/seed-decor-data.js`.

## Test Environment

If you want to run the app or seed script against a dedicated test database, create `.env.test` from `.env.test.example` first.

```bash
copy .env.test.example .env.test
```

Then update `.env.test` to point only at a safe local/test database, for example:

```env
MONGODB_URI=mongodb://localhost:27017
DB_NAME=anhdecor_test
```

Available scripts:

```bash
npm run dev:test
npm run seed:decor:test
```

Do not point `.env.test` at production or shared development data.

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

Seed sample data into `productexchange`:

```bash
npm run seed
```

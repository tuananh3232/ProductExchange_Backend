import mongoose from 'mongoose';
import { env } from '../src/configs/env.config.js';
import { connectDB, disconnectDB } from '../src/configs/database.config.js';
import User from '../src/models/user.model.js';
import Category from '../src/models/category.model.js';
import Shop from '../src/models/shop.model.js';
import Product from '../src/models/product.model.js';
import { DECOR_CATEGORIES, DECOR_PRODUCTS_BY_CATEGORY, DECOR_SHOPS } from '../src/data/decor.seed-data.js';

const SEED_USER_EMAIL = 'decor-seed@example.com';

const findOrCreateSeedUser = async () => {
  let user = await User.findOne({ email: SEED_USER_EMAIL });

  if (!user) {
    user = await User.create({
      name: 'Decor Seeder',
      email: SEED_USER_EMAIL,
      password: '123456',
      role: 'shop_owner',
      roles: ['shop_owner'],
      isVerified: true,
    });
  }

  return user;
};

const upsertCategories = async () => {
  const categoryDocs = [];

  for (const category of DECOR_CATEGORIES) {
    const doc = await Category.findOneAndUpdate(
      { slug: category.slug },
      { $set: category },
      { upsert: true, new: true, runValidators: true }
    );
    categoryDocs.push(doc);
  }

  return Object.fromEntries(categoryDocs.map((category) => [category.slug, category]));
};

const upsertShops = async (ownerId) => {
  const shopDocs = [];

  for (const shop of DECOR_SHOPS) {
    const doc = await Shop.findOneAndUpdate(
      { slug: shop.slug },
      {
        $set: {
          ...shop,
          owner: ownerId,
          isActive: true,
        },
      },
      { upsert: true, new: true, runValidators: true }
    );
    shopDocs.push(doc);
  }

  return Object.fromEntries(shopDocs.map((shop) => [shop.slug, shop]));
};

const upsertProducts = async (ownerId, categoriesBySlug, shopsBySlug) => {
  const createdProducts = [];
  const shops = Object.values(shopsBySlug);

  for (const [categoryIndex, [categorySlug, products]] of Object.entries(DECOR_PRODUCTS_BY_CATEGORY).entries()) {
    const category = categoriesBySlug[categorySlug];
    const shop = shops[categoryIndex % shops.length];

    if (!category) {
      throw new Error(`Missing category for slug: ${categorySlug}`);
    }

    if (!shop) {
      throw new Error('Missing shop for seeded product');
    }

    for (const product of products) {
      const payload = {
        title: product.title,
        description: product.description,
        price: product.price,
        listingType: product.listingType,
        condition: product.condition,
        exchangeFor: product.exchangeFor,
        location: product.location,
        category: category._id,
        owner: ownerId,
        shop: shop._id,
        status: 'available',
        isActive: true,
      };

      const doc = await Product.findOneAndUpdate(
        { title: product.title, category: category._id, owner: ownerId },
        { $set: payload, $setOnInsert: { views: 0 } },
        { upsert: true, new: true, runValidators: true }
      );

      createdProducts.push(doc);
    }
  }

  return createdProducts;
};

const main = async () => {
  if (!env.mongodb.uri) {
    throw new Error('MONGODB_URI is missing');
  }

  await connectDB();

  try {
    const seedUser = await findOrCreateSeedUser();
    const categoriesBySlug = await upsertCategories();
    const shopsBySlug = await upsertShops(seedUser._id);
    const products = await upsertProducts(seedUser._id, categoriesBySlug, shopsBySlug);

    console.log(`Seeded categories: ${Object.keys(categoriesBySlug).length}`);
    console.log(`Seeded shops: ${Object.keys(shopsBySlug).length}`);
    console.log(`Seeded products: ${products.length}`);
    console.log(`Seed user: ${seedUser.email}`);
  } finally {
    await disconnectDB();
    await mongoose.disconnect().catch(() => {});
  }
};

main().catch((error) => {
  console.error('Seed failed:', error.message);
  process.exitCode = 1;
});

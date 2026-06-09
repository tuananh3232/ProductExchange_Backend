import mongoose from 'mongoose';
import { env } from '../src/configs/env.config.js';
import { connectDB, disconnectDB } from '../src/configs/database.config.js';
import User from '../src/models/user.model.js';
import Category from '../src/models/category.model.js';
import Shop from '../src/models/shop.model.js';
import Product, { PRODUCT_OWNER_TYPES } from '../src/models/product.model.js';
import Order from '../src/models/order.model.js';
import Payment from '../src/models/payment.model.js';
import ShopInvitation from '../src/models/shop-invitation.model.js';
import { DECOR_CATEGORIES, DECOR_PRODUCTS_BY_CATEGORY, DECOR_SHOPS } from '../src/data/decor.seed-data.js';
import { ensureRbacSeedData } from '../src/services/rbac/rbac-seed.service.js';
import PERMISSIONS from '../src/constants/permission.constant.js';
import { INVITATION_STATUS, ORDER_STATUS, PAYMENT_STATUS, SHOP_STATUS } from '../src/constants/status.constant.js';

const SEED_OWNER_EMAIL = 'owner@gmail.com';
const SEED_BUYER_EMAIL = 'buyer@gmail.com';
const SEED_STAFF_EMAIL = 'staff@gmail.com';
const SEED_ADMIN_EMAIL = 'admin@gmail.com';
const SEED_EMAIL_VERIFIED_AT = new Date();

const upsertSeedUser = async ({ email, name, roles, address = {} }) => {
  let user = await User.findOne({ email });

  if (!user) {
    user = await User.create({
      name,
      email,
      password: '123456',
      roles,
      isVerified: true,
      emailVerifiedAt: SEED_EMAIL_VERIFIED_AT,
      emailVerificationToken: null,
      emailVerificationExpires: null,
      address,
    });
  } else {
    user.name = name;
    user.roles = roles;
    user.isVerified = true;
    user.emailVerifiedAt = user.emailVerifiedAt || SEED_EMAIL_VERIFIED_AT;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    user.address = { ...(user.address || {}), ...address };
    await user.save();
    await User.updateOne({ _id: user._id }, { $unset: { role: '' } });
  }

  return user;
};

const upsertUsers = async () => {
  const admin = await upsertSeedUser({
    email: SEED_ADMIN_EMAIL,
    name: 'Admin',
    roles: ['admin'],
    address: {
      province: '',
      district: '',
      detail: '',
    },
  });

  const owner = await upsertSeedUser({
    email: SEED_OWNER_EMAIL,
    name: 'Decor Seed Owner',
    roles: ['shop_owner'],
    address: {
      province: 'Ha Noi',
      district: 'Hoan Kiem',
      detail: '12 Hang Gai',
    },
  });

  const buyer = await upsertSeedUser({
    email: SEED_BUYER_EMAIL,
    name: 'Decor Seed Buyer',
    roles: ['member'],
    address: {
      province: 'Ho Chi Minh',
      district: 'District 3',
      detail: '86 Nam Ky Khoi Nghia',
    },
  });

  const staff = await upsertSeedUser({
    email: SEED_STAFF_EMAIL,
    name: 'Decor Seed Staff',
    roles: ['staff'],
    address: {
      province: 'Da Nang',
      district: 'Son Tra',
      detail: '28 Tran Hung Dao',
    },
  });

  return { admin, owner, buyer, staff };
};

const upsertCategories = async () => {
  const categoryDocs = [];

  for (const category of DECOR_CATEGORIES) {
    const doc = await Category.findOneAndUpdate(
      { slug: category.slug },
      { $set: category },
      { upsert: true, returnDocument: 'after', runValidators: true }
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
          status: SHOP_STATUS.ACTIVE,
          isActive: true,
        },
      },
      { upsert: true, returnDocument: 'after', runValidators: true }
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
        stock: product.stock,
        listingType: product.listingType,
        condition: product.condition,
        location: product.location,
        category: category._id,
        owner: ownerId,
        ownerType: PRODUCT_OWNER_TYPES.SHOP,
        shop: shop._id,
        status: 'available',
        isActive: true,
        decorRole: product.decorRole ?? null,
        style: product.style ?? null,
        roomType: product.roomType ?? null,
        colorTone: product.colorTone ?? null,
        comboPriority: product.comboPriority ?? null,
      };

      const doc = await Product.findOneAndUpdate(
        { title: product.title, category: category._id, owner: ownerId },
        { $set: payload, $setOnInsert: { views: 0 } },
        { upsert: true, returnDocument: 'after', runValidators: true }
      );

      createdProducts.push(doc);
    }
  }

  return createdProducts;
};

const upsertShopStaff = async (shopsBySlug, staffUser, ownerId) => {
  const firstShop = Object.values(shopsBySlug)[0];
  if (!firstShop) return null;

  const permissions = [
    PERMISSIONS.SHOP_READ,
    PERMISSIONS.PRODUCT_CREATE,
    PERMISSIONS.PRODUCT_UPDATE,
    PERMISSIONS.ORDER_READ,
    PERMISSIONS.ORDER_CONFIRM,
  ];

  const updatedShop = await Shop.findOneAndUpdate(
    { _id: firstShop._id },
    {
      $addToSet: { staff: staffUser._id },
      $set: {
        staffPermissions: [
          {
            staffUser: staffUser._id,
            permissions,
            updatedBy: ownerId,
            updatedAt: new Date(),
          },
        ],
      },
    },
    { returnDocument: 'after', runValidators: true }
  );

  await ShopInvitation.findOneAndUpdate(
    { shop: firstShop._id, invitee: staffUser._id, inviter: ownerId },
    {
      $set: {
        role: 'STAFF',
        permissions,
        status: INVITATION_STATUS.ACCEPTED,
        rejectionReason: '',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      $setOnInsert: {
        shop: firstShop._id,
        invitee: staffUser._id,
        inviter: ownerId,
      },
    },
    { upsert: true, returnDocument: 'after', runValidators: true }
  );

  return updatedShop;
};

const upsertOrdersAndPayments = async ({ buyer, products }) => {
  const targetProducts = products.slice(0, 2);
  const orders = [];
  const payments = [];

  for (const product of targetProducts) {
    const order = await Order.findOneAndUpdate(
      { buyer: buyer._id, product: product._id, shop: product.shop },
      {
        $set: {
          buyer: buyer._id,
          shop: product.shop,
          product: product._id,
          quantity: 1,
          unitPrice: product.price,
          totalAmount: product.price,
          status: ORDER_STATUS.DELIVERED,
          shippingAddress: buyer.address,
          note: 'Seed order',
          paymentStatus: PAYMENT_STATUS.PAID,
          paymentMethod: 'payos',
          paymentProvider: 'payos',
          paidAt: new Date(),
          isActive: true,
        },
        $setOnInsert: {
          history: [
            {
              status: ORDER_STATUS.PENDING,
              note: 'Seed order created',
              updatedBy: buyer._id,
              updatedAt: new Date(),
            },
            {
              status: ORDER_STATUS.DELIVERED,
              note: 'Seed order delivered',
              updatedBy: buyer._id,
              updatedAt: new Date(),
            },
          ],
        },
      },
      { upsert: true, returnDocument: 'after', runValidators: true }
    );

    const transactionRef = `SEED_PAY_${order._id.toString()}`;
    const payment = await Payment.findOneAndUpdate(
      { transactionRef },
      {
        $set: {
          order: order._id,
          buyer: buyer._id,
          amount: order.totalAmount,
          provider: 'payos',
          method: 'payos',
          status: PAYMENT_STATUS.PAID,
          responseCode: '00',
          rawCallbackData: { seed: true, transactionRef },
          paidAt: new Date(),
        },
        $setOnInsert: {
          transactionRef,
        },
      },
      { upsert: true, returnDocument: 'after', runValidators: true }
    );

    await Order.findByIdAndUpdate(order._id, { paymentRef: transactionRef });
    await Product.findByIdAndUpdate(product._id, { status: 'sold' });

    orders.push(order);
    payments.push(payment);
  }

  return { orders, payments };
};

const main = async () => {
  if (!env.mongodb.uri) {
    throw new Error('MONGODB_URI is missing');
  }

  await connectDB();

  try {
    await ensureRbacSeedData();
    const { admin, owner, buyer, staff } = await upsertUsers();
    const categoriesBySlug = await upsertCategories();
    const shopsBySlug = await upsertShops(owner._id);
    await upsertShopStaff(shopsBySlug, staff, owner._id);
    const products = await upsertProducts(owner._id, categoriesBySlug, shopsBySlug);
    const { orders, payments } = await upsertOrdersAndPayments({ buyer, products });

    console.log(`Database: ${mongoose.connection.name}`);
    console.log('Seeded roles and permissions');
    console.log('Seeded users: 4');
    console.log(`Seeded categories: ${Object.keys(categoriesBySlug).length}`);
    console.log(`Seeded shops: ${Object.keys(shopsBySlug).length}`);
    console.log(`Seeded products: ${products.length}`);
    console.log(`Seeded orders: ${orders.length}`);
    console.log(`Seeded payments: ${payments.length}`);
    console.log('Seeded shop invitations: 1');
    console.log(`Seed admin: ${admin.email}`);
    console.log(`Seed owner: ${owner.email}`);
  } finally {
    await disconnectDB();
    await mongoose.disconnect().catch(() => {});
  }
};

main().catch((error) => {
  console.error('Seed failed:', error.message);
  process.exitCode = 1;
});

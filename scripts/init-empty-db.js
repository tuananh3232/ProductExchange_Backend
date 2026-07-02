import mongoose from 'mongoose';
import { env } from '../src/configs/env.config.js';
import { connectDB, disconnectDB } from '../src/configs/database.config.js';
import User from '../src/models/user.model.js';
import { ROLES } from '../src/constants/role.constant.js';
import { ensureRbacSeedData } from '../src/services/rbac/rbac-seed.service.js';

import '../src/models/cart.model.js';
import '../src/models/category.model.js';
import '../src/models/conversation.model.js';
import '../src/models/message.model.js';
import '../src/models/notification.model.js';
import '../src/models/order.model.js';
import '../src/models/payment.model.js';
import '../src/models/permission.model.js';
import '../src/models/product.model.js';
import '../src/models/review.model.js';
import '../src/models/role.model.js';
import '../src/models/room-project.model.js';
import '../src/models/room-scene.model.js';
import '../src/models/shop-invitation.model.js';
import '../src/models/shop.model.js';
import '../src/models/subscription-order.model.js';
import '../src/models/user-wallet-topup.model.js';
import '../src/models/user-wallet-transaction.model.js';
import '../src/models/user-wallet-withdrawal.model.js';
import '../src/models/user-wallet.model.js';
import '../src/models/wallet-transaction.model.js';
import '../src/models/wallet.model.js';
import '../src/models/withdrawal-request.model.js';

const ADMIN_EMAIL = process.env.INIT_ADMIN_EMAIL || 'admin@gmail.com';
const ADMIN_PASSWORD = process.env.INIT_ADMIN_PASSWORD || '123456';
const SKIP_RBAC = process.env.INIT_DB_SKIP_RBAC === 'true';

const createCollectionsAndIndexes = async () => {
  const createdCollections = [];

  for (const modelName of mongoose.modelNames().sort()) {
    const model = mongoose.model(modelName);
    await model.createCollection().catch((error) => {
      if (error?.codeName !== 'NamespaceExists') throw error;
    });
    await model.init();
    createdCollections.push(model.collection.name);
  }

  return createdCollections;
};

const upsertAdmin = async () => {
  const now = new Date();
  const admin = await User.findOne({ email: ADMIN_EMAIL }).select('+password');

  if (!admin) {
    return User.create({
      name: 'Admin',
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      roles: [ROLES.ADMIN],
      isVerified: true,
      emailVerifiedAt: now,
      emailVerificationToken: null,
      emailVerificationExpires: null,
      isActive: true,
    });
  }

  admin.name = 'Admin';
  admin.password = ADMIN_PASSWORD;
  admin.roles = [ROLES.ADMIN];
  admin.isVerified = true;
  admin.emailVerifiedAt = admin.emailVerifiedAt || now;
  admin.emailVerificationToken = null;
  admin.emailVerificationExpires = null;
  admin.isActive = true;
  await admin.save();
  return admin;
};

const main = async () => {
  if (!env.mongodb.uri) {
    throw new Error('MONGODB_URI is missing');
  }

  await connectDB();

  try {
    const collections = await createCollectionsAndIndexes();

    if (!SKIP_RBAC) {
      await ensureRbacSeedData();
    }

    const admin = await upsertAdmin();

    console.log(`Database: ${mongoose.connection.name}`);
    console.log(`Collections ready: ${collections.length}`);
    console.log(`RBAC seed: ${SKIP_RBAC ? 'skipped' : 'created/updated'}`);
    console.log(`Admin email: ${admin.email}`);
    console.log('Admin password: 123456');
  } finally {
    await disconnectDB();
    await mongoose.disconnect().catch(() => {});
  }
};

main().catch((error) => {
  console.error('Init database failed:', error.message);
  process.exitCode = 1;
});

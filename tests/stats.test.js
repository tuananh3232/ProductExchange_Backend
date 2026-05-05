import request from 'supertest';
import { jest } from '@jest/globals';
import app from '../src/server.js';
import User from '../src/models/user.model.js';
import Shop from '../src/models/shop.model.js';
import Category from '../src/models/category.model.js';
import Product from '../src/models/product.model.js';
import Order from '../src/models/order.model.js';
import Payment from '../src/models/payment.model.js';
import { PAYMENT_STATUS, ORDER_STATUS } from '../src/constants/status.constant.js';
import { env } from '../src/configs/env.config.js';

jest.setTimeout(30000);

const createToken = async (userId) => {
  const jwt = await import('jsonwebtoken');
  return jwt.default.sign({ userId: userId.toString() }, env.jwt.secret, { expiresIn: env.jwt.expiresIn });
};

describe('Statistics API', () => {
  let adminUser;
  let adminToken;
  let ownerUser;
  let ownerToken;
  let buyerUser;
  let shop;
  let product;
  let order;

  beforeEach(async () => {
    await Promise.all([
      Payment.deleteMany({}),
      Order.deleteMany({}),
      Product.deleteMany({}),
      Shop.deleteMany({}),
      Category.deleteMany({}),
      User.deleteMany({}),
    ]);

    adminUser = await User.create({
      name: 'Stats Admin',
      email: 'stats-admin@example.com',
      password: '123456',
      roles: ['admin'],
      role: 'admin',
    });

    ownerUser = await User.create({
      name: 'Stats Owner',
      email: 'stats-owner@example.com',
      password: '123456',
      roles: ['shop_owner'],
      role: 'shop_owner',
    });

    buyerUser = await User.create({
      name: 'Stats Buyer',
      email: 'stats-buyer@example.com',
      password: '123456',
      roles: ['user'],
    });

    adminToken = await createToken(adminUser._id);
    ownerToken = await createToken(ownerUser._id);

    const category = await Category.create({ name: 'Thong ke', slug: 'thong-ke' });

    shop = await Shop.create({
      name: 'Stats Shop',
      slug: 'stats-shop',
      owner: ownerUser._id,
      staff: [],
    });

    product = await Product.create({
      title: 'Stats Product',
      description: 'San pham phuc vu test thong ke',
      price: 500000,
      listingType: 'sell',
      condition: 'good',
      category: category._id,
      owner: ownerUser._id,
      shop: shop._id,
      status: 'sold',
      views: 15,
    });

    order = await Order.create({
      buyer: buyerUser._id,
      shop: shop._id,
      product: product._id,
      quantity: 2,
      unitPrice: 500000,
      totalAmount: 1000000,
      status: ORDER_STATUS.DELIVERED,
      paymentStatus: PAYMENT_STATUS.PAID,
      paidAt: new Date('2026-04-20T08:00:00.000Z'),
      history: [{ status: ORDER_STATUS.DELIVERED, updatedBy: buyerUser._id, note: 'done' }],
    });

    await Payment.create({
      order: order._id,
      buyer: buyerUser._id,
      amount: 1000000,
      provider: 'vnpay',
      method: 'vnpay',
      status: PAYMENT_STATUS.PAID,
      transactionRef: `STATS-${order._id.toString()}`,
      paidAt: new Date('2026-04-20T08:00:00.000Z'),
    });


  });

  afterAll(async () => {
    const mongoose = await import('mongoose');
    await mongoose.default.disconnect();
  });

  it('returns admin dashboard statistics', async () => {
    const res = await request(app)
      .get('/api/v1/admin/stats/overview')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.revenue.totalRevenue).toBe(1000000);
    expect(res.body.data.totals.shops).toBe(1);
    expect(res.body.data.orders[ORDER_STATUS.DELIVERED]).toBe(1);
    expect(res.body.data.products.sold).toBe(1);

    const revenueRes = await request(app)
      .get('/api/v1/admin/stats/revenue')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ period: 'day' });

    expect(revenueRes.statusCode).toBe(200);
    expect(revenueRes.body.data.summary.totalRevenue).toBe(1000000);
    expect(revenueRes.body.data.series).toHaveLength(1);
  });

  it('returns shop dashboard statistics for the owner', async () => {
    const res = await request(app)
      .get(`/api/v1/shops/${shop._id.toString()}/stats/overview`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.revenue.totalRevenue).toBe(1000000);
    expect(res.body.data.totals.orders).toBe(1);
    expect(res.body.data.products.sold).toBe(1);
    expect(res.body.data.topProducts).toHaveLength(1);
    expect(res.body.data.shop.staffCount).toBe(0);

    const ordersRes = await request(app)
      .get(`/api/v1/shops/${shop._id.toString()}/stats/orders`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(ordersRes.statusCode).toBe(200);
    expect(ordersRes.body.data.summary.delivered).toBe(1);
  });
});
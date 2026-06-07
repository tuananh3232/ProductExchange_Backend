import crypto from 'crypto';
import request from 'supertest';
import app from '../../src/server.js';
import User from '../../src/models/user.model.js';
import Shop from '../../src/models/shop.model.js';
import Category from '../../src/models/category.model.js';
import Product from '../../src/models/product.model.js';
import Order from '../../src/models/order.model.js';
import Payment from '../../src/models/payment.model.js';
import { env } from '../../src/configs/env.config.js';
import { jest } from '@jest/globals';

jest.setTimeout(30000);

const createToken = async (userId, role = 'member') => {
  const jwt = await import('jsonwebtoken');
  return jwt.default.sign({ userId: userId.toString(), role }, env.jwt.secret, { expiresIn: env.jwt.expiresIn });
};

const signVnpayQuery = (payload) => {
  const sortedQuery = [...Object.entries(payload)]
    .filter(([key]) => key !== 'vnp_SecureHash' && key !== 'vnp_SecureHashType')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');

  return crypto.createHmac('sha512', env.payment.vnpay.hashSecret).update(Buffer.from(sortedQuery, 'utf-8')).digest('hex');
};

describe('Payment API', () => {
  let buyer;
  let buyerToken;
  let shopOwner;
  let shop;
  let category;
  let product;
  let order;

  beforeEach(async () => {
    await Promise.all([Payment.deleteMany({}), Order.deleteMany({}), Product.deleteMany({}), Shop.deleteMany({}), Category.deleteMany({}), User.deleteMany({})]);

    buyer = await User.create({
      name: 'Payment Buyer',
      email: 'payment-buyer@example.com',
          password: '123456',
      roles: ['member'],
    });

    shopOwner = await User.create({
      name: 'Payment Shop Owner',
      email: 'payment-owner@example.com',
          password: '123456',
      roles: ['shop_owner'],
    });

    buyerToken = await createToken(buyer._id, 'member');
    category = await Category.create({ name: 'Noi that', slug: 'noi-that-payment' });
    shop = await Shop.create({
      name: 'Payment Shop',
      slug: 'payment-shop',
      owner: shopOwner._id,
      staff: [],
    });
    product = await Product.create({
      title: 'Payment Table',
      description: 'Ban thanh toan du dieu kien',
      price: 750000,
      listingType: 'sell',
      condition: 'new',
      category: category._id,
      owner: shopOwner._id,
      shop: shop._id,
      status: 'available',
    });
    order = await Order.create({
      buyer: buyer._id,
      shop: shop._id,
      product: product._id,
      quantity: 1,
      unitPrice: product.price,
      totalAmount: product.price,
      status: 'pending',
      paymentStatus: 'unpaid',
      history: [{ status: 'pending', updatedBy: buyer._id, note: 'Pending for payment test' }],
    });
  });

  afterAll(async () => {
    const mongoose = await import('mongoose');
    await mongoose.default.disconnect();
  });

  it('should create VNPay payment url for pending order', async () => {
    const res = await request(app)
      .post('/api/v1/payments/vnpay/create')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ orderId: order._id.toString() });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.paymentUrl).toContain(env.payment.vnpay.paymentUrl);
    expect(res.body.data.payment.transactionRef).toBeDefined();

    const freshOrder = await Order.findById(order._id);
    expect(freshOrder.paymentStatus).toBe('pending_payment');
    expect(freshOrder.paymentMethod).toBe('vnpay');
  });

  it('should process VNPay return callback and mark order as paid', async () => {
    const createRes = await request(app)
      .post('/api/v1/payments/vnpay/create')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ orderId: order._id.toString() });

    const transactionRef = createRes.body.data.payment.transactionRef;
    const callbackPayload = {
      vnp_Version: env.payment.vnpay.version,
      vnp_Command: env.payment.vnpay.command,
      vnp_TmnCode: env.payment.vnpay.tmnCode,
      vnp_Amount: `${Math.round(order.totalAmount * 100)}`,
      vnp_BankCode: 'NCB',
      vnp_OrderInfo: `Thanh toan don hang ${order._id.toString()}`,
      vnp_OrderType: env.payment.vnpay.orderType,
      vnp_PayDate: '20260426120000',
      vnp_ResponseCode: '00',
      vnp_TmnCode: env.payment.vnpay.tmnCode,
      vnp_TransactionNo: '12345678',
      vnp_TransactionStatus: '00',
      vnp_TxnRef: transactionRef,
      vnp_SecureHashType: 'HmacSHA512',
    };
    callbackPayload.vnp_SecureHash = signVnpayQuery(callbackPayload);

    const res = await request(app)
      .get('/api/v1/payments/vnpay/return')
      .query(callbackPayload);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('paid');

    const freshOrder = await Order.findById(order._id);
    expect(freshOrder.paymentStatus).toBe('paid');
    expect(freshOrder.paidAt).toBeDefined();

    const freshPayment = await Payment.findOne({ order: order._id });
    expect(freshPayment.status).toBe('paid');
    expect(freshPayment.vnpTransactionNo).toBe('12345678');
  });

  it('should cancel order and restore product when VNPay payment is cancelled', async () => {
    await Product.findByIdAndUpdate(product._id, { status: 'pending' });
    await Order.findByIdAndUpdate(order._id, {
      status: 'pending',
      paymentStatus: 'pending_payment',
      paymentMethod: 'vnpay',
      paymentProvider: 'vnpay',
      paymentRef: 'ORD_CANCEL_VNPAY',
    });
    await Payment.create({
      order: order._id,
      buyer: buyer._id,
      amount: order.totalAmount,
      provider: 'vnpay',
      method: 'vnpay',
      status: 'pending_payment',
      transactionRef: 'ORD_CANCEL_VNPAY',
    });

    const callbackPayload = {
      vnp_Version: env.payment.vnpay.version,
      vnp_Command: env.payment.vnpay.command,
      vnp_TmnCode: env.payment.vnpay.tmnCode,
      vnp_Amount: `${Math.round(order.totalAmount * 100)}`,
      vnp_BankCode: 'NCB',
      vnp_OrderInfo: `Thanh toan don hang ${order._id.toString()}`,
      vnp_OrderType: env.payment.vnpay.orderType,
      vnp_PayDate: '20260426120000',
      vnp_ResponseCode: '24',
      vnp_TransactionNo: '12345679',
      vnp_TransactionStatus: '02',
      vnp_TxnRef: 'ORD_CANCEL_VNPAY',
      vnp_SecureHashType: 'HmacSHA512',
    };
    callbackPayload.vnp_SecureHash = signVnpayQuery(callbackPayload);

    const res = await request(app)
      .get('/api/v1/payments/vnpay/return')
      .query(callbackPayload);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('cancelled');

    const freshOrder = await Order.findById(order._id);
    expect(freshOrder.status).toBe('cancelled');
    expect(freshOrder.paymentStatus).toBe('cancelled');

    const freshProduct = await Product.findById(product._id);
    expect(freshProduct.status).toBe('available');
  });

  it('should cancel order and restore product when PayOS payment is cancelled', async () => {
    await Product.findByIdAndUpdate(product._id, { status: 'pending' });
    await Order.findByIdAndUpdate(order._id, {
      status: 'pending',
      paymentStatus: 'pending_payment',
      paymentMethod: 'payos',
      paymentProvider: 'payos',
      paymentRef: 'PAYOS_123456789',
    });
    await Payment.create({
      order: order._id,
      buyer: buyer._id,
      amount: order.totalAmount,
      provider: 'payos',
      method: 'payos',
      status: 'pending_payment',
      transactionRef: 'PAYOS_123456789',
    });

    const res = await request(app)
      .get('/api/v1/payments/payos/cancel')
      .query({ orderCode: '123456789', cancel: 'true' });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('cancelled');

    const freshOrder = await Order.findById(order._id);
    expect(freshOrder.status).toBe('cancelled');
    expect(freshOrder.paymentStatus).toBe('cancelled');

    const freshProduct = await Product.findById(product._id);
    expect(freshProduct.status).toBe('available');
  });
});


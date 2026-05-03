import request from 'supertest';
import app from '../src/server.js';
import User from '../src/models/user.model.js';
import Product from '../src/models/product.model.js';
import Category from '../src/models/category.model.js';
import Exchange from '../src/models/exchange.model.js';

let user1Id, user2Id;
let product1Id, product2Id;
let categoryId;
let token1, token2;

const TEST_CATEGORY = {
  name: 'Điện thoại',
  slug: 'dien-thoai',
};

const TEST_PRODUCT = {
  title: 'iPhone 14 Pro Max',
  description: 'Điện thoại iPhone 14 Pro Max 256GB, máy còn mới',
  price: 25000000,
  listingType: 'exchange',
  condition: 'like_new',
  exchangeFor: 'iPad Pro',
  location: { province: 'Hà Nội', district: 'Hoàn Kiếm' },
};

const createToken = async (userId) => {
  const jwt = await import('jsonwebtoken');
  const { env } = await import('../src/configs/env.config.js');
  return jwt.default.sign(
    { userId: userId.toString(), role: 'user' },
    env.jwt.secret,
    { expiresIn: env.jwt.expiresIn }
  );
};

describe('Exchange API', () => {
  beforeEach(async () => {
    // Clear collections
    await User.deleteMany({});
    await Product.deleteMany({});
    await Category.deleteMany({});
    await Exchange.deleteMany({});

    // Create category
    const catRes = await Category.create(TEST_CATEGORY);
    categoryId = catRes._id;

    // Create users
    const user1 = await User.create({
      name: 'User 1',
      email: 'user1@example.com',
      password: 'password123',
    });
    user1Id = user1._id;

    const user2 = await User.create({
      name: 'User 2',
      email: 'user2@example.com',
      password: 'password123',
    });
    user2Id = user2._id;

    // Create tokens
    token1 = await createToken(user1Id);
    token2 = await createToken(user2Id);

    // Create products for each user
    const prod1 = await Product.create({
      ...TEST_PRODUCT,
      title: 'iPhone 14 Pro Max',
      owner: user1Id,
      category: categoryId,
    });
    product1Id = prod1._id;

    const prod2 = await Product.create({
      ...TEST_PRODUCT,
      title: 'Samsung Galaxy S23',
      owner: user2Id,
      category: categoryId,
    });
    product2Id = prod2._id;
  });

  describe('POST /api/v1/exchanges', () => {
    it('should create exchange request', async () => {
      const res = await request(app)
        .post('/api/v1/exchanges')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          requestedProduct: product2Id,
          offeredProduct: product1Id,
          message: 'Tôi muốn trao đổi iPhone của bạn lấy Samsung này',
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.exchange.status).toBe('pending');
      expect(res.body.data.exchange.history.length).toBe(1);
    });

    it('should fail if trying to exchange own product', async () => {
      const res = await request(app)
        .post('/api/v1/exchanges')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          requestedProduct: product1Id,
          offeredProduct: product1Id,
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should fail if offered product is not user\'s', async () => {
      const res = await request(app)
        .post('/api/v1/exchanges')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          requestedProduct: product2Id,
          offeredProduct: product2Id, // Not user1's product
        });

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/exchanges', () => {
    beforeEach(async () => {
      // Create exchange request
      await Exchange.create({
        requester: user1Id,
        receiver: user2Id,
        requestedProduct: product2Id,
        offeredProduct: product1Id,
        status: 'pending',
      });
    });

    it('should get exchanges list for authenticated user', async () => {
      const res = await request(app)
        .get('/api/v1/exchanges')
        .set('Authorization', `Bearer ${token1}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.exchanges)).toBe(true);
      expect(res.body.meta).toBeDefined();
    });

    it('should filter by role query', async () => {
      const res = await request(app)
        .get('/api/v1/exchanges')
        .set('Authorization', `Bearer ${token1}`)
        .query({ role: 'requester' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .get('/api/v1/exchanges');

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/exchanges/:id', () => {
    let exchangeId;

    beforeEach(async () => {
      const exchange = await Exchange.create({
        requester: user1Id,
        receiver: user2Id,
        requestedProduct: product2Id,
        offeredProduct: product1Id,
        status: 'pending',
      });
      exchangeId = exchange._id;
    });

    it('should allow related user to get exchange detail', async () => {
      const res = await request(app)
        .get(`/api/v1/exchanges/${exchangeId}`)
        .set('Authorization', `Bearer ${token1}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should reject non-related user by data scope', async () => {
      const user3 = await User.create({
        name: 'User 3',
        email: 'scope-user3@example.com',
        password: 'password123',
      });
      const token3 = await createToken(user3._id);

      const res = await request(app)
        .get(`/api/v1/exchanges/${exchangeId}`)
        .set('Authorization', `Bearer ${token3}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PATCH /api/v1/exchanges/:id/respond', () => {
    let exchangeId;

    beforeEach(async () => {
      const exchange = await Exchange.create({
        requester: user1Id,
        receiver: user2Id,
        requestedProduct: product2Id,
        offeredProduct: product1Id,
        status: 'pending',
      });
      exchangeId = exchange._id;
    });

    it('should accept exchange request', async () => {
      const res = await request(app)
        .patch(`/api/v1/exchanges/${exchangeId}/respond`)
        .set('Authorization', `Bearer ${token2}`)
        .send({ action: 'accept' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.exchange.status).toBe('accepted');
      expect(res.body.data.exchange.history.some((item) => item.status === 'accepted')).toBe(true);
    });

    it('should reject exchange request', async () => {
      const res = await request(app)
        .patch(`/api/v1/exchanges/${exchangeId}/respond`)
        .set('Authorization', `Bearer ${token2}`)
        .send({
          action: 'reject',
          rejectionReason: 'Tôi không quan tâm đến sản phẩm này',
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.exchange.status).toBe('rejected');
    });

    it('should fail if not receiver', async () => {
      const res = await request(app)
        .patch(`/api/v1/exchanges/${exchangeId}/respond`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ action: 'accept' });

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PATCH /api/v1/exchanges/:id/complete', () => {
    let exchangeId;

    beforeEach(async () => {
      const exchange = await Exchange.create({
        requester: user1Id,
        receiver: user2Id,
        requestedProduct: product2Id,
        offeredProduct: product1Id,
        status: 'accepted',
      });
      exchangeId = exchange._id;
    });

    it('should complete exchange', async () => {
      const res = await request(app)
        .patch(`/api/v1/exchanges/${exchangeId}/complete`)
        .set('Authorization', `Bearer ${token1}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.exchange.status).toBe('completed');
      expect(res.body.data.exchange.history.some((item) => item.status === 'completed')).toBe(true);

      const freshRequestedProduct = await Product.findById(product2Id);
      const freshOfferedProduct = await Product.findById(product1Id);
      expect(freshRequestedProduct.status).toBe('exchanged');
      expect(freshOfferedProduct.status).toBe('exchanged');
    });

    it('should fail if not party to exchange', async () => {
      // Create third user
      const user3 = await User.create({
        name: 'User 3',
        email: 'user3@example.com',
        password: 'password123',
      });
      const token3 = await createToken(user3._id);

      const res = await request(app)
        .patch(`/api/v1/exchanges/${exchangeId}/complete`)
        .set('Authorization', `Bearer ${token3}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PATCH /api/v1/exchanges/:id/cancel', () => {
    let exchangeId;

    beforeEach(async () => {
      const exchange = await Exchange.create({
        requester: user1Id,
        receiver: user2Id,
        requestedProduct: product2Id,
        offeredProduct: product1Id,
        status: 'pending',
      });
      exchangeId = exchange._id;
    });

    it('should cancel pending exchange', async () => {
      const res = await request(app)
        .patch(`/api/v1/exchanges/${exchangeId}/cancel`)
        .set('Authorization', `Bearer ${token1}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.exchange.status).toBe('cancelled');
      expect(res.body.data.exchange.history.some((item) => item.status === 'cancelled')).toBe(true);
    });

    it('should fail if not requester', async () => {
      const res = await request(app)
        .patch(`/api/v1/exchanges/${exchangeId}/cancel`)
        .set('Authorization', `Bearer ${token2}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('exchange product lifecycle guard', () => {
    it('should reject exchange if requested product is not available anymore', async () => {
      await Product.findByIdAndUpdate(product2Id, { status: 'hidden' });

      const res = await request(app)
        .post('/api/v1/exchanges')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          requestedProduct: product2Id,
          offeredProduct: product1Id,
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});

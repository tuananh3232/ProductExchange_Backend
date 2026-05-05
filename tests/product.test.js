import request from 'supertest';
import app from '../src/server.js';
import User from '../src/models/user.model.js';
import Product from '../src/models/product.model.js';
import Category from '../src/models/category.model.js';
import Shop from '../src/models/shop.model.js';

let userId;
let productId;
let categoryId;
let token;
let shopId;
import { TEST_CATEGORIES, TEST_PRODUCTS_BY_CATEGORY, createToken } from './fixtures/testData.js'

const seedDecorCategories = async () => {
  const createdCategories = await Category.insertMany(TEST_CATEGORIES)
  return Object.fromEntries(createdCategories.map((category) => [category.slug, category]))
}

const getPrimaryProductForCategory = (categorySlug) => TEST_PRODUCTS_BY_CATEGORY[categorySlug][0]

describe('Product API', () => {
  beforeEach(async () => {
    // Clear collections
    await User.deleteMany({});
    await Product.deleteMany({});
    await Category.deleteMany({});
    await Shop.deleteMany({});

    const categoriesBySlug = await seedDecorCategories()
    categoryId = categoriesBySlug['do-trang-tri']._id;

    // Create user and get token
    const userRes = await User.create({
      name: 'Test User',
      email: 'test@example.com',
      password: '123456',
    });
    userId = userRes._id;

    // Manually generate token since we're not going through auth endpoint
    token = await createToken(userId, 'user')

    const shop = await Shop.create({
      name: 'Test Shop',
      slug: 'test-shop',
      owner: userId,
      staff: [],
    });
    shopId = shop._id;
  });

  describe('POST /api/v1/products', () => {
    it('should create a product', async () => {
      const productData = getPrimaryProductForCategory('do-trang-tri')
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ...productData,
          category: categoryId,
          shop: shopId,
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.product.title).toBe(productData.title);
      expect(res.body.data.product.owner).toBe(userId.toString());
      expect(res.body.data.product.shop).toBe(shopId.toString());
    });

    it('should fail without authentication', async () => {
      const productData = getPrimaryProductForCategory('do-trang-tri')
      const res = await request(app)
        .post('/api/v1/products')
        .send({
          ...productData,
          category: categoryId,
        });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should fail with missing required fields', async () => {
      const productData = getPrimaryProductForCategory('do-trang-tri')
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: productData.title,
          // Missing other required fields
        });

      expect(res.statusCode).toBe(422);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/products', () => {
    beforeEach(async () => {
      // Create test products
      const categoriesBySlug = await seedDecorCategories()
      const seedEntries = Object.entries(TEST_PRODUCTS_BY_CATEGORY)
      await Promise.all(
        seedEntries.map(([slug, products]) =>
          Product.create({
            ...products[0],
            owner: userId,
            category: categoriesBySlug[slug]._id,
          })
        )
      )
    });

    it('should get products list', async () => {
      const res = await request(app)
        .get('/api/v1/products')
        .query({ page: 1, limit: 10 });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.products)).toBe(true);
      expect(res.body.meta).toBeDefined();
    });

    it('should filter products by category', async () => {
      const res = await request(app)
        .get('/api/v1/products')
        .query({ category: categoryId });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should search products by title', async () => {
      const searchTerm = TEST_PRODUCTS_BY_CATEGORY['tranh-treo-tuong'][0].title.split(' ')[0];
      const res = await request(app)
        .get('/api/v1/products')
        .query({ search: searchTerm });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/v1/products/:id', () => {
    beforeEach(async () => {
      const productData = getPrimaryProductForCategory('do-trang-tri')
      const product = await Product.create({
        ...productData,
        owner: userId,
        category: categoryId,
      });
      productId = product._id;
    });

    it('should get product detail', async () => {
      const res = await request(app)
        .get(`/api/v1/products/${productId}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.product._id).toBe(productId.toString());
    });

    it('should fail with invalid product id', async () => {
      const res = await request(app)
        .get('/api/v1/products/invalid_id');

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PATCH /api/v1/products/:id', () => {
    beforeEach(async () => {
      const productData = getPrimaryProductForCategory('do-trang-tri')
      const product = await Product.create({
        ...productData,
        owner: userId,
        category: categoryId,
      });
      productId = product._id;
    });

    it('should update product', async () => {
      const res = await request(app)
        .patch(`/api/v1/products/${productId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          price: 23000000,
          title: 'iPhone 14 Pro Max - Updated',
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.product.price).toBe(23000000);
    });

    it('should fail if not product owner', async () => {
      // Create another user
      const user2 = await User.create({
        name: 'Another User',
        email: 'other@example.com',
        password: '123456',
      });

      const jwt = await import('jsonwebtoken');
      const { env } = await import('../src/configs/env.config.js');
      const token2 = jwt.default.sign(
        { userId: user2._id.toString(), role: 'user' },
        env.jwt.secret,
        { expiresIn: env.jwt.expiresIn }
      );

      const res = await request(app)
        .patch(`/api/v1/products/${productId}`)
        .set('Authorization', `Bearer ${token2}`)
        .send({ price: 20000000 });

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('DELETE /api/v1/products/:id', () => {
    beforeEach(async () => {
      const productData = getPrimaryProductForCategory('do-trang-tri')
      const product = await Product.create({
        ...productData,
        owner: userId,
        category: categoryId,
      });
      productId = product._id;
    });

    it('should delete product (soft delete)', async () => {
      const res = await request(app)
        .delete(`/api/v1/products/${productId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify product is soft deleted
      const product = await Product.findById(productId);
      expect(product.isActive).toBe(false);
    });
  });

  describe('PATCH /api/v1/products/:id/status', () => {
    beforeEach(async () => {
      const productData = getPrimaryProductForCategory('do-trang-tri')
      const product = await Product.create({
        ...productData,
        owner: userId,
        category: categoryId,
        shop: shopId,
      });
      productId = product._id;
    });

    it('should update product status with valid transition', async () => {
      const res = await request(app)
        .patch(`/api/v1/products/${productId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'hidden' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.product.status).toBe('hidden');
    });

    it('should reject invalid status transition', async () => {
      await Product.findByIdAndUpdate(productId, { status: 'sold' });

      const res = await request(app)
        .patch(`/api/v1/products/${productId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'available' });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Product image APIs', () => {
    beforeEach(async () => {
      const productData = getPrimaryProductForCategory('do-trang-tri')
      const product = await Product.create({
        ...productData,
        owner: userId,
        category: categoryId,
        shop: shopId,
        images: [
          {
            url: 'https://img.example.com/old.jpg',
            publicId: 'old-image',
          },
        ],
      });
      productId = product._id;
    });

    it('should add product images', async () => {
      const res = await request(app)
        .post(`/api/v1/products/${productId}/images`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          images: [
            {
              url: 'https://img.example.com/new.jpg',
              publicId: 'new-image',
            },
          ],
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.product.images.length).toBeGreaterThanOrEqual(2);
    });

    it('should remove product image', async () => {
      const res = await request(app)
        .delete(`/api/v1/products/${productId}/images/old-image`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      const imageIds = res.body.data.product.images.map((image) => image.publicId);
      expect(imageIds).not.toContain('old-image');
    });
  });
});

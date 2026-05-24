import request from 'supertest';
import app from '../src/server.js';
import User from '../src/models/user.model.js';
import Product from '../src/models/product.model.js';
import Category from '../src/models/category.model.js';
import Shop from '../src/models/shop.model.js';
import { TEST_CATEGORIES, TEST_PRODUCTS_BY_CATEGORY, createToken } from './fixtures/testData.js'
import { SHOP_STATUS } from '../src/constants/status.constant.js'

let userId;
let productId;
let categoryId;
let token;
let shopId;

const seedDecorCategories = async () => {
  await Category.bulkWrite(
    TEST_CATEGORIES.map((category) => ({
      updateOne: {
        filter: { slug: category.slug },
        update: { $setOnInsert: category },
        upsert: true,
      },
    }))
  )
  const categories = await Category.find({ slug: { $in: TEST_CATEGORIES.map((category) => category.slug) } })
  return Object.fromEntries(categories.map((category) => [category.slug, category]))
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
      roles: ['shop_owner'],
    });
    userId = userRes._id;

    // Manually generate token since we're not going through auth endpoint
    token = await createToken(userId, 'shop_owner')

    const shop = await Shop.create({
      name: 'Test Shop',
      slug: 'test-shop',
      owner: userId,
      staff: [],
      status: SHOP_STATUS.ACTIVE,
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
      expect(res.body.data.product.stock).toBe(productData.stock);
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

    it('should reject member from creating a personal product', async () => {
      const member = await User.create({
        name: 'Plain Member',
        email: 'member-product@example.com',
        password: '123456',
        roles: ['member'],
      })
      const memberToken = await createToken(member._id, 'member')
      const productData = getPrimaryProductForCategory('do-trang-tri')

      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          ...productData,
          category: categoryId,
          ownerType: 'SELLER',
        })

      expect(res.statusCode).toBe(403)
      expect(res.body.success).toBe(false)
    })

    it('should allow seller to create a personal product', async () => {
      const seller = await User.create({
        name: 'Personal Seller',
        email: 'seller-product@example.com',
        password: '123456',
        roles: ['member', 'seller'],
      })
      const sellerToken = await createToken(seller._id, 'seller')
      const productData = getPrimaryProductForCategory('do-trang-tri')

      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          ...productData,
          category: categoryId,
          ownerType: 'SELLER',
        })

      expect(res.statusCode).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data.product.ownerType).toBe('SELLER')
      expect(res.body.data.product.seller).toBe(seller._id.toString())
      expect(res.body.data.product.shop).toBeNull()
    })

    it('should ignore a forged seller id when seller creates a personal product', async () => {
      const seller = await User.create({
        name: 'Forged Seller',
        email: 'forged-seller@example.com',
        password: '123456',
        roles: ['member', 'seller'],
      })
      const otherSeller = await User.create({
        name: 'Other Seller',
        email: 'other-forged-seller@example.com',
        password: '123456',
        roles: ['member', 'seller'],
      })
      const sellerToken = await createToken(seller._id, 'seller')
      const productData = getPrimaryProductForCategory('do-trang-tri')

      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          ...productData,
          category: categoryId,
          ownerType: 'SELLER',
          seller: otherSeller._id.toString(),
        })

      expect(res.statusCode).toBe(201)
      expect(res.body.data.product.seller).toBe(seller._id.toString())
    })
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
            shop: shopId,
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
      expect(res.body.data.products[0].stock).toBeDefined();
      expect(res.body.meta).toBeDefined();
    });

    it('should filter products by category', async () => {
      const res = await request(app)
        .get('/api/v1/products')
        .query({ category: categoryId.toString() });

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
        shop: shopId,
      });
      productId = product._id;
    });

    it('should get product detail', async () => {
      const res = await request(app)
        .get(`/api/v1/products/${productId}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.product._id).toBe(productId.toString());
      expect(res.body.data.product.stock).toBe(1);
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
        shop: shopId,
      });
      productId = product._id;
    });

    it('should update product', async () => {
      const res = await request(app)
        .patch(`/api/v1/products/${productId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          price: 23000000,
          stock: 9,
          title: 'iPhone 14 Pro Max - Updated',
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.product.price).toBe(23000000);
      expect(res.body.data.product.stock).toBe(9);
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
        { userId: user2._id.toString(), role: 'member' },
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

    it('should reject seller from updating another seller product', async () => {
      const seller = await User.create({
        name: 'Owner Seller',
        email: 'owner-seller@example.com',
        password: '123456',
        roles: ['member', 'seller'],
      })
      const otherSeller = await User.create({
        name: 'Other Seller',
        email: 'other-seller@example.com',
        password: '123456',
        roles: ['member', 'seller'],
      })
      const sellerProduct = await Product.create({
        ...getPrimaryProductForCategory('do-trang-tri'),
        category: categoryId,
        owner: seller._id,
        ownerType: 'SELLER',
        seller: seller._id,
      })
      const otherSellerToken = await createToken(otherSeller._id, 'seller')

      const res = await request(app)
        .patch(`/api/v1/products/${sellerProduct._id}`)
        .set('Authorization', `Bearer ${otherSellerToken}`)
        .send({ price: 990000 })

      expect(res.statusCode).toBe(403)
      expect(res.body.success).toBe(false)
    })

    it('should reject shop owner from updating a seller product', async () => {
      const seller = await User.create({
        name: 'Seller Product Owner',
        email: 'seller-owned-product@example.com',
        password: '123456',
        roles: ['member', 'seller'],
      })
      const sellerProduct = await Product.create({
        ...getPrimaryProductForCategory('do-trang-tri'),
        category: categoryId,
        owner: seller._id,
        ownerType: 'SELLER',
        seller: seller._id,
      })

      const res = await request(app)
        .patch(`/api/v1/products/${sellerProduct._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ price: 990000 })

      expect(res.statusCode).toBe(403)
      expect(res.body.success).toBe(false)
    })

    it('should reject seller from updating a shop product', async () => {
      const seller = await User.create({
        name: 'Shop Product Seller',
        email: 'shop-product-seller@example.com',
        password: '123456',
        roles: ['member', 'seller'],
      })
      const sellerToken = await createToken(seller._id, 'seller')

      const res = await request(app)
        .patch(`/api/v1/products/${productId}`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ price: 990000 })

      expect(res.statusCode).toBe(403)
      expect(res.body.success).toBe(false)
    })
  });

  describe('Product ownerType validation', () => {
    it('should validate SHOP and SELLER ownership exclusivity', async () => {
      const productData = getPrimaryProductForCategory('do-trang-tri')

      await expect(
        new Product({
          ...productData,
          owner: userId,
          ownerType: 'SHOP',
          category: categoryId,
        }).validate()
      ).rejects.toThrow()

      await expect(
        new Product({
          ...productData,
          owner: userId,
          ownerType: 'SHOP',
          category: categoryId,
          shop: shopId,
          seller: userId,
        }).validate()
      ).rejects.toThrow()

      await expect(
        new Product({
          ...productData,
          owner: userId,
          ownerType: 'SELLER',
          category: categoryId,
        }).validate()
      ).rejects.toThrow()

      await expect(
        new Product({
          ...productData,
          owner: userId,
          ownerType: 'SELLER',
          category: categoryId,
          seller: userId,
          shop: shopId,
        }).validate()
      ).rejects.toThrow()
    })
  })

  describe('DELETE /api/v1/products/:id', () => {
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

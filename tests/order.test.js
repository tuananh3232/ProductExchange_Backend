import request from 'supertest';
import app from '../src/server.js';
import User from '../src/models/user.model.js';
import Shop from '../src/models/shop.model.js';
import Category from '../src/models/category.model.js';
import Product from '../src/models/product.model.js';
import Order from '../src/models/order.model.js';

let buyer;
let shopOwner;
let staff;
let outsider;
let buyerToken;
let ownerToken;
let staffToken;
let outsiderToken;
let shop;
let product;
let category;

import { createToken } from './fixtures/testData.js'

describe('Order API', () => {
  beforeEach(async () => {
    await Promise.all([
      Order.deleteMany({}),
      Product.deleteMany({}),
      Shop.deleteMany({}),
      Category.deleteMany({}),
      User.deleteMany({}),
    ]);

    buyer = await User.create({
      name: 'Buyer',
      email: 'buyer-order@example.com',
      password: '123456',
      role: 'user',
      roles: ['user'],
    });

    shopOwner = await User.create({
      name: 'Shop Owner',
      email: 'owner-order@example.com',
      password: '123456',
      role: 'shop_owner',
      roles: ['shop_owner'],
    });

    staff = await User.create({
      name: 'Shop Staff',
      email: 'staff-order@example.com',
      password: '123456',
      role: 'staff',
      roles: ['staff'],
    });

    outsider = await User.create({
      name: 'Outsider',
      email: 'outsider-order@example.com',
      password: '123456',
      role: 'user',
      roles: ['user'],
    });

    buyerToken = await createToken(buyer._id, 'user');
    ownerToken = await createToken(shopOwner._id, 'shop_owner');
    staffToken = await createToken(staff._id, 'staff');
    outsiderToken = await createToken(outsider._id, 'user');

    category = await Category.create({ name: 'Noi that', slug: 'noi-that' });

    shop = await Shop.create({
      name: 'Decor Shop',
      slug: 'decor-shop',
      owner: shopOwner._id,
      staff: [staff._id],
    });

    product = await Product.create({
      title: 'Ban Trang Tri',
      description: 'Ban trang tri phong khach rat dep va ben',
      price: 500000,
      listingType: 'sell',
      condition: 'new',
      category: category._id,
      owner: shopOwner._id,
      shop: shop._id,
      status: 'available',
    });
  });

  it('should create order and set product pending', async () => {
    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        productId: product._id.toString(),
        quantity: 2,
        shippingAddress: {
          province: 'Ha Noi',
          district: 'Cau Giay',
          detail: '123 ABC',
        },
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.order.status).toBe('pending');
    expect(res.body.data.order.totalAmount).toBe(1000000);

    const freshProduct = await Product.findById(product._id);
    expect(freshProduct.status).toBe('pending');
  });

  it('should list orders for buyer scope', async () => {
    const order = await Order.create({
      buyer: buyer._id,
      shop: shop._id,
      product: product._id,
      quantity: 1,
      unitPrice: product.price,
      totalAmount: product.price,
      status: 'pending',
      history: [{ status: 'pending', updatedBy: buyer._id }],
    });

    const res = await request(app)
      .get('/api/v1/orders?scope=buyer')
      .set('Authorization', `Bearer ${buyerToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.orders.some((item) => item._id === order._id.toString())).toBe(true);
  });

  it('should allow shop owner confirm order', async () => {
    const order = await Order.create({
      buyer: buyer._id,
      shop: shop._id,
      product: product._id,
      quantity: 1,
      unitPrice: product.price,
      totalAmount: product.price,
      status: 'pending',
      history: [{ status: 'pending', updatedBy: buyer._id }],
    });

    const res = await request(app)
      .patch(`/api/v1/orders/${order._id}/confirm`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.order.status).toBe('confirmed');
    expect(res.body.data.order.history.length).toBeGreaterThan(1);
  });

  it('should allow staff update order status', async () => {
    const order = await Order.create({
      buyer: buyer._id,
      shop: shop._id,
      product: product._id,
      quantity: 1,
      unitPrice: product.price,
      totalAmount: product.price,
      status: 'confirmed',
      history: [
        { status: 'pending', updatedBy: buyer._id },
        { status: 'confirmed', updatedBy: shopOwner._id },
      ],
    });

    const res = await request(app)
      .patch(`/api/v1/orders/${order._id}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'processing', note: 'Dong goi hang' });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.order.status).toBe('processing');
  });

  it('should allow buyer cancel order and restore product availability', async () => {
    const order = await Order.create({
      buyer: buyer._id,
      shop: shop._id,
      product: product._id,
      quantity: 1,
      unitPrice: product.price,
      totalAmount: product.price,
      status: 'pending',
      history: [{ status: 'pending', updatedBy: buyer._id }],
    });

    await Product.findByIdAndUpdate(product._id, { status: 'pending' });

    const res = await request(app)
      .patch(`/api/v1/orders/${order._id}/cancel`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ note: 'Doi y' });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.order.status).toBe('cancelled');

    const freshProduct = await Product.findById(product._id);
    expect(freshProduct.status).toBe('available');
  });

  it('should reject outsider reading unrelated order', async () => {
    const order = await Order.create({
      buyer: buyer._id,
      shop: shop._id,
      product: product._id,
      quantity: 1,
      unitPrice: product.price,
      totalAmount: product.price,
      status: 'pending',
      history: [{ status: 'pending', updatedBy: buyer._id }],
    });

    const res = await request(app)
      .get(`/api/v1/orders/${order._id}`)
      .set('Authorization', `Bearer ${outsiderToken}`);

    expect(res.statusCode).toBe(403);
    expect(res.body.success).toBe(false);
  });
});

import request from 'supertest';
import app from '../src/server.js';
import User from '../src/models/user.model.js';
import Shop from '../src/models/shop.model.js';
import Category from '../src/models/category.model.js';
import Product from '../src/models/product.model.js';
import Order from '../src/models/order.model.js';
import Delivery from '../src/models/delivery.model.js';

let buyer;
let shopOwner;
let staff;
let deliveryUser;
let buyerToken;
let ownerToken;
let staffToken;
let deliveryToken;
let shop;
let product;
let order;

const createToken = async (userId, role = 'user') => {
  const jwt = await import('jsonwebtoken');
  const { env } = await import('../src/configs/env.config.js');
  return jwt.default.sign({ userId: userId.toString(), role }, env.jwt.secret, { expiresIn: env.jwt.expiresIn });
};

describe('Delivery API', () => {
  beforeEach(async () => {
    await Promise.all([
      Delivery.deleteMany({}),
      Order.deleteMany({}),
      Product.deleteMany({}),
      Shop.deleteMany({}),
      Category.deleteMany({}),
      User.deleteMany({}),
    ]);

    buyer = await User.create({
      name: 'Buyer',
      email: 'buyer-delivery@example.com',
      password: 'password123',
      role: 'user',
      roles: ['user'],
    });

    shopOwner = await User.create({
      name: 'Shop Owner',
      email: 'owner-delivery@example.com',
      password: 'password123',
      role: 'shop_owner',
      roles: ['shop_owner'],
    });

    staff = await User.create({
      name: 'Shop Staff',
      email: 'staff-delivery@example.com',
      password: 'password123',
      role: 'staff',
      roles: ['staff'],
    });

    deliveryUser = await User.create({
      name: 'Delivery User',
      email: 'delivery-user@example.com',
      password: 'password123',
      role: 'delivery',
      roles: ['delivery'],
    });

    buyerToken = await createToken(buyer._id, 'user');
    ownerToken = await createToken(shopOwner._id, 'shop_owner');
    staffToken = await createToken(staff._id, 'staff');
    deliveryToken = await createToken(deliveryUser._id, 'delivery');

    const category = await Category.create({ name: 'Trang tri', slug: 'trang-tri' });

    shop = await Shop.create({
      name: 'Decor Shop Delivery',
      slug: 'decor-shop-delivery',
      owner: shopOwner._id,
      staff: [staff._id],
    });

    product = await Product.create({
      title: 'Den Ngu',
      description: 'Den ngu de ban dep va sang trong cho phong khach',
      price: 300000,
      listingType: 'sell',
      condition: 'new',
      category: category._id,
      owner: shopOwner._id,
      shop: shop._id,
      status: 'pending',
    });

    order = await Order.create({
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
  });

  it('should assign order to delivery staff', async () => {
    const res = await request(app)
      .post('/api/v1/deliveries/assign')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        orderId: order._id.toString(),
        deliveryUserId: deliveryUser._id.toString(),
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.delivery.status).toBe('assigned');
  });

  it('should allow delivery user accept and pickup order', async () => {
    const assignRes = await request(app)
      .post('/api/v1/deliveries/assign')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        orderId: order._id.toString(),
        deliveryUserId: deliveryUser._id.toString(),
      });

    const deliveryId = assignRes.body.data.delivery._id;

    const acceptRes = await request(app)
      .patch(`/api/v1/deliveries/${deliveryId}/accept`)
      .set('Authorization', `Bearer ${deliveryToken}`);

    expect(acceptRes.statusCode).toBe(200);
    expect(acceptRes.body.success).toBe(true);

    const pickupRes = await request(app)
      .patch(`/api/v1/deliveries/${deliveryId}/pickup`)
      .set('Authorization', `Bearer ${deliveryToken}`)
      .send({ note: 'Da lay hang' });

    expect(pickupRes.statusCode).toBe(200);
    expect(pickupRes.body.success).toBe(true);
    expect(pickupRes.body.data.delivery.status).toBe('picked_up');

    const freshOrder = await Order.findById(order._id);
    expect(freshOrder.status).toBe('shipped');
  });

  it('should update delivery to in_transit then complete', async () => {
    const assignRes = await request(app)
      .post('/api/v1/deliveries/assign')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        orderId: order._id.toString(),
        deliveryUserId: deliveryUser._id.toString(),
      });

    const deliveryId = assignRes.body.data.delivery._id;

    await request(app)
      .patch(`/api/v1/deliveries/${deliveryId}/pickup`)
      .set('Authorization', `Bearer ${deliveryToken}`)
      .send({ note: 'Lay hang' });

    const inTransitRes = await request(app)
      .patch(`/api/v1/deliveries/${deliveryId}/status`)
      .set('Authorization', `Bearer ${deliveryToken}`)
      .send({ status: 'in_transit', note: 'Dang giao' });

    expect(inTransitRes.statusCode).toBe(200);
    expect(inTransitRes.body.success).toBe(true);
    expect(inTransitRes.body.data.delivery.status).toBe('in_transit');

    const completeRes = await request(app)
      .patch(`/api/v1/deliveries/${deliveryId}/complete`)
      .set('Authorization', `Bearer ${deliveryToken}`)
      .send({ note: 'Da giao xong' });

    expect(completeRes.statusCode).toBe(200);
    expect(completeRes.body.success).toBe(true);
    expect(completeRes.body.data.delivery.status).toBe('delivered');

    const freshOrder = await Order.findById(order._id);
    expect(freshOrder.status).toBe('delivered');

    const freshProduct = await Product.findById(product._id);
    expect(freshProduct.status).toBe('sold');
  });
});

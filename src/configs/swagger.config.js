import swaggerJsdoc from 'swagger-jsdoc';
import { env } from './env.config.js';

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'ProductExchange API',
    version: '1.0.0',
    description: 'API cho nền tảng mua bán và trao đổi sản phẩm',
    contact: { name: 'Dev Team', email: 'dev@productexchange.vn' },
  },
  servers: [
    { url: `http://localhost:${env.port}${env.apiPrefix}`, description: 'Development' },
    { url: `https://api.productexchange.vn${env.apiPrefix}`, description: 'Production' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      // ===== User =====
      User: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '64f1a2b3c4d5e6f7a8b9c0d1' },
          name: { type: 'string', example: 'Nguyễn Văn A' },
          email: { type: 'string', example: 'a@example.com' },
          avatar: {
            type: 'object',
            properties: { url: { type: 'string' }, publicId: { type: 'string' } },
          },
          phone: { type: 'string', example: '0901234567' },
          role: { type: 'string', enum: ['user', 'admin'] },
          rating: {
            type: 'object',
            properties: { average: { type: 'number' }, count: { type: 'integer' } },
          },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      // ===== Product =====
      Product: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          title: { type: 'string', example: 'iPhone 14 Pro Max 256GB' },
          description: { type: 'string' },
          price: { type: 'number', example: 25000000 },
          listingType: { type: 'string', enum: ['sell', 'exchange', 'both'] },
          condition: { type: 'string', enum: ['new', 'like_new', 'good', 'fair', 'poor'] },
          status: { type: 'string', enum: ['available', 'pending', 'sold', 'exchanged', 'hidden'] },
          images: {
            type: 'array',
            items: {
              type: 'object',
              properties: { url: { type: 'string' }, publicId: { type: 'string' } },
            },
          },
          category: { $ref: '#/components/schemas/Category' },
          owner: { $ref: '#/components/schemas/User' },
          views: { type: 'integer' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      // ===== Category =====
      Category: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          name: { type: 'string', example: 'Điện thoại' },
          slug: { type: 'string', example: 'dien-thoai' },
        },
      },
      // ===== Exchange =====
      Exchange: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          requester: { $ref: '#/components/schemas/User' },
          receiver: { $ref: '#/components/schemas/User' },
          requestedProduct: { $ref: '#/components/schemas/Product' },
          offeredProduct: { $ref: '#/components/schemas/Product' },
          message: { type: 'string' },
          status: { type: 'string', enum: ['pending', 'accepted', 'rejected', 'cancelled', 'completed'] },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      // ===== Responses chuẩn =====
      SuccessResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Thao tác thành công' },
          data: { type: 'object' },
          meta: {
            type: 'object',
            properties: {
              pagination: {
                type: 'object',
                properties: {
                  total: { type: 'integer' },
                  page: { type: 'integer' },
                  limit: { type: 'integer' },
                  totalPages: { type: 'integer' },
                  hasNextPage: { type: 'boolean' },
                  hasPrevPage: { type: 'boolean' },
                },
              },
            },
          },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'Đã xảy ra lỗi' },
          error: { type: 'string', example: 'Error message in English' },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
};

const options = {
  swaggerDefinition,
  apis: ['./src/routes/*.js', './src/controllers/*.js'], // JSDoc annotations
};

export const swaggerSpec = swaggerJsdoc(options);

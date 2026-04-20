import { env } from './env.config.js';

export const corsOptions = {
  origin: (origin, callback) => {
    // Cho phép requests không có origin (Postman, mobile apps)
    if (!origin || env.cors.allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true, // Cho phép gửi cookies
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

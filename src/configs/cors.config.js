import { env } from './env.config.js'

// Chuẩn hoá origin: bỏ khoảng trắng và dấu "/" thừa ở cuối để khớp chính xác
// (vd cấu hình "https://app.vercel.app/" vẫn khớp Origin trình duyệt gửi lên).
const normalizeOrigin = (value) => (value || '').trim().replace(/\/+$/, '')

export const corsOptions = {
  origin: (origin, callback) => {
    // Cho phép requests không có origin (Postman, mobile apps)
    const allowedOrigins = env.cors.allowedOrigins.map(normalizeOrigin).filter(Boolean)
    if (!origin || allowedOrigins.includes(normalizeOrigin(origin))) {
      callback(null, true)
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`))
    }
  },
  credentials: true, // Cho phép gửi cookies
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}

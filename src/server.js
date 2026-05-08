import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import swaggerUi from 'swagger-ui-express'
import { corsOptions } from './configs/cors.config.js'
import { env } from './configs/env.config.js'
import { swaggerSpec } from './configs/swagger.config.js'
import { connectDB } from './configs/database.config.js'
import { errorHandler } from './middlewares/error.middleware.js'
import { apiRateLimit } from './middlewares/rate-limit.middleware.js'
import router from './routes/index.js'
import { ensureRbacSeedData } from './services/rbac/rbac-seed.service.js'

const app = express()

// Middlewares
// Tắt CSP để Swagger UI load được CSS/JS
app.use(helmet({ contentSecurityPolicy: false }))
app.use(cors(corsOptions))
app.use(morgan('dev'))
app.use(express.json({ limit: '10kb' }))
app.use(express.urlencoded({ extended: true, limit: '10kb' }))

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'ProductExchange API Docs',
  swaggerOptions: {
    persistAuthorization: true
  }
}))

// Global rate limit — applied to all API routes
app.use(env.apiPrefix, apiRateLimit)

// Routes
app.use(env.apiPrefix, router)

// Error handler
app.use(errorHandler)

// Start server
const PORT = env.port || 3000;

connectDB().then(async () => {
  try {
    await ensureRbacSeedData();
  } catch (error) {
    console.error('RBAC seed failed:', error.message);
  }

  if (env.nodeEnv !== 'test' && !process.env.JEST_WORKER_ID) {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`🔗 API Base URL: http://localhost:${PORT}${env.apiPrefix}`);
      console.log(`📚 Swagger UI:   http://localhost:${PORT}/api-docs`);
    });
  }
});

export default app


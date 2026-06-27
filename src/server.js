import express from 'express'
import { createServer } from 'http'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
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
import { initChatSocket } from './sockets/chat.socket.js'
import { getSocketServer } from './sockets/socket-hub.js'
import { startSchedulers, stopSchedulers } from './jobs/scheduler.js'

const app = express()
let httpServer = null
const isTestRuntime = env.nodeEnv === 'test' || Boolean(process.env.JEST_WORKER_ID)

if (!isTestRuntime) {
  httpServer = createServer(app)
  initChatSocket(httpServer)
}

// Middlewares
// Tắt CSP để Swagger UI load được CSS/JS
app.use(helmet({ contentSecurityPolicy: false }))
app.use(compression())
app.use(cors(corsOptions))
app.use(morgan('dev'))
app.use(express.json({ limit: '5mb' }))
app.use(express.urlencoded({ extended: true, limit: '5mb' }))

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'ProductExchange API Docs',
  swaggerOptions: {
    persistAuthorization: true
  }
}))

// Global rate limit — applied to all API routes
app.use(env.apiPrefix, apiRateLimit)

app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'ok',
    message: 'Server is running',
    timestamp: new Date().toISOString()
  })
})

// Routes
app.use(env.apiPrefix, router)

// Error handler
app.use(errorHandler)

// Start server
const PORT = env.port || 3000

if (!isTestRuntime) {
  connectDB().then(async () => {
    try {
      await ensureRbacSeedData()
    } catch (error) {
      console.error('RBAC seed failed:', error.message)
    }

    startSchedulers()

    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`)
      console.log(`🔗 API Base URL: http://localhost:${PORT}${env.apiPrefix}`)
      console.log(`📚 Swagger UI:   http://localhost:${PORT}/api-docs`)
    })
  })
}

export const closeAppResources = async () => {
  stopSchedulers()

  const socketServer = getSocketServer()

  if (socketServer) {
    await new Promise((resolve) => socketServer.close(resolve))
  }

  if (httpServer) {
    await new Promise((resolve) => httpServer.close(resolve))
    httpServer = null
  }
}

export default app


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
import router from './routes/index.js'

const app = express()

// Middlewares
// Tắt CSP để Swagger UI load được CSS/JS
app.use(helmet({ contentSecurityPolicy: false }))
app.use(cors(corsOptions))
app.use(morgan('dev'))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'ProductExchange API Docs',
  swaggerOptions: {
    persistAuthorization: true
  }
}))

// Routes
app.use('/api/v1', router)

// Error handler
app.use(errorHandler)

// Start server
const PORT = env.PORT || 3000

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`)
    console.log(`📚 Swagger UI:   http://localhost:${PORT}/api-docs`)
  })
})

export default app


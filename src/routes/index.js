import { Router } from 'express'
import authRoutes from './auth/auth.route.js'
import userRoutes from './user/user.route.js'
import productRoutes from './product/product.route.js'
import categoryRoutes from './category/category.route.js'
import shopRoutes from './shop/shop.route.js'
import orderRoutes from './order/order.route.js'
import paymentRoutes from './payment/payment.route.js'
import adminRoutes from './admin/admin.route.js'
import adminRbacRoutes from './admin/rbac.route.js'

const router = Router()

router.use('/auth', authRoutes)
router.use('/users', userRoutes)
router.use('/products', productRoutes)
router.use('/categories', categoryRoutes)
router.use('/shops', shopRoutes)
router.use('/orders', orderRoutes)
router.use('/payments', paymentRoutes)
router.use('/admin', adminRoutes)
router.use('/admin/rbac', adminRbacRoutes)

export default router

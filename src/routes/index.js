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
import walletRoutes from './wallet/wallet.route.js'
import conversationRoutes from './conversation/conversation.route.js'
import userWalletRoutes from './user-wallet/user-wallet.route.js'
import sellerRoutes from './seller/seller.route.js'
import notificationRoutes from './notification/notification.route.js'
import comboRoutes from './combo/combo.route.js'
import cartRoutes from './cart/cart.route.js'
import roomProjectRoutes from './room-visualizer/room-project.route.js'
import subscriptionRoutes from './subscription/subscription.route.js'
import kycOptionsRoutes from './options/kyc.route.js'
import withdrawalOptionsRoutes from './options/withdrawal.route.js'
import analyticsRoutes from './analytics/analytics.route.js'

const router = Router()

router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'ok',
    message: 'API is running',
    timestamp: new Date().toISOString()
  })
})

router.use('/auth', authRoutes)
router.use('/users', userRoutes)
router.use('/products', productRoutes)
router.use('/categories', categoryRoutes)
router.use('/shops', shopRoutes)
router.use('/orders', orderRoutes)
router.use('/payments', paymentRoutes)
router.use('/conversations', conversationRoutes)
router.use('/seller', sellerRoutes)
router.use('/admin', adminRoutes)
router.use('/admin/rbac', adminRbacRoutes)
router.use('/wallet', walletRoutes)
router.use('/user-wallet', userWalletRoutes)
router.use('/notifications', notificationRoutes)
router.use('/combos', comboRoutes)
router.use('/cart', cartRoutes)
router.use('/room-projects', roomProjectRoutes)
router.use('/subscriptions', subscriptionRoutes)
router.use('/kyc', kycOptionsRoutes)
router.use('/withdrawals', withdrawalOptionsRoutes)
router.use('/analytics', analyticsRoutes)

export default router

import { Router } from 'express';
import authRoutes from './auth.route.js';
import productRoutes from './product.route.js';
import exchangeRoutes from './exchange.route.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/products', productRoutes);
router.use('/exchanges', exchangeRoutes);

export default router;

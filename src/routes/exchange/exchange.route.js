import { Router } from 'express'
import { authenticate, requirePermissions } from '../../middlewares/auth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { validateObjectId } from '../../middlewares/object-id.middleware.js'
import PERMISSIONS from '../../constants/permission.constant.js'
import * as exchangeController from '../../controllers/exchange/exchange.controller.js'
import {
  counterExchangeOfferSchema,
  createExchangeOfferSchema,
  exchangeActionSchema,
  exchangeDisputeSchema,
  exchangeOffersQuerySchema,
} from '../../validations/exchange/exchange.validation.js'

const router = Router()

router.get(
  '/offers',
  authenticate,
  requirePermissions(PERMISSIONS.SELLER_EXCHANGE_READ),
  validate(exchangeOffersQuerySchema, 'query'),
  exchangeController.listMyExchangeOffers
)

router.post(
  '/offers',
  authenticate,
  requirePermissions(PERMISSIONS.SELLER_EXCHANGE_CREATE),
  validate(createExchangeOfferSchema),
  exchangeController.createExchangeOffer
)

router.get(
  '/offers/:exchangeOfferId',
  authenticate,
  requirePermissions(PERMISSIONS.SELLER_EXCHANGE_READ),
  validateObjectId('exchangeOfferId'),
  exchangeController.getMyExchangeOfferById
)

router.patch(
  '/offers/:exchangeOfferId/counter',
  authenticate,
  requirePermissions(PERMISSIONS.SELLER_EXCHANGE_UPDATE),
  validateObjectId('exchangeOfferId'),
  validate(counterExchangeOfferSchema),
  exchangeController.counterExchangeOffer
)

router.post(
  '/offers/:exchangeOfferId/accept',
  authenticate,
  requirePermissions(PERMISSIONS.SELLER_EXCHANGE_UPDATE),
  validateObjectId('exchangeOfferId'),
  exchangeController.acceptExchangeOffer
)

router.post(
  '/offers/:exchangeOfferId/pay',
  authenticate,
  requirePermissions(PERMISSIONS.SELLER_EXCHANGE_UPDATE),
  validateObjectId('exchangeOfferId'),
  exchangeController.payExchangeDifference
)

router.post(
  '/offers/:exchangeOfferId/ship',
  authenticate,
  requirePermissions(PERMISSIONS.SELLER_EXCHANGE_UPDATE),
  validateObjectId('exchangeOfferId'),
  exchangeController.markExchangeShipped
)

router.post(
  '/offers/:exchangeOfferId/confirm-received',
  authenticate,
  requirePermissions(PERMISSIONS.SELLER_EXCHANGE_UPDATE),
  validateObjectId('exchangeOfferId'),
  exchangeController.confirmExchangeReceived
)

router.post(
  '/offers/:exchangeOfferId/cancel',
  authenticate,
  requirePermissions(PERMISSIONS.SELLER_EXCHANGE_UPDATE),
  validateObjectId('exchangeOfferId'),
  validate(exchangeActionSchema),
  exchangeController.cancelExchangeOffer
)

router.post(
  '/offers/:exchangeOfferId/dispute',
  authenticate,
  requirePermissions(PERMISSIONS.SELLER_EXCHANGE_UPDATE),
  validateObjectId('exchangeOfferId'),
  validate(exchangeDisputeSchema),
  exchangeController.openExchangeDispute
)

export default router

import { Router } from 'express'
import { authenticate } from '../../middlewares/auth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { validateObjectId } from '../../middlewares/object-id.middleware.js'
import * as rentalController from '../../controllers/rental/rental.controller.js'
import {
  cancelRentalBookingSchema,
  createRentalBookingSchema,
  createRentalClaimSchema,
  createRentalListingSchema,
  rentalBookingsQuerySchema,
  rentalInspectionActionSchema,
  rentalListingsQuerySchema,
  updateRentalBookingSchema,
  updateRentalListingSchema,
} from '../../validations/rental/rental.validation.js'

const router = Router()

router.get('/listings', validate(rentalListingsQuerySchema, 'query'), rentalController.listRentalListings)

router.post(
  '/listings',
  authenticate,
  validate(createRentalListingSchema),
  rentalController.createRentalListing
)

router.get('/listings/:rentalListingId', validateObjectId('rentalListingId'), rentalController.getRentalListingById)

router.patch(
  '/listings/:rentalListingId',
  authenticate,
  validateObjectId('rentalListingId'),
  validate(updateRentalListingSchema),
  rentalController.updateRentalListing
)

router.get(
  '/bookings',
  authenticate,
  validate(rentalBookingsQuerySchema, 'query'),
  rentalController.listRentalBookings
)

router.post('/bookings', authenticate, validate(createRentalBookingSchema), rentalController.createRentalBooking)

router.get('/bookings/:rentalBookingId', authenticate, validateObjectId('rentalBookingId'), rentalController.getRentalBookingById)

router.patch(
  '/bookings/:rentalBookingId',
  authenticate,
  validateObjectId('rentalBookingId'),
  validate(updateRentalBookingSchema),
  rentalController.updateRentalBooking
)

router.post(
  '/bookings/:rentalBookingId/cancel',
  authenticate,
  validateObjectId('rentalBookingId'),
  validate(cancelRentalBookingSchema),
  rentalController.cancelRentalBooking
)

router.post('/bookings/:rentalBookingId/pay', authenticate, validateObjectId('rentalBookingId'), rentalController.payRentalBooking)

router.post(
  '/bookings/:rentalBookingId/handover',
  authenticate,
  validateObjectId('rentalBookingId'),
  validate(rentalInspectionActionSchema),
  rentalController.handoverRentalBooking
)

router.post(
  '/bookings/:rentalBookingId/return',
  authenticate,
  validateObjectId('rentalBookingId'),
  validate(rentalInspectionActionSchema),
  rentalController.returnRentalBooking
)

router.post(
  '/bookings/:rentalBookingId/confirm-return',
  authenticate,
  validateObjectId('rentalBookingId'),
  validate(rentalInspectionActionSchema),
  rentalController.confirmRentalReturn
)

router.post(
  '/bookings/:rentalBookingId/claims',
  authenticate,
  validateObjectId('rentalBookingId'),
  validate(createRentalClaimSchema),
  rentalController.createRentalClaim
)

export default router

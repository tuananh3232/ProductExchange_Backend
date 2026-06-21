import Joi from 'joi'
import { RENTAL_BOOKING_STATUS_ENUM, RENTAL_CLAIM_STATUS_ENUM } from '../../constants/status.constant.js'

const objectId = Joi.string().trim().pattern(/^[a-f\d]{24}$/i)
const page = Joi.number().integer().min(1).default(1)
const limit = Joi.number().integer().min(1).max(100).default(10)

export const rentalListingsQuerySchema = Joi.object({
  page,
  limit,
  sortBy: Joi.string().valid('createdAt', 'updatedAt', 'dailyRate').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  productId: objectId.optional(),
  ownerType: Joi.string().valid('SELLER', 'SHOP').optional(),
  sellerId: objectId.optional(),
  shopId: objectId.optional(),
  isActive: Joi.boolean().optional(),
})

export const createRentalListingSchema = Joi.object({
  productId: objectId.required(),
  ownerType: Joi.string().valid('SELLER', 'SHOP').required(),
  shopId: objectId.allow(null).optional(),
  title: Joi.string().trim().max(200).allow('').optional(),
  description: Joi.string().trim().max(2000).allow('').optional(),
  dailyRate: Joi.number().min(0).required(),
  depositAmount: Joi.number().min(0).default(0),
  lateFeePerDay: Joi.number().min(0).optional(),
  minRentalDays: Joi.number().integer().min(1).max(30).default(1),
  maxRentalDays: Joi.number().integer().min(1).max(30).default(30),
})

export const createRentalBookingSchema = Joi.object({
  listingId: objectId.required(),
  startDate: Joi.date().required(),
  endDate: Joi.date().required(),
  note: Joi.string().trim().max(1000).allow('').optional(),
})

export const updateRentalBookingSchema = Joi.object({
  startDate: Joi.date().required(),
  endDate: Joi.date().required(),
  note: Joi.string().trim().max(1000).allow('').optional(),
})

export const cancelRentalBookingSchema = Joi.object({
  note: Joi.string().trim().max(1000).allow('').optional(),
})

export const rentalBookingsQuerySchema = Joi.object({
  page,
  limit,
  sortBy: Joi.string().valid('createdAt', 'updatedAt', 'startDate', 'endDate').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  scope: Joi.string().valid('owner', 'mine').default('owner'),
  ownerType: Joi.string().valid('SELLER', 'SHOP').optional(),
  shopId: objectId.optional(),
  status: Joi.string().valid(...RENTAL_BOOKING_STATUS_ENUM).optional(),
})

export const rentalInspectionActionSchema = Joi.object({
  note: Joi.string().trim().max(2000).allow('').optional(),
  images: Joi.array().items(Joi.string().trim().uri()).max(10).default([]),
  returnedAt: Joi.date().optional(),
})

export const createRentalClaimSchema = Joi.object({
  reason: Joi.string().trim().min(1).max(2000).required(),
  requestedAmount: Joi.number().min(0).required(),
})

export const adminRentalBookingsQuerySchema = Joi.object({
  page,
  limit,
  sortBy: Joi.string().valid('createdAt', 'updatedAt', 'startDate', 'endDate').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  ownerType: Joi.string().valid('SELLER', 'SHOP').optional(),
  status: Joi.string().valid(...RENTAL_BOOKING_STATUS_ENUM).optional(),
})

export const adminRentalClaimsQuerySchema = Joi.object({
  page,
  limit,
  sortBy: Joi.string().valid('createdAt', 'updatedAt').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  status: Joi.string().valid(...RENTAL_CLAIM_STATUS_ENUM).optional(),
})

export const adminResolveRentalClaimSchema = Joi.object({
  approvedAmount: Joi.number().min(0).required(),
  note: Joi.string().trim().max(1000).allow('').optional(),
})

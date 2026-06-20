import mongoose from 'mongoose'
import { RENTAL_BOOKING_STATUS_ENUM } from '../constants/status.constant.js'

const rentalBookingTimelineSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: RENTAL_BOOKING_STATUS_ENUM,
      required: true,
    },
    note: {
      type: String,
      default: '',
      maxlength: 1000,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
)

const rentalBookingSchema = new mongoose.Schema(
  {
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RentalListing',
      required: true,
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    ownerType: {
      type: String,
      enum: ['SELLER', 'SHOP'],
      required: true,
      index: true,
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shop',
      default: null,
      index: true,
    },
    renter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    startDate: {
      type: Date,
      required: true,
      index: true,
    },
    endDate: {
      type: Date,
      required: true,
      index: true,
    },
    plannedDays: {
      type: Number,
      required: true,
      min: 1,
      max: 30,
    },
    actualDays: {
      type: Number,
      default: null,
      min: 1,
    },
    dailyRate: {
      type: Number,
      required: true,
      min: 0,
    },
    depositAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lateFeePerDay: {
      type: Number,
      default: 0,
      min: 0,
    },
    rentAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    actualRentAmount: {
      type: Number,
      default: null,
      min: 0,
    },
    lateFeeAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    unusedRentRefundAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    platformFeeAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    ownerSettlementAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    depositHeldAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    depositReleasedAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    claimDeductionAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    feePolicyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FeePolicy',
      default: null,
    },
    feeSnapshotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FeeSnapshot',
      default: null,
    },
    status: {
      type: String,
      enum: RENTAL_BOOKING_STATUS_ENUM,
      required: true,
      default: 'payment_pending',
      index: true,
    },
    note: {
      type: String,
      default: '',
      maxlength: 1000,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    handedOverAt: {
      type: Date,
      default: null,
    },
    returnedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    disputedAt: {
      type: Date,
      default: null,
    },
    timeline: {
      type: [rentalBookingTimelineSchema],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
)

rentalBookingSchema.index({ listing: 1, startDate: 1, endDate: 1, status: 1 })
rentalBookingSchema.index({ renter: 1, createdAt: -1 })
rentalBookingSchema.index({ seller: 1, createdAt: -1 })
rentalBookingSchema.index({ shop: 1, createdAt: -1 })

export default mongoose.model('RentalBooking', rentalBookingSchema)

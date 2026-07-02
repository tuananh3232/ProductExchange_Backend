import mongoose from 'mongoose'
import { RENTAL_CLAIM_STATUS_ENUM } from '../constants/status.constant.js'

const rentalClaimSchema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RentalBooking',
      required: true,
      index: true,
    },
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RentalListing',
      required: true,
      index: true,
    },
    claimant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    renter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
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
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    requestedAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    approvedAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: RENTAL_CLAIM_STATUS_ENUM,
      required: true,
      default: 'open',
      index: true,
    },
    resolutionNote: {
      type: String,
      default: '',
      maxlength: 1000,
    },
    reviewedByAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    closedAt: {
      type: Date,
      default: null,
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

export default mongoose.model('RentalClaim', rentalClaimSchema)

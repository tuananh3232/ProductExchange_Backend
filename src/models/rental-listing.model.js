import mongoose from 'mongoose'

const rentalListingSchema = new mongoose.Schema(
  {
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
    title: {
      type: String,
      default: '',
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      default: '',
      maxlength: 2000,
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
    minRentalDays: {
      type: Number,
      default: 1,
      min: 1,
      max: 30,
    },
    maxRentalDays: {
      type: Number,
      default: 30,
      min: 1,
      max: 30,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    activatedAt: {
      type: Date,
      default: Date.now,
    },
    deactivatedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
)

rentalListingSchema.index({ ownerType: 1, seller: 1, createdAt: -1 })
rentalListingSchema.index({ ownerType: 1, shop: 1, createdAt: -1 })
rentalListingSchema.index({ product: 1, isActive: 1 })

export default mongoose.model('RentalListing', rentalListingSchema)

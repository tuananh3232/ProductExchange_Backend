import mongoose from 'mongoose'
import { EXCHANGE_STATUS_ENUM } from '../constants/status.constant.js'

const exchangeTimelineSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: EXCHANGE_STATUS_ENUM,
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

const exchangeOfferSchema = new mongoose.Schema(
  {
    requesterSeller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    receiverSeller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    requesterProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    receiverProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    requesterProductValue: {
      type: Number,
      required: true,
      min: 0,
    },
    receiverProductValue: {
      type: Number,
      required: true,
      min: 0,
    },
    cashDifferenceAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    cashDifferenceDirection: {
      type: String,
      enum: ['none', 'requester_to_receiver', 'receiver_to_requester'],
      default: 'none',
    },
    cashDifferencePayer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    cashDifferenceReceiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
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
    platformFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: EXCHANGE_STATUS_ENUM,
      required: true,
      default: 'pending_acceptance',
      index: true,
    },
    note: {
      type: String,
      default: '',
      maxlength: 1000,
    },
    acceptedAt: {
      type: Date,
      default: null,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    requesterShippedAt: {
      type: Date,
      default: null,
    },
    receiverShippedAt: {
      type: Date,
      default: null,
    },
    requesterReceivedAt: {
      type: Date,
      default: null,
    },
    receiverReceivedAt: {
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
    disputeOpenedAt: {
      type: Date,
      default: null,
    },
    disputeReason: {
      type: String,
      default: '',
      maxlength: 1000,
    },
    disputeOpenedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    resolvedByAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    resolution: {
      type: String,
      enum: ['none', 'complete', 'cancel_refund'],
      default: 'none',
    },
    resolutionNote: {
      type: String,
      default: '',
      maxlength: 1000,
    },
    timeline: {
      type: [exchangeTimelineSchema],
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

exchangeOfferSchema.index({ requesterSeller: 1, createdAt: -1 })
exchangeOfferSchema.index({ receiverSeller: 1, createdAt: -1 })
exchangeOfferSchema.index({ requesterProduct: 1, status: 1 })
exchangeOfferSchema.index({ receiverProduct: 1, status: 1 })

const ExchangeOffer = mongoose.model('ExchangeOffer', exchangeOfferSchema)

export default ExchangeOffer

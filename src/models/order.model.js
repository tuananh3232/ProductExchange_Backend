import mongoose from 'mongoose'
import { ORDER_STATUS, ORDER_STATUS_ENUM, PAYMENT_STATUS, PAYMENT_STATUS_ENUM, SETTLEMENT_STATUS, SETTLEMENT_STATUS_ENUM } from '../constants/status.constant.js'
import { COMMERCE_ORDER_STATUS, COMMERCE_ORDER_STATUS_ENUM } from '../constants/commerce.constant.js'

const orderHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ORDER_STATUS_ENUM,
      required: true,
    },
    note: {
      type: String,
      default: '',
      maxlength: [500, 'Order history note must not exceed 500 characters'],
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

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: mongoose.Schema.Types.ObjectId, required: true },
    sku: { type: String, required: true },
    title: { type: String, required: true },
    image: { type: String, default: '' },
    attributes: { type: Map, of: String, default: {} },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    subtotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
)

const orderSchema = new mongoose.Schema(
  {
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    checkout: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Checkout',
      default: null,
      index: true,
    },
    items: {
      type: [orderItemSchema],
      default: [],
    },
    commerceStatus: {
      type: String,
      enum: COMMERCE_ORDER_STATUS_ENUM,
      default: COMMERCE_ORDER_STATUS.PAYMENT_PENDING,
      index: true,
    },
    amountBreakdown: {
      subtotal: { type: Number, default: 0, min: 0 },
      discount: { type: Number, default: 0, min: 0 },
      shippingFee: { type: Number, default: 0, min: 0 },
      tax: { type: Number, default: 0, min: 0 },
      total: { type: Number, default: 0, min: 0 },
    },
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shop',
      default: null,
      index: true,
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    quantity: {
      type: Number,
      default: 1,
      min: 1,
      max: 100,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    grossAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalPlatformFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    netSettlementAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    settlementStatus: {
      type: String,
      enum: SETTLEMENT_STATUS_ENUM,
      default: SETTLEMENT_STATUS.PENDING,
      index: true,
    },
    feeSnapshotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FeeSnapshot',
      default: null,
    },
    feePolicyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FeePolicy',
      default: null,
    },
    status: {
      type: String,
      enum: ORDER_STATUS_ENUM,
      default: ORDER_STATUS.PENDING,
      index: true,
    },
    shippingAddress: {
      recipientName: { type: String, default: '' },
      phone: { type: String, default: '' },
      province: { type: String, default: '' },
      district: { type: String, default: '' },
      detail: { type: String, default: '' },
    },
    note: {
      type: String,
      default: '',
      maxlength: [1000, 'Order note must not exceed 1000 characters'],
    },
    paymentStatus: {
      type: String,
      enum: PAYMENT_STATUS_ENUM,
      default: PAYMENT_STATUS.UNPAID,
      index: true,
    },
    paymentMethod: {
      type: String,
      default: '',
    },
    paymentProvider: {
      type: String,
      default: '',
    },
    paymentRef: {
      type: String,
      default: '',
      index: true,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    completedAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    settlementReleasedAt: { type: Date, default: null },
    history: {
      type: [orderHistorySchema],
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

orderSchema.index({ buyer: 1, createdAt: -1 })
orderSchema.index({ shop: 1, createdAt: -1 })
orderSchema.index({ seller: 1, createdAt: -1 })
orderSchema.index({ status: 1, createdAt: -1 })

const Order = mongoose.model('Order', orderSchema)

export default Order

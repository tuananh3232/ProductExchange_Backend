import mongoose from 'mongoose'
import { CHECKOUT_STATUS, CHECKOUT_STATUS_ENUM } from '../constants/commerce.constant.js'

const checkoutItemSchema = new mongoose.Schema(
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
    shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', default: null },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { _id: false }
)

const checkoutSchema = new mongoose.Schema(
  {
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    idempotencyKey: { type: String, required: true },
    items: { type: [checkoutItemSchema], required: true },
    orders: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }],
    reservations: [{ type: mongoose.Schema.Types.ObjectId, ref: 'InventoryReservation' }],
    shippingAddress: {
      recipientName: { type: String, required: true },
      phone: { type: String, required: true },
      province: { type: String, required: true },
      district: { type: String, required: true },
      detail: { type: String, required: true },
    },
    amount: {
      subtotal: { type: Number, required: true, min: 0 },
      discount: { type: Number, default: 0, min: 0 },
      shippingFee: { type: Number, default: 0, min: 0 },
      tax: { type: Number, default: 0, min: 0 },
      total: { type: Number, required: true, min: 0 },
    },
    status: { type: String, enum: CHECKOUT_STATUS_ENUM, default: CHECKOUT_STATUS.CREATED, index: true },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true, versionKey: false }
)

checkoutSchema.index({ buyer: 1, idempotencyKey: 1 }, { unique: true })

export default mongoose.model('Checkout', checkoutSchema)

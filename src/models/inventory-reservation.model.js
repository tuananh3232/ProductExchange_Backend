import mongoose from 'mongoose'
import { RESERVATION_STATUS, RESERVATION_STATUS_ENUM } from '../constants/commerce.constant.js'

const inventoryReservationSchema = new mongoose.Schema(
  {
    checkout: { type: mongoose.Schema.Types.ObjectId, ref: 'Checkout', required: true, index: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null, index: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    variantId: { type: mongoose.Schema.Types.ObjectId, required: true },
    sku: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    status: { type: String, enum: RESERVATION_STATUS_ENUM, default: RESERVATION_STATUS.ACTIVE, index: true },
    expiresAt: { type: Date, required: true, index: true },
    consumedAt: { type: Date, default: null },
    releasedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false }
)

inventoryReservationSchema.index(
  { checkout: 1, product: 1, variantId: 1 },
  { unique: true }
)

export default mongoose.model('InventoryReservation', inventoryReservationSchema)

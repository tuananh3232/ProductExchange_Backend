import mongoose from 'mongoose'
import Product from '../../models/product.model.js'
import InventoryReservation from '../../models/inventory-reservation.model.js'
import AppError from '../../utils/app-error.util.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'
import { RESERVATION_STATUS } from '../../constants/commerce.constant.js'

const objectId = (value) => new mongoose.Types.ObjectId(value)

export const reserveVariant = async ({ checkoutId, productId, variantId, sku, quantity, expiresAt }, session) => {
  const variantObjectId = objectId(variantId)
  const product = await Product.findOneAndUpdate(
    {
      _id: productId,
      isActive: true,
      status: 'available',
      $expr: {
        $anyElementTrue: {
          $map: {
            input: '$variants',
            as: 'variant',
            in: {
              $and: [
                { $eq: ['$$variant._id', variantObjectId] },
                { $eq: ['$$variant.isActive', true] },
                { $gte: [{ $subtract: ['$$variant.stockOnHand', '$$variant.reservedStock'] }, quantity] },
              ],
            },
          },
        },
      },
    },
    { $inc: { 'variants.$[variant].reservedStock': quantity } },
    { returnDocument: 'after', session, arrayFilters: [{ 'variant._id': variantObjectId }] }
  )

  if (!product) {
    throw new AppError('Sản phẩm không còn đủ tồn kho', HTTP_STATUS.CONFLICT, 'INSUFFICIENT_STOCK')
  }

  const [reservation] = await InventoryReservation.create([{
    checkout: checkoutId,
    product: productId,
    variantId,
    sku,
    quantity,
    expiresAt,
  }], { session })
  return reservation
}

const transitionReservation = async (reservationId, targetStatus, session) => {
  const reservation = await InventoryReservation.findOneAndUpdate(
    { _id: reservationId, status: RESERVATION_STATUS.ACTIVE },
    {
      status: targetStatus,
      ...(targetStatus === RESERVATION_STATUS.CONSUMED ? { consumedAt: new Date() } : { releasedAt: new Date() }),
    },
    { returnDocument: 'after', session }
  )
  if (!reservation) return null

  const variantObjectId = objectId(reservation.variantId)
  const increments = targetStatus === RESERVATION_STATUS.CONSUMED
    ? { 'variants.$[variant].stockOnHand': -reservation.quantity, 'variants.$[variant].reservedStock': -reservation.quantity }
    : { 'variants.$[variant].reservedStock': -reservation.quantity }

  await Product.findByIdAndUpdate(
    reservation.product,
    { $inc: increments },
    { session, arrayFilters: [{ 'variant._id': variantObjectId }] }
  )
  return reservation
}

export const consumeReservation = (reservationId, session) => transitionReservation(reservationId, RESERVATION_STATUS.CONSUMED, session)
export const releaseReservation = (reservationId, session, expired = false) => transitionReservation(
  reservationId,
  expired ? RESERVATION_STATUS.EXPIRED : RESERVATION_STATUS.RELEASED,
  session
)

import Payment from '../../models/payment.model.js'

export const create = (data) => Payment.create(data)

export const findByOrder = (orderId) => Payment.findOne({ order: orderId })

export const findByTransactionRef = (transactionRef) => Payment.findOne({ transactionRef })

export const updateById = (id, data) => Payment.findByIdAndUpdate(id, data, { returnDocument: 'after', runValidators: true })

export const findBatchByOrders = (orderIds) =>
  Payment.findOne({ orders: { $in: orderIds }, status: { $nin: ['failed', 'cancelled'] } })

export const findById = (id) =>
  Payment.findById(id)
    .populate('order', 'status paymentStatus paymentMethod paymentProvider totalAmount buyer shop seller')
    .populate('orders', 'status paymentStatus totalAmount')
    .populate('buyer', 'name email avatar')
    .populate('reconciledBy', 'name email')

export const findMany = ({ filter = {}, skip = 0, limit = 10, sortBy = 'createdAt', sortOrder = -1 }) =>
  Payment.find(filter)
    .populate('order', 'status paymentStatus totalAmount')
    .populate('buyer', 'name email avatar')
    .sort({ [sortBy]: sortOrder })
    .skip(skip)
    .limit(limit)
    .lean()

export const countMany = (filter = {}) => Payment.countDocuments(filter)

import Payment from '../../models/payment.model.js'

export const create = (data) => Payment.create(data)

export const findByOrder = (orderId) => Payment.findOne({ order: orderId })

export const findByTransactionRef = (transactionRef) => Payment.findOne({ transactionRef })

export const updateById = (id, data) => Payment.findByIdAndUpdate(id, data, { new: true, runValidators: true })

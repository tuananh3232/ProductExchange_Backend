import Delivery from '../../models/delivery.model.js'

export const create = (data) => Delivery.create(data)

export const findById = (id) =>
  Delivery.findById(id)
    .populate('order', 'status buyer shop product')
    .populate('shop', 'name slug owner staff')
    .populate('buyer', 'name email phone')
    .populate('deliveryStaff', 'name email phone roles')

export const findByOrderId = (orderId) =>
  Delivery.findOne({ order: orderId, isActive: true })
    .populate('order', 'status buyer shop product')
    .populate('shop', 'name slug owner staff')
    .populate('buyer', 'name email phone')
    .populate('deliveryStaff', 'name email phone roles')

export const findMany = ({ filter = {}, skip = 0, limit = 10, sortBy = 'createdAt', sortOrder = -1 }) =>
  Delivery.find(filter)
    .populate('order', 'status')
    .populate('shop', 'name slug')
    .populate('deliveryStaff', 'name email')
    .sort({ [sortBy]: sortOrder })
    .skip(skip)
    .limit(limit)
    .lean()

export const countMany = (filter = {}) => Delivery.countDocuments(filter)

export const updateById = (id, data) =>
  Delivery.findByIdAndUpdate(id, data, { new: true, runValidators: true })
    .populate('order', 'status buyer shop product')
    .populate('shop', 'name slug owner staff')
    .populate('buyer', 'name email phone')
    .populate('deliveryStaff', 'name email phone roles')

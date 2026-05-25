import Order from '../../models/order.model.js'

export const create = (data) => Order.create(data)

export const findById = (id) =>
  Order.findById(id)
    .populate('buyer', 'name email avatar')
    .populate('shop', 'name slug owner staff')
    .populate('seller', 'name email avatar')
    .populate('product', 'title price status images owner ownerType shop seller')

export const findMany = ({ filter = {}, skip = 0, limit = 10, sortBy = 'createdAt', sortOrder = -1 }) =>
  Order.find(filter)
    .populate('buyer', 'name email avatar')
    .populate('shop', 'name slug')
    .populate('seller', 'name email avatar')
    .populate('product', 'title price status images')
    .sort({ [sortBy]: sortOrder })
    .skip(skip)
    .limit(limit)
    .lean()

export const countMany = (filter = {}) => Order.countDocuments(filter)

export const updateById = (id, data) =>
  Order.findByIdAndUpdate(id, data, { returnDocument: 'after', runValidators: true })
    .populate('buyer', 'name email avatar')
    .populate('shop', 'name slug owner staff')
    .populate('seller', 'name email avatar')
    .populate('product', 'title price status images owner ownerType shop seller')

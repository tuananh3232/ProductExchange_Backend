import WithdrawalRequest from '../../models/withdrawal-request.model.js'

export const create = (data) => WithdrawalRequest.create(data)

export const findById = (id) =>
  WithdrawalRequest.findById(id)
    .populate('shop', 'name slug logo')
    .populate('requestedBy', 'name email')
    .populate('approvedBy', 'name email')

export const findMany = ({ filter, skip, limit, sortBy = 'createdAt', sortOrder = 'desc' }) =>
  WithdrawalRequest.find(filter)
    .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
    .skip(skip)
    .limit(limit)
    .populate('shop', 'name slug logo')
    .populate('requestedBy', 'name email')
    .populate('approvedBy', 'name email')

export const countMany = (filter) => WithdrawalRequest.countDocuments(filter)

export const updateById = (id, data) =>
  WithdrawalRequest.findByIdAndUpdate(id, data, { returnDocument: 'after', runValidators: true })
    .populate('shop', 'name slug logo')
    .populate('requestedBy', 'name email')
    .populate('approvedBy', 'name email')

export const hasPendingRequest = (shopId) =>
  WithdrawalRequest.exists({ shop: shopId, status: 'pending' })

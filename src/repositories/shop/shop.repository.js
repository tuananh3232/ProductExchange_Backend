import Shop from '../../models/shop.model.js'

export const create = (data) => Shop.create(data)

export const findBySlug = (slug) => Shop.findOne({ slug, isActive: true })

export const findById = (id) =>
  Shop.findById(id)
    .populate('owner', 'name email avatar')
    .populate('staff', 'name email avatar')
    .populate('staffPermissions.staffUser', 'name email avatar')

export const findMany = ({ filter = {}, skip = 0, limit = 10, sortBy = 'createdAt', sortOrder = -1 }) =>
  Shop.find(filter)
    .populate('owner', 'name avatar')
    .sort({ [sortBy]: sortOrder })
    .skip(skip)
    .limit(limit)
    .lean()

export const countMany = (filter = {}) => Shop.countDocuments(filter)

export const updateById = (id, data) =>
  Shop.findByIdAndUpdate(id, data, { new: true, runValidators: true })
    .populate('owner', 'name email avatar')
    .populate('staff', 'name email avatar')
    .populate('staffPermissions.staffUser', 'name email avatar')

export const addStaff = (id, userId) =>
  Shop.findByIdAndUpdate(id, { $addToSet: { staff: userId } }, { new: true, runValidators: true })
    .populate('owner', 'name email avatar')
    .populate('staff', 'name email avatar')
    .populate('staffPermissions.staffUser', 'name email avatar')

export const removeStaff = (id, userId) =>
  Shop.findByIdAndUpdate(id, { $pull: { staff: userId } }, { new: true, runValidators: true })
    .populate('owner', 'name email avatar')
    .populate('staff', 'name email avatar')
    .populate('staffPermissions.staffUser', 'name email avatar')

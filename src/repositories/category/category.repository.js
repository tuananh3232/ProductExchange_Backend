import Category from '../../models/category.model.js'

export const create = (data) => Category.create(data)

export const findById = (id) => Category.findById(id)

export const findMany = ({ filter = {}, skip = 0, limit = 10, sortBy = 'createdAt', sortOrder = -1 } = {}) =>
  Category.find(filter).sort({ [sortBy]: sortOrder }).skip(skip).limit(limit).lean()

export const countMany = (filter = {}) => Category.countDocuments(filter)

export const findBySlug = (slug) => Category.findOne({ slug })

export const updateById = (id, data) => Category.findByIdAndUpdate(id, data, { new: true, runValidators: true })

export const deleteById = (id) => Category.findByIdAndDelete(id)

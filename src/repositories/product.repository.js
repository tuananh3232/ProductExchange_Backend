import Product from '../models/product.model.js';

export const create = (data) => Product.create(data);

export const findById = (id) =>
  Product.findById(id)
    .populate('owner', 'name avatar rating phone')
    .populate('category', 'name slug');

export const findMany = ({ filter = {}, skip = 0, limit = 10, sortBy = 'createdAt', sortOrder = -1 }) =>
  Product.find(filter)
    .populate('owner', 'name avatar rating')
    .populate('category', 'name slug')
    .sort({ [sortBy]: sortOrder })
    .skip(skip)
    .limit(limit)
    .lean();

export const countMany = (filter = {}) => Product.countDocuments(filter);

export const updateById = (id, data) =>
  Product.findByIdAndUpdate(id, data, { new: true, runValidators: true });

export const deleteById = (id) => Product.findByIdAndDelete(id);

export const incrementViews = (id) => Product.findByIdAndUpdate(id, { $inc: { views: 1 } });

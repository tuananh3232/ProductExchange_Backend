import * as productRepo from '../repositories/product.repository.js';
import AppError from '../utils/app-error.util.js';
import ERRORS from '../constants/error.constant.js';
import HTTP_STATUS from '../constants/http-status.constant.js';
import { buildPaginationMeta } from '../utils/pagination.util.js';

const buildFilter = (query) => {
  const filter = { isActive: true };

  if (query.status) filter.status = query.status;
  else filter.status = 'available'; // Mặc định chỉ lấy sản phẩm còn bán

  if (query.category) filter.category = query.category;
  if (query.listingType) filter.listingType = query.listingType;
  if (query.condition) filter.condition = query.condition;
  if (query.ownerId) filter.owner = query.ownerId;

  // Lọc theo tỉnh thành
  if (query.province) filter['location.province'] = query.province;

  // Lọc theo khoảng giá
  if (query.minPrice || query.maxPrice) {
    filter.price = {};
    if (query.minPrice) filter.price.$gte = Number(query.minPrice);
    if (query.maxPrice) filter.price.$lte = Number(query.maxPrice);
  }

  // Tìm kiếm full-text
  if (query.search) {
    filter.$text = { $search: query.search };
  }

  return filter;
};

export const getProducts = async (query, { page, limit, skip, sortBy, sortOrder }) => {
  const filter = buildFilter(query);

  const [products, total] = await Promise.all([
    productRepo.findMany({ filter, skip, limit, sortBy, sortOrder }),
    productRepo.countMany(filter),
  ]);

  return { products, meta: buildPaginationMeta(total, page, limit) };
};

export const getProductById = async (id) => {
  const product = await productRepo.findById(id);
  if (!product || !product.isActive) {
    throw new AppError('Không tìm thấy sản phẩm', HTTP_STATUS.NOT_FOUND, ERRORS.PRODUCT.NOT_FOUND);
  }
  // Tăng lượt xem bất đồng bộ (không chờ)
  productRepo.incrementViews(id);
  return product;
};

export const createProduct = async (userId, productData) => {
  return productRepo.create({ ...productData, owner: userId });
};

export const updateProduct = async (productId, userId, updateData) => {
  const product = await productRepo.findById(productId);
  if (!product) {
    throw new AppError('Không tìm thấy sản phẩm', HTTP_STATUS.NOT_FOUND, ERRORS.PRODUCT.NOT_FOUND);
  }
  if (product.owner._id.toString() !== userId.toString()) {
    throw new AppError('Bạn không có quyền chỉnh sửa sản phẩm này', HTTP_STATUS.FORBIDDEN, ERRORS.PRODUCT.NOT_OWNER);
  }
  return productRepo.updateById(productId, updateData);
};

export const deleteProduct = async (productId, userId, userRole) => {
  const product = await productRepo.findById(productId);
  if (!product) {
    throw new AppError('Không tìm thấy sản phẩm', HTTP_STATUS.NOT_FOUND, ERRORS.PRODUCT.NOT_FOUND);
  }

  const isOwner = product.owner._id.toString() === userId.toString();
  if (!isOwner && userRole !== 'admin') {
    throw new AppError('Bạn không có quyền xóa sản phẩm này', HTTP_STATUS.FORBIDDEN, ERRORS.PRODUCT.NOT_OWNER);
  }

  // Soft delete thay vì xóa thật
  await productRepo.updateById(productId, { isActive: false });
};

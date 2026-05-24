import Joi from 'joi'

export const createProductSchema = Joi.object({
  ownerType: Joi.string().valid('SHOP', 'SELLER'),
  title: Joi.string().trim().min(5).max(200).required(),
  description: Joi.string().trim().min(20).max(3000).required(),
  price: Joi.number().min(0).required(),
  stock: Joi.number().integer().min(0),
  listingType: Joi.string().valid('sell').required(),
  condition: Joi.string().valid('new', 'like_new', 'good', 'fair', 'poor').required(),
  category: Joi.string().hex().length(24).required(), // MongoDB ObjectId
  shop: Joi.when('ownerType', {
    is: 'SELLER',
    then: Joi.forbidden(),
    otherwise: Joi.string().hex().length(24),
  }),
  images: Joi.array()
    .items(
      Joi.object({
        url: Joi.string().uri().required(),
        publicId: Joi.string().required(),
      })
    )
    .optional(),
  location: Joi.object({
    province: Joi.string().optional().allow(''),
    district: Joi.string().optional().allow(''),
  }).optional(),
})

export const updateProductSchema = Joi.object({
  ownerType: Joi.string().valid('SHOP', 'SELLER'),
  title: Joi.string().trim().min(5).max(200),
  description: Joi.string().trim().min(20).max(3000),
  price: Joi.number().min(0),
  stock: Joi.number().integer().min(0),
  condition: Joi.string().valid('new', 'like_new', 'good', 'fair', 'poor'),
  category: Joi.string().hex().length(24),
  shop: Joi.string().hex().length(24).allow(null),
  images: Joi.array()
    .items(
      Joi.object({
        url: Joi.string().uri().required(),
        publicId: Joi.string().required(),
      })
    )
    .optional(),
  location: Joi.object({
    province: Joi.string().allow(''),
    district: Joi.string().allow(''),
  }),
}).min(1)

export const updateStatusSchema = Joi.object({
  status: Joi.string().valid('available', 'pending', 'hidden', 'sold').required(),
})

export const addProductImagesSchema = Joi.object({
  images: Joi.array()
    .items(
      Joi.object({
        url: Joi.string().uri().required(),
        publicId: Joi.string().required(),
      })
    )
    .min(1)
    .required(),
})

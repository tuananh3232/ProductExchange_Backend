import { v2 as cloudinary } from 'cloudinary'
import { env } from '../configs/env.config.js'

const configure = () => {
  cloudinary.config({
    cloud_name: env.cloudinary.cloudName,
    api_key: env.cloudinary.apiKey,
    api_secret: env.cloudinary.apiSecret,
  })
}

export const uploadBuffer = (buffer, folder) => {
  configure()
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ folder, resource_type: 'image' }, (error, result) => {
        if (error) reject(error)
        else resolve({ url: result.secure_url, publicId: result.public_id })
      })
      .end(buffer)
  })
}

export const deleteImage = async (publicId) => {
  if (!publicId) return
  configure()
  await cloudinary.uploader.destroy(publicId)
}

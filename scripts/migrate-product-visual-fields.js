import { connectDB, disconnectDB } from '../src/configs/database.config.js'
import Product from '../src/models/product.model.js'

const run = async () => {
  await connectDB()

  const result = await Product.collection.updateMany(
    { dimensions: { $exists: false } },
    {
      $set: {
        dimensions: { widthCm: null, heightCm: null, depthCm: null },
        visualProfile: { placementType: 'wall_mounted', anchor: 'center', isVisualizerReady: false },
        visualAssets: { sourceImage: { url: '', publicId: '' }, cutouts: [] },
      },
    }
  )

  console.log(`Migrated ${result.modifiedCount} products: added dimensions, visualProfile, visualAssets fields`)
}

run()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await disconnectDB()
  })

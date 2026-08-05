import { DECOR_CATEGORIES } from '../../data/decor.seed-data.js'
import * as categoryRepo from '../../repositories/category/category.repository.js'

const emptySeedResult = (skipped = true) => ({
  skipped,
  matchedCount: 0,
  modifiedCount: 0,
  upsertedCount: 0,
})

export const ensureDefaultCategories = async () => {
  const activeCategoryCount = await categoryRepo.countMany({ isActive: true })
  if (activeCategoryCount > 0) {
    return emptySeedResult()
  }

  const operations = DECOR_CATEGORIES.map(({ name, slug, description = '', icon = '' }) => ({
    updateOne: {
      filter: { slug },
      update: {
        $set: {
          name,
          slug,
          description,
          icon,
          isActive: true,
          deletedAt: null,
        },
      },
      upsert: true,
    },
  }))

  if (!operations.length) {
    return emptySeedResult()
  }

  const result = await categoryRepo.bulkWrite(operations, { ordered: false })

  return {
    skipped: false,
    matchedCount: result.matchedCount || 0,
    modifiedCount: result.modifiedCount || 0,
    upsertedCount: result.upsertedCount || 0,
  }
}

import { jest } from '@jest/globals'

const categoryRepo = {
  countMany: jest.fn(),
  bulkWrite: jest.fn(),
}

jest.unstable_mockModule('../../src/repositories/category/category.repository.js', () => categoryRepo)

const { ensureDefaultCategories } = await import('../../src/services/category/category-seed.service.js')
const { DECOR_CATEGORIES } = await import('../../src/data/decor.seed-data.js')

beforeEach(() => {
  jest.clearAllMocks()
})

describe('category seed service unit', () => {
  it('does not seed when active categories already exist', async () => {
    categoryRepo.countMany.mockResolvedValue(1)

    const result = await ensureDefaultCategories()

    expect(result.skipped).toBe(true)
    expect(categoryRepo.bulkWrite).not.toHaveBeenCalled()
  })

  it('upserts active default categories when none are active', async () => {
    categoryRepo.countMany.mockResolvedValue(0)
    categoryRepo.bulkWrite.mockResolvedValue({
      matchedCount: 0,
      modifiedCount: 0,
      upsertedCount: DECOR_CATEGORIES.length,
    })

    const result = await ensureDefaultCategories()

    expect(result.skipped).toBe(false)
    expect(result.upsertedCount).toBe(DECOR_CATEGORIES.length)
    expect(categoryRepo.bulkWrite).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          updateOne: expect.objectContaining({
            filter: { slug: DECOR_CATEGORIES[0].slug },
            upsert: true,
          }),
        }),
      ]),
      { ordered: false }
    )
  })
})

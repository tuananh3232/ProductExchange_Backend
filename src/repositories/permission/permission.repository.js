import Permission from '../../models/permission.model.js'

export const findByKeys = async (keys = []) => {
  if (!keys.length) return []
  return Permission.find({ key: { $in: keys }, isActive: true })
}

export const findAll = async () => Permission.find({ isActive: true }).sort({ key: 1 })

export const upsertMany = async (permissions = []) => {
  if (!permissions.length) return

  await Permission.bulkWrite(
    permissions.map((permission) => ({
      updateOne: {
        filter: { key: permission.key },
        update: {
          $set: {
            description: permission.description || '',
            module: permission.module || permission.key.split(':')[0] || '',
            isActive: true,
          },
          $setOnInsert: {
            key: permission.key,
          },
        },
        upsert: true,
      },
    }))
  )
}

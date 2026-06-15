import Role from '../../models/role.model.js'

export const findByCodesWithPermissions = async (codes = []) => {
  if (!codes.length) return []

  return Role.find({ code: { $in: codes }, isActive: true }).populate({
    path: 'permissions',
    match: { isActive: true },
    select: 'key',
  })
}

export const findByCodeWithPermissions = async (code) =>
  Role.findOne({ code, isActive: true }).populate({
    path: 'permissions',
    match: { isActive: true },
    select: 'key description module',
  })

export const findAllWithPermissions = async () =>
  Role.find({ isActive: true })
    .populate({ path: 'permissions', match: { isActive: true }, select: 'key description module' })
    .sort({ code: 1 })

export const upsertRoleByCode = async ({ code, name, description, permissionIds }) =>
  Role.findOneAndUpdate(
    { code },
    {
      $set: {
        name,
        description,
        permissions: permissionIds,
        isActive: true,
      },
      $setOnInsert: {
        code,
      },
    },
    { returnDocument: 'after', upsert: true, runValidators: true }
  )

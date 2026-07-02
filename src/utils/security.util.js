export const escapeRegex = (value = '') =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const maskIdNumber = (value = '') => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (raw.length <= 4) return '*'.repeat(raw.length)
  return `${'*'.repeat(Math.max(0, raw.length - 4))}${raw.slice(-4)}`
}

export const maskAccountNumber = (value = '') => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (raw.length <= 4) return '*'.repeat(raw.length)
  return `${'*'.repeat(Math.max(0, raw.length - 4))}${raw.slice(-4)}`
}

export const maskBankInfo = (bankInfo = {}) => {
  if (!bankInfo) return bankInfo
  return {
    ...bankInfo,
    accountNumber: maskAccountNumber(bankInfo.accountNumber),
  }
}

export const sanitizeAdminUserListItem = (user) => {
  const obj = typeof user?.toObject === 'function' ? user.toObject() : { ...user }
  delete obj.password
  delete obj.refreshToken
  delete obj.emailVerificationToken
  delete obj.emailVerificationExpires
  delete obj.resetPasswordToken
  delete obj.resetPasswordExpires

  if (obj.kyc) {
    obj.kyc = {
      status: obj.kyc.status || 'none',
      fullName: obj.kyc.fullName || '',
      idNumber: maskIdNumber(obj.kyc.idNumber),
      rejectionReason: obj.kyc.rejectionReason || '',
      submittedAt: obj.kyc.submittedAt || null,
      reviewedAt: obj.kyc.reviewedAt || null,
    }
  }

  return obj
}

export const sanitizeAdminKycListItem = (user) => {
  const sanitizedUser = sanitizeAdminUserListItem(user)
  const kyc = sanitizedUser.kyc || { status: 'none' }
  return {
    user: sanitizedUser,
    kyc,
  }
}

export const sanitizeWithdrawalListItem = (withdrawal) => {
  const obj = typeof withdrawal?.toObject === 'function' ? withdrawal.toObject() : { ...withdrawal }
  if (obj.bankInfo) obj.bankInfo = maskBankInfo(obj.bankInfo)
  return obj
}

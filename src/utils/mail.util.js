import nodemailer from 'nodemailer'
import { env } from '../configs/env.config.js'
import { otpEmailTemplate } from '../templates/otp-email.template.js'
import { shopStaffInvitationEmailTemplate } from '../templates/shop-staff-invitation-email.template.js'

let transporter

const getTransporter = () => {
  if (!env.mail.host || !env.mail.user || !env.mail.password || !env.mail.from) {
    return null
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.mail.host,
      port: env.mail.port,
      secure: env.mail.secure,
      auth: {
        user: env.mail.user,
        pass: env.mail.password,
      },
    })
  }

  return transporter
}

export const isMailConfigured = () => Boolean(getTransporter())

export const sendVerificationOtpEmail = async ({ to, name = '', otp }) => {
  const client = getTransporter()
  if (!client) {
    return false
  }

  const displayName = name?.trim() || 'bạn'
  const subject = 'Mã xác thực tài khoản ProductExchange'
  const text = [
    `Xin chào ${displayName},`,
    '',
    'Vui lòng sử dụng mã bên dưới để xác thực tài khoản.',
    '',
    `Mã OTP xác thực email của bạn là: ${otp}`,
    '',
    'Mã này chỉ có hiệu lực trong vài phút. Không chia sẻ mã này với bất kỳ ai.',
    '',
    'Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email.',
  ].join('\n')

  const html = otpEmailTemplate({ userName: displayName, otpCode: otp })

  await client.sendMail({
    from: `${env.mail.fromName} <${env.mail.from}>`,
    to,
    subject,
    text,
    html,
  })

  return true
}

export const sendPasswordOtpEmail = async ({ to, name = '', otp, purpose = 'đặt lại mật khẩu' }) => {
  const client = getTransporter()
  if (!client) {
    return false
  }

  const displayName = name?.trim() || 'bạn'
  const subject = 'Mã OTP đổi mật khẩu ProductExchange'
  const text = [
    `Xin chào ${displayName},`,
    '',
    `Mã OTP để ${purpose} của bạn là: ${otp}`,
    '',
    'Mã có hiệu lực trong 15 phút.',
    '',
    'Nếu bạn không yêu cầu mã này, hãy bỏ qua email này.',
  ].join('\n')

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
      <p>Xin chào ${displayName},</p>
      <p>Mã OTP để ${purpose} của bạn là:</p>
      <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px; margin: 16px 0;">${otp}</p>
      <p>Mã có hiệu lực trong 15 phút.</p>
      <p>Nếu bạn không yêu cầu mã này, hãy bỏ qua email này.</p>
    </div>
  `

  await client.sendMail({
    from: `${env.mail.fromName} <${env.mail.from}>`,
    to,
    subject,
    text,
    html,
  })

  return true
}

export const sendShopStaffInvitationEmail = async ({
  to,
  memberName = '',
  shopName = '',
  ownerName = '',
  invitationLink = '',
}) => {
  const client = getTransporter()
  if (!client) {
    return false
  }

  const displayName = memberName?.trim() || to
  const displayOwnerName = ownerName?.trim() || 'Chủ shop'
  const displayShopName = shopName?.trim() || 'shop'
  const subject = `Bạn được mời làm nhân sự cho shop ${displayShopName}`
  const actionText = invitationLink
    ? `Nhấn vào link sau để xem và phản hồi lời mời: ${invitationLink}`
    : 'Vui lòng đăng nhập vào hệ thống để kiểm tra lời mời.'
  const text = [
    `Xin chào ${displayName},`,
    '',
    `${displayOwnerName} đã mời bạn tham gia quản lý shop ${displayShopName}.`,
    '',
    'Vai trò được mời: Staff của shop.',
    '',
    actionText,
    '',
    'Nếu bạn không mong đợi lời mời này, hãy bỏ qua email này.',
  ].join('\n')

  const html = shopStaffInvitationEmailTemplate({
    memberName: displayName,
    shopName: displayShopName,
    ownerName: displayOwnerName,
    invitationLink,
  })

  await client.sendMail({
    from: `${env.mail.fromName} <${env.mail.from}>`,
    to,
    subject,
    text,
    html,
  })

  return true
}

export const sendStaffInvitationEmail = ({
  to,
  name = '',
  shopName = '',
  inviterName = '',
  invitationUrl = '',
}) =>
  sendShopStaffInvitationEmail({
    to,
    memberName: name,
    shopName,
    ownerName: inviterName,
    invitationLink: invitationUrl,
  })

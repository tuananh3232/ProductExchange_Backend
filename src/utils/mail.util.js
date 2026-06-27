import nodemailer from 'nodemailer'
import { env } from '../configs/env.config.js'
import { otpEmailTemplate } from '../templates/otp-email.template.js'

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
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
      auth: {
        user: env.mail.user,
        pass: env.mail.password,
      },
    })
  }

  return transporter
}

export const isMailConfigured = () => Boolean(getTransporter())

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

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

export const sendStaffInvitationEmail = async ({ to, name = '', shopName = '', inviterName = '', invitationUrl }) => {
  const client = getTransporter()
  if (!client) {
    return false
  }

  const displayName = name?.trim() || 'bạn'
  const safeName = escapeHtml(displayName)
  const safeShopName = escapeHtml(shopName || 'shop')
  const safeInviterName = escapeHtml(inviterName || 'Chủ shop')
  const safeInvitationUrl = escapeHtml(invitationUrl)
  const subject = `Lời mời làm staff cho ${shopName || 'shop'}`
  const text = [
    `Xin chào ${displayName},`,
    '',
    `${inviterName || 'Chủ shop'} đã mời bạn làm staff cho ${shopName || 'shop'} trên ProductExchange.`,
    '',
    `Nhấn vào link sau để xem và phản hồi lời mời: ${invitationUrl}`,
    '',
    'Lời mời có hiệu lực trong 7 ngày.',
    '',
    'Nếu bạn không mong đợi lời mời này, hãy bỏ qua email này.',
  ].join('\n')

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
      <p>Xin chào ${safeName},</p>
      <p><strong>${safeInviterName}</strong> đã mời bạn làm staff cho <strong>${safeShopName}</strong> trên ProductExchange.</p>
      <p style="margin: 24px 0;">
        <a href="${safeInvitationUrl}" style="display: inline-block; padding: 12px 18px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 700;">
          Xem lời mời
        </a>
      </p>
      <p>Hoặc mở link này: <a href="${safeInvitationUrl}">${safeInvitationUrl}</a></p>
      <p>Lời mời có hiệu lực trong 7 ngày.</p>
      <p>Nếu bạn không mong đợi lời mời này, hãy bỏ qua email này.</p>
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

import nodemailer from 'nodemailer'
import { env } from '../configs/env.config.js'

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
  const subject = 'Mã OTP xác minh email ProductExchange'
  const text = [
    `Xin chào ${displayName},`,
    '',
    `Mã OTP xác minh email của bạn là: ${otp}`,
    '',
    'Mã có hiệu lực trong 24 giờ.',
    '',
    'Nếu bạn không yêu cầu mã này, hãy bỏ qua email này.',
  ].join('\n')

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
      <p>Xin chào ${displayName},</p>
      <p>Mã OTP xác minh email của bạn là:</p>
      <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px; margin: 16px 0;">${otp}</p>
      <p>Mã có hiệu lực trong 24 giờ.</p>
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